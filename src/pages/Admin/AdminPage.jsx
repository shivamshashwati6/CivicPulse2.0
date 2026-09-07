import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  Layers,
  RefreshCw,
  CheckCircle2,
  MapPin,
  Tag,
  User,
  Search,
  Loader2,
  Radio,
  FileText,
  Sparkles,
  Flame,
  Activity,
  Filter,
  Trash2,
  HelpCircle,
  Zap,
  Eye,
  Building2,
  AlertTriangle,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { ISSUE_CATEGORIES, MUNICIPAL_DEPARTMENTS } from '../../utils/constants';
import { calculateUrbanImpactScore, detectUrbanHotspots, getRecommendedDepartment } from '../../utils/helpers';
import { supabase } from '../../services/supabaseClient';
import { issueService } from '../../services/issueService';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../hooks/useTheme';

// Helper to create glowing tactical map marker icons based on severity/status
const createMarkerIcon = (severity, status) => {
  let color = '#3b82f6';
  let glow = 'rgba(59, 130, 246, 0.6)';

  if ((status || '').toLowerCase() === 'resolved') {
    color = '#10b981';
    glow = 'rgba(16, 185, 129, 0.6)';
  } else {
    switch ((severity || '').toLowerCase()) {
      case 'critical':
        color = '#ef4444';
        glow = 'rgba(239, 68, 68, 0.9)';
        break;
      case 'high':
        color = '#f97316';
        glow = 'rgba(249, 115, 22, 0.8)';
        break;
      case 'medium':
        color = '#eab308';
        glow = 'rgba(234, 179, 8, 0.7)';
        break;
      case 'low':
      default:
        color = '#10b981';
        glow = 'rgba(16, 185, 129, 0.6)';
        break;
    }
  }

  return L.divIcon({
    className: 'tactical-map-pin',
    html: `
      <div style="
        position: relative;
        width: 22px;
        height: 22px;
        background-color: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 14px ${glow};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 7px; height: 7px; background-color: #ffffff; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
};

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function AdminPage() {
  const toast = useToast();
  const { theme } = useTheme();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [activeTooltipId, setActiveTooltipId] = useState(null);
  const [mapView, setMapView] = useState('hotspots'); // 'issues', 'hotspots', 'heatmap'
  const [fetchError, setFetchError] = useState(null);

  // Detect Urban Hotspots dynamically from active complaints dataset
  const hotspots = useMemo(() => {
    return detectUrbanHotspots(complaints, 400, categoryFilter);
  }, [complaints, categoryFilter]);

  // Hotspot Summary Metrics
  const totalHotspots = hotspots.length;
  const criticalHotspotCount = hotspots.filter((h) => h.intensityLabel === 'Critical').length;
  const highImpactHotspotCount = hotspots.filter((h) => h.intensityLabel === 'High').length;
  const emergingZoneCount = hotspots.filter((h) => h.isEmerging).length;

  // Fetch ALL complaints directly from issueService (syncs Supabase and local storage queue)
  const fetchComplaintsDirectly = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: allComplaints, error } = await issueService.fetchAllComplaints();

      if (error) {
        console.warn('Database query notice:', error);
        setFetchError(error.message || 'Database query error');
      }

      // Deduplicate by unique complaint ID
      const uniqueMap = new Map();
      (allComplaints || []).forEach((item) => {
        if (item && item.id && !uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });

      setComplaints(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Direct complaint fetch exception:', err);
      setFetchError(err.message || 'Failed to connect to municipal database.');
      toast.error('Failed to fetch complaints from database.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchComplaintsDirectly();

    const channel = supabase
      .channel('admin-realtime-complaints')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        async (payload) => {
          console.log('Realtime postgres_changes event in AdminPage:', payload);

          if (payload.eventType === 'INSERT' && payload.new?.id) {
            try {
              const { data: newItem } = await issueService.fetchIssueById(payload.new.id);
              const itemToAdd = newItem || payload.new;
              setComplaints((prev) => {
                if (prev.some((c) => c.id === itemToAdd.id)) {
                  return prev.map((c) => (c.id === itemToAdd.id ? { ...c, ...itemToAdd } : c));
                }
                return [itemToAdd, ...prev];
              });
            } catch (fetchErr) {
              console.warn('Realtime INSERT item fetch warning:', fetchErr);
              setComplaints((prev) => {
                if (prev.some((c) => c.id === payload.new.id)) return prev;
                return [payload.new, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE' && payload.new?.id) {
            setComplaints((prev) =>
              prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
            );
          } else if (payload.eventType === 'DELETE' && payload.old?.id) {
            setComplaints((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        }
        if (err) {
          console.error('Admin Realtime subscription error:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComplaintsDirectly]);

  const handleStatusChange = async (complaintId, newStatus) => {
    setUpdatingId(complaintId);
    try {
      const { error } = await issueService.updateComplaintStatus(complaintId, newStatus);

      if (error) {
        toast.error(`Update failed: ${error.message}`);
      } else {
        toast.success(`Status updated to "${newStatus}"`);
        await fetchComplaintsDirectly();
      }
    } catch (err) {
      console.error('Status update exception:', err);
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDepartmentChange = async (complaintId, newDept) => {
    setUpdatingId(complaintId);
    try {
      const { error } = await issueService.updateComplaintDepartment(complaintId, newDept);
      if (error) {
        toast.error(`Department routing failed: ${error.message}`);
      } else {
        toast.success(`Routed to "${newDept}"`);
        await fetchComplaintsDirectly();
      }
    } catch (err) {
      console.error('Department update exception:', err);
      toast.error('Failed to update department routing');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAdminDelete = async (complaintId) => {
    setComplaints((prev) => prev.filter((c) => c.id !== complaintId));
    toast.success('Complaint dismissed and removed from queue.');

    try {
      const { error } = await supabase.from('complaints').delete().eq('id', complaintId);
      issueService.deleteComplaint(complaintId);
      if (error) {
        console.error('Admin delete complaint error:', error);
      }
    } catch (err) {
      console.error('Admin delete complaint exception:', err);
    }
  };

  // Stats Calculations
  const totalReports = complaints.length;
  const criticalCount = complaints.filter(
    (c) => (c.severity || c.severity_score || '').toLowerCase() === 'critical'
  ).length;
  const pendingCount = complaints.filter(
    (c) => (c.status || '').toLowerCase() === 'pending'
  ).length;
  const inProgressCount = complaints.filter(
    (c) => (c.status || '').toLowerCase() === 'in progress'
  ).length;
  const resolvedCount = complaints.filter(
    (c) => (c.status || '').toLowerCase() === 'resolved'
  ).length;

  const avgResolutionTime = '3.8 Hours';

  // Active Department Workload Calculations (Smart Routing Summary - Part 8)
  const departmentWorkload = useMemo(() => {
    const counts = {
      'Public Works Department': 0,
      'Waste Management Department': 0,
      'Electrical / Street Lighting Department': 0,
      'Water & Sewerage Department': 0,
      'Review Required': 0,
    };

    complaints.forEach((c) => {
      const status = (c.status || '').toLowerCase();
      if (status !== 'resolved') {
        const dept = c.recommended_department || getRecommendedDepartment(c.category);
        counts[dept] = (counts[dept] || 0) + 1;
      }
    });

    return counts;
  }, [complaints]);

  // Category Distribution for Recharts
  const categoryChartData = useMemo(() => {
    const counts = {};
    complaints.forEach((c) => {
      const cat = c.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [complaints]);

  // Filter complaints based on Search, Category, Department, Status, and Severity
  const filteredComplaints = complaints.filter((c) => {
    const matchesStatus =
      statusFilter === 'all' || (c.status || '').toLowerCase() === statusFilter.toLowerCase();

    const matchesSeverity =
      severityFilter === 'all' ||
      (c.severity || c.severity_score || '').toLowerCase() === severityFilter.toLowerCase();

    const matchesCategory =
      categoryFilter === 'all' || (c.category || '').toLowerCase() === categoryFilter.toLowerCase();

    const complaintDept = c.recommended_department || getRecommendedDepartment(c.category);
    const matchesDepartment =
      departmentFilter === 'all' || complaintDept.toLowerCase() === departmentFilter.toLowerCase();

    const matchesSearch =
      (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.profiles?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      complaintDept.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSeverity && matchesCategory && matchesDepartment && matchesSearch;
  });

  // Priority Queue Table sorting (Urban Impact Score: 100 -> 0)
  const prioritySortedComplaints = useMemo(() => {
    return [...filteredComplaints].sort((a, b) => {
      const impactA = calculateUrbanImpactScore(a, complaints).score;
      const impactB = calculateUrbanImpactScore(b, complaints).score;
      if (impactA !== impactB) return impactB - impactA;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [filteredComplaints, complaints]);

  // City Map Center
  const mapCenter = useMemo(() => {
    const valid = complaints.find((c) => c.latitude && c.longitude);
    if (valid) return [valid.latitude, valid.longitude];
    return [28.6139, 77.2090];
  }, [complaints]);

  const mapMarkers = useMemo(() => {
    return complaints.filter((c) => c.latitude && c.longitude);
  }, [complaints]);

  const getSeverityBadgeColor = (sev) => {
    switch ((sev || '').toLowerCase()) {
      case 'critical':
        return 'bg-red-500/10 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border dark:border-red-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border dark:border-amber-500/30';
      case 'medium':
        return 'bg-blue-500/10 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border dark:border-blue-500/30';
      case 'low':
      default:
        return 'bg-emerald-500/10 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border dark:border-emerald-500/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Tactical Header */}
      <PageHeader
        title="Authority Dashboard & Command Center"
        description="Tactical real-time GIS spatial monitoring, municipal priority queue, and AI dispatch management."
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="indigo">Municipal Command Authority</Badge>
            {realtimeConnected && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 text-[10px] font-bold tracking-wider border border-emerald-300 dark:border-emerald-500/30">
                <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-pulse" /> Live Telemetry
              </span>
            )}
          </div>
        }
        action={
          <Button
            onClick={fetchComplaintsDirectly}
            disabled={loading}
            variant="outline"
            className="text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Complaints */}
        <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:dark:border-blue-500/40 hover:dark:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Complaints</span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/30">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{loading ? '...' : totalReports}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Recorded across city sectors</p>
        </div>

        {/* Critical Severity Count */}
        <div className="p-5 rounded-2xl bg-white/80 border border-red-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-red-500/30 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:dark:border-red-500/60 hover:dark:shadow-[0_0_20px_rgba(239,68,68,0.15)] transition-all duration-300 space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Critical Hazards</span>
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-500/30">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">{loading ? '...' : criticalCount}</div>
          <p className="text-[11px] text-red-600/80 dark:text-red-300">Immediate dispatch required</p>
        </div>

        {/* Resolved Count */}
        <div className="p-5 rounded-2xl bg-white/80 border border-emerald-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-emerald-500/30 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:dark:border-emerald-500/60 hover:dark:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Resolved Reports</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{loading ? '...' : resolvedCount}</div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-300">Completed municipal tickets</p>
        </div>

        {/* Average Resolution Time */}
        <div className="p-5 rounded-2xl bg-white/80 border border-indigo-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:dark:border-blue-500/40 hover:dark:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Avg Resolution Time</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-300">{avgResolutionTime}</div>
          <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300">SLA metric target: &lt; 6.0 hrs</p>
        </div>
      </div>

      {/* Smart Municipal Department Workload Summary */}
      <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 space-y-3 transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Automated Department Routing Workload (Active Issues)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Live Auto-Assigned Data</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {MUNICIPAL_DEPARTMENTS.map((dept) => {
            const count = departmentWorkload[dept] || 0;
            const isReview = dept === 'Review Required';
            const isSelected = departmentFilter === dept;
            return (
              <div
                key={dept}
                onClick={() => setDepartmentFilter(isSelected ? 'all' : dept)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-500 shadow-xs'
                    : isReview
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 hover:border-amber-400'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  {dept}
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-1">
                  {count > 0 ? `${count} active` : 'No active issues'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hotspot Intelligence Summary Analytics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Urban Hotspots</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400">{totalHotspots} Zones</div>
          <p className="text-[10px] text-slate-400">Spatial clusters (&lt;400m)</p>
        </div>

        <div className="p-3.5 rounded-xl bg-red-950/60 text-white border border-red-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-red-300">
            <span>Critical Zones</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-xl font-black text-red-400">{criticalHotspotCount} High Risk</div>
          <p className="text-[10px] text-red-300/80">Intensity &ge; 75 / 100</p>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-950/50 text-white border border-amber-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-300">
            <span>High Impact Zones</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-300">{highImpactHotspotCount} Zones</div>
          <p className="text-[10px] text-amber-300/80">Intensity 50&ndash;74 / 100</p>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-950/60 text-white border border-purple-800/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-300">
            <span>Emerging Hotspots</span>
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-300">{emergingZoneCount} Rapid Growth</div>
          <p className="text-[10px] text-purple-300/80">&ge;50% recent (&lt;48h)</p>
        </div>
      </div>

      {/* Dynamic Heatmap Container & Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live GIS Map Container */}
        <div className="lg:col-span-2 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-5 space-y-4 transition-all duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Urban Hotspot Intelligence Map
              </h3>
            </div>

            {/* Map View Switcher Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMapView('hotspots')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  mapView === 'hotspots'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Flame className="w-3 h-3" /> Hotspots
              </button>
              <button
                type="button"
                onClick={() => setMapView('heatmap')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  mapView === 'heatmap'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" /> Heatmap
              </button>
              <button
                type="button"
                onClick={() => setMapView('issues')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  mapView === 'issues'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MapPin className="w-3 h-3" /> Issue Pins
              </button>
            </div>
          </div>

          <div className="h-[380px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative bg-slate-100 dark:bg-slate-950 transition-colors">
            {/* Empty Hotspots Banner */}
            {mapView !== 'issues' && hotspots.length === 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-slate-900/90 text-white text-xs font-semibold rounded-xl border border-slate-700 backdrop-blur-md shadow-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>No significant urban hotspots detected in current filter view</span>
              </div>
            )}

            <MapContainer
              center={mapCenter}
              zoom={12}
              scrollWheelZoom={false}
              className="h-full w-full z-10"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* View Mode 1: Hotspots (Concentration Circles) */}
              {mapView === 'hotspots' &&
                hotspots.map((h) => (
                  <CircleMarker
                    key={h.id}
                    center={[h.centerLat, h.centerLng]}
                    radius={Math.max(16, Math.min(38, 14 + h.complaintCount * 4))}
                    pathOptions={{
                      color: h.strokeColor,
                      fillColor: h.fillColor,
                      fillOpacity: 0.5,
                      weight: h.isEmerging ? 3 : 2,
                    }}
                  >
                    <Popup className="tactical-popup">
                      <div className="p-2 space-y-2 max-w-xs text-slate-900">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-white shadow-2xs"
                            style={{ backgroundColor: h.fillColor }}
                          >
                            {h.intensityLabel} Zone
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-700">
                            Intensity: {h.intensityScore} / 100
                          </span>
                        </div>

                        {h.isEmerging && (
                          <div className="px-2 py-1 bg-purple-100 text-purple-900 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-purple-300">
                            <TrendingUp className="w-3 h-3 text-purple-600" /> Rapidly Emerging Hotspot (&ge;50% &lt;48h)
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Active Complaints</span>
                            <span className="font-extrabold text-slate-900 text-sm">{h.complaintCount} Reports</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Main Category</span>
                            <span className="font-bold text-blue-700 capitalize">{h.mainCategory}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Avg Impact Score</span>
                            <span className="font-bold text-slate-800">{h.avgImpactScore} / 100</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Max Severity</span>
                            <span className="font-bold text-red-600 uppercase">{h.maxSeverity}</span>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 italic">
                          Centered near Lat: {Number(h.centerLat || h.center?.[0] || 0).toFixed(4)}, Lng: {Number(h.centerLng || h.center?.[1] || 0).toFixed(4)}
                        </p>

                        <button
                          type="button"
                          onClick={() => setSearchQuery(h.mainCategory)}
                          className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Filter className="w-3 h-3" /> View Issues in Queue
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

              {/* View Mode 2: Heatmap (Glowing Gradient Circles) */}
              {mapView === 'heatmap' &&
                hotspots.map((h) => (
                  <React.Fragment key={`heat-group-${h.id}`}>
                    {/* Outer aura */}
                    <CircleMarker
                      center={[h.centerLat, h.centerLng]}
                      radius={Math.max(28, Math.min(60, 20 + h.complaintCount * 6))}
                      pathOptions={{
                        color: h.strokeColor,
                        fillColor: h.fillColor,
                        fillOpacity: 0.25,
                        weight: 1,
                      }}
                    />
                    {/* Core intense center */}
                    <CircleMarker
                      center={[h.centerLat, h.centerLng]}
                      radius={Math.max(12, Math.min(24, 8 + h.complaintCount * 2))}
                      pathOptions={{
                        color: '#ffffff',
                        fillColor: h.fillColor,
                        fillOpacity: 0.8,
                        weight: 2,
                      }}
                    >
                      <Popup className="tactical-popup">
                        <div className="p-1.5 text-xs text-slate-900 space-y-1">
                          <h4 className="font-extrabold text-sm">{h.intensityLabel} Heat Zone</h4>
                          <p className="text-[11px] text-slate-600">{h.complaintCount} Complaints concentrated</p>
                          <p className="text-[11px] font-bold text-indigo-700 capitalize">Dominant: {h.mainCategory}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                ))}

              {/* View Mode 3: Individual Pins */}
              {mapView === 'issues' &&
                mapMarkers.map((c) => {
                  const markerIcon = createMarkerIcon(c.severity || c.severity_score, c.status);
                  return (
                    <Marker
                      key={c.id}
                      position={[c.latitude, c.longitude]}
                      icon={markerIcon}
                    >
                      <Popup className="tactical-popup">
                        <div className="p-1 space-y-1.5 max-w-xs text-slate-900">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs capitalize">{c.category}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px]">
                              {c.status || 'Pending'}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm leading-tight text-slate-900">{c.title}</h4>
                          <p className="text-xs text-slate-600">{c.address}</p>
                          {c.ai_summary && (
                            <p className="text-[11px] italic text-slate-700 bg-slate-100 p-1.5 rounded">
                              AI: {c.ai_summary}
                            </p>
                          )}
                          <div className="pt-1.5 flex items-center justify-between border-t border-slate-200 text-[11px]">
                            <span className="font-bold text-blue-600 flex items-center gap-1">
                              👍 I Face This Too: {c.upvotes || 1}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Priority: {c.priority || 'Medium'}
                            </span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
            </MapContainer>
          </div>
        </div>

        {/* Analytics & Department Breakdown Chart */}
        <div className="rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-5 space-y-4 flex flex-col justify-between transition-all duration-300">
          <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Category Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-mono">Live Sync</span>
          </div>

          <div className="h-[280px] w-full flex items-center justify-center">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
                  <XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
                  <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                      borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
                      borderRadius: '12px',
                      color: theme === 'dark' ? '#ffffff' : '#0f172a',
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">No chart data available</p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>Pending Tickets: <strong className="text-amber-600 dark:text-amber-400">{pendingCount}</strong></span>
            <span>Resolved Tickets: <strong className="text-emerald-600 dark:text-emerald-400">{resolvedCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Dynamic Filter Panel */}
      <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] space-y-4 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Interactive Priority & Department Filters</span>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Search by title, location, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Status Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Statuses ({totalReports})</option>
              <option value="pending">Pending ({pendingCount})</option>
              <option value="in progress">In Progress ({inProgressCount})</option>
              <option value="resolved">Resolved ({resolvedCount})</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Severity Level</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Issue Category Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Issue Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Categories</option>
              {ISSUE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Municipal Department Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Routed Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Departments</option>
              {MUNICIPAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic Priority Queue Table */}
      <div className="rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] overflow-hidden transition-all duration-300">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
              Municipal Priority Queue (Sorted by Urgency)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Displaying {prioritySortedComplaints.length} tickets matching active filter parameters
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-xs font-semibold">
            Auto-Prioritized by AI Vision
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading municipal priority queue...</p>
          </div>
        ) : fetchError ? (
          <div className="p-8 text-center space-y-3 bg-amber-50/50 dark:bg-amber-950/20 border-y border-amber-200 dark:border-amber-900/50">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">Database Synchronization Notice</h4>
            <p className="text-xs text-amber-700 dark:text-amber-400 max-w-md mx-auto">{fetchError}</p>
            <Button onClick={fetchComplaintsDirectly} variant="outline" className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Sync
            </Button>
          </div>
        ) : prioritySortedComplaints.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300">No Queue Tickets Match Criteria</h4>
            <p className="text-xs text-slate-500">Adjust your status, category, or search filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Urban Impact Score</th>
                  <th className="py-3.5 px-4">Urgency & Issue</th>
                  <th className="py-3.5 px-4">Category & Location</th>
                  <th className="py-3.5 px-4">Routed Department</th>
                  <th className="py-3.5 px-4">Reporter & AI Diagnosis</th>
                  <th className="py-3.5 px-4">Upvotes</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Dispatch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {prioritySortedComplaints.map((item) => {
                  const imageUrl = item.complaint_images?.[0]?.image_url || null;
                  const isUpdatingThis = updatingId === item.id;
                  const itemSeverity = item.severity || item.severity_score || 'Medium';
                  const impactInfo = calculateUrbanImpactScore(item, complaints);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Urban Impact Score Column with Tooltip Explanation */}
                      <td className="py-4 px-4 relative">
                        <div className="flex flex-col items-start space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border shadow-2xs flex items-center gap-1 ${impactInfo.colorClass}`}>
                              ⚡ {impactInfo.score} / 100
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTooltipId(activeTooltipId === item.id ? null : item.id)}
                              onMouseEnter={() => setActiveTooltipId(item.id)}
                              className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer p-0.5"
                              title="Why this score?"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {impactInfo.category}
                          </span>

                          {/* Expandable Explanation Tooltip */}
                          {activeTooltipId === item.id && (
                            <div className="absolute left-4 top-14 z-50 w-64 p-3 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-700 text-xs space-y-2 animate-in fade-in zoom-in-95">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 font-bold">
                                <span className="text-blue-400">Why this score?</span>
                                <span>{impactInfo.score} pts</span>
                              </div>
                              <div className="space-y-1 text-[11px] font-mono text-slate-300">
                                <div className="flex justify-between">
                                  <span>Severity rating:</span>
                                  <strong className="text-amber-400">+{impactInfo.breakdown.severity}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Community support:</span>
                                  <strong className="text-amber-400">+{impactInfo.breakdown.community}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Nearby concentration:</span>
                                  <strong className="text-amber-400">+{impactInfo.breakdown.concentration}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>Unresolved persistence:</span>
                                  <strong className="text-amber-400">+{impactInfo.breakdown.persistence}</strong>
                                </div>
                              </div>
                              <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-sans">
                                <span>Urban Impact Matrix</span>
                                <span className="font-bold text-white">{impactInfo.category}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Urgency & Issue Summary */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                            {imageUrl ? (
                              <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <Layers className="w-5 h-5 text-slate-400 dark:text-slate-600" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${getSeverityBadgeColor(itemSeverity)}`}>
                              {itemSeverity}
                            </span>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-1">{item.title}</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-1">{item.description}</p>
                          </div>
                        </div>
                      </td>

                      {/* Category & Location */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 capitalize">
                          <Tag className="w-3.5 h-3.5" />
                          <span>{item.category || 'General'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{item.address || 'GPS Tagged'}</span>
                        </div>
                      </td>

                      {/* Recommended Department & Reassign Route Dropdown */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span className="truncate">
                            {item.recommended_department || getRecommendedDepartment(item.category)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>AI-Assisted</span>
                          <select
                            value={item.recommended_department || getRecommendedDepartment(item.category)}
                            onChange={(e) => handleDepartmentChange(item.id, e.target.value)}
                            className="text-[10px] bg-transparent border-b border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-bold focus:outline-none cursor-pointer"
                            title="Reassign or confirm routed department"
                          >
                            {MUNICIPAL_DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept} className="bg-slate-900 text-white">
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Reporter & AI Diagnosis */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{item.profiles?.email || 'Citizen Report'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/60 max-w-[220px]">
                          <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                          <span className="truncate">{item.ai_summary || 'Gemini Vision Analyzed'}</span>
                        </div>
                      </td>

                      {/* Upvotes Count */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-amber-300 font-bold border border-slate-200 dark:border-slate-700">
                          👍 {item.upvotes || 1}
                        </span>
                      </td>

                      {/* Current Status Badge */}
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                          (item.status || '').toLowerCase() === 'resolved'
                            ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                            : (item.status || '').toLowerCase() === 'in progress'
                            ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {item.status || 'Pending'}
                        </span>
                      </td>

                      {/* Interactive Status Dropdown & Delete Action */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isUpdatingThis ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 font-medium">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                              Updating...
                            </div>
                          ) : (
                            <select
                              value={item.status || 'Pending'}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors cursor-pointer"
                            >
                              <option value="Pending">⚡ Pending</option>
                              <option value="In Progress">🛠️ In Progress</option>
                              <option value="Resolved">✅ Resolved</option>
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAdminDelete(item.id)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
                            title="Delete / Dismiss Ticket"
                            aria-label="Delete or dismiss complaint"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
