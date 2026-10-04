import React, { useState } from 'react';
import {
  X,
  Flame,
  MapPin,
  AlertTriangle,
  Building2,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Layers,
  Activity,
  FileText,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { MUNICIPAL_DEPARTMENTS } from '../../utils/constants';
import { HOTSPOT_STATUSES } from '../../services/hotspotService';

export function HotspotDetailsModal({
  hotspot,
  onClose,
  onUpdateStatus,
  onUpdateDepartment,
  onSelectComplaint,
}) {
  const [showRelatedIssues, setShowRelatedIssues] = useState(false);
  const [editingDept, setEditingDept] = useState(false);
  const [selectedDept, setSelectedDept] = useState(hotspot?.assignedDepartment || '');
  const [selectedStatus, setSelectedStatus] = useState(hotspot?.status || 'Detected');

  if (!hotspot) return null;

  const config = hotspot.scoringConfig;
  const breakdown = hotspot.scoreBreakdown || {
    density: 0,
    severity: 0,
    recurrence: 0,
    unresolvedAge: 0,
    confirmations: 0,
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setSelectedStatus(newStatus);
    if (onUpdateStatus) {
      onUpdateStatus(hotspot.id, newStatus);
    }
  };

  const handleSaveDepartment = () => {
    setEditingDept(false);
    if (onUpdateDepartment && selectedDept !== hotspot.assignedDepartment) {
      onUpdateDepartment(hotspot.id, selectedDept);
    }
  };

  const getPriorityBadgeStyle = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-600 text-white font-black shadow-xs';
      case 'HIGH':
        return 'bg-amber-600 text-white font-black shadow-xs';
      case 'MEDIUM':
        return 'bg-blue-600 text-white font-bold shadow-xs';
      default:
        return 'bg-emerald-600 text-white font-medium shadow-xs';
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'resolved':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600';
      case 'in progress':
        return 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600';
      case 'assigned':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-600';
      case 'under review':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-600';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const formattedOldestDate = hotspot.oldestComplaintAt
    ? new Date(hotspot.oldestComplaintAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {hotspot.title}
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase border ${config.badgeClass}`}>
                <Flame className="w-3.5 h-3.5 inline mr-1" />
                {hotspot.riskLevel} Risk Zone
              </span>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs tracking-wider uppercase ${getPriorityBadgeStyle(hotspot.priority)}`}>
                {hotspot.priority} Priority
              </span>
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500 shrink-0" />
              <span>{hotspot.area}</span>
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Cluster Center: {Number(hotspot.centerLat).toFixed(4)}, {Number(hotspot.centerLng).toFixed(4)} • Radius: ~{hotspot.radiusMeters}m • ID: {hotspot.id}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Risk Score</span>
              <div className="text-2xl font-black mt-0.5" style={{ color: config.color }}>
                {hotspot.riskScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Dynamic composite score</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Total Reports</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {hotspot.totalComplaints}
              </div>
              <span className="text-[10px] text-rose-500 font-bold">
                {hotspot.unresolvedComplaints} Unresolved
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Critical Issues</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {hotspot.criticalComplaints}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">High severity impact</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Oldest Issue</span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {hotspot.avgAgeDays} <span className="text-xs font-normal">days avg</span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Since {formattedOldestDate}</span>
            </div>
          </div>

          {/* Department & Operational Status */}
          <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                    Smart Routed Municipal Department
                  </span>
                  {editingDept ? (
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-blue-400 rounded-lg text-slate-900 dark:text-white"
                      >
                        {MUNICIPAL_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <Button size="sm" onClick={handleSaveDepartment} className="text-xs py-1 h-7">
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingDept(false)} className="text-xs py-1 h-7">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-black text-slate-900 dark:text-white">
                        {hotspot.assignedDepartment}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEditingDept(true)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        (Reassign)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={handleStatusChange}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${getStatusBadgeStyle(
                    selectedStatus
                  )}`}
                >
                  {HOTSPOT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Dominant Civic Issue:
                </span>
                <span className="font-black text-blue-700 dark:text-blue-400 capitalize">
                  {hotspot.dominantCategory}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  ({hotspot.categoryDistribution[hotspot.dominantCategory] || 1} occurrences)
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-400">SLA:</span>
                <span className={`font-bold ${hotspot.slaStatus === 'Action Required' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {hotspot.slaStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Risk Score Breakdown Visualizer */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-500" />
                Transparent Risk Score Breakdown (0-100 pts)
              </h4>
              <span className="text-xs font-mono font-bold" style={{ color: config.color }}>
                {config.actionText}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Issue Density</span>
                <span className="font-bold text-slate-900 dark:text-white">+{breakdown.density}</span>
                <span className="text-[9px] text-slate-400 block font-sans">max 30 pts</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Severity</span>
                <span className="font-bold text-slate-900 dark:text-white">+{breakdown.severity}</span>
                <span className="text-[9px] text-slate-400 block font-sans">max 30 pts</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Recurrence</span>
                <span className="font-bold text-slate-900 dark:text-white">+{breakdown.recurrence}</span>
                <span className="text-[9px] text-slate-400 block font-sans">max 15 pts</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Unresolved Age</span>
                <span className="font-bold text-slate-900 dark:text-white">+{breakdown.unresolvedAge}</span>
                <span className="text-[9px] text-slate-400 block font-sans">max 15 pts</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Confirmations</span>
                <span className="font-bold text-slate-900 dark:text-white">+{breakdown.confirmations}</span>
                <span className="text-[9px] text-slate-400 block font-sans">max 10 pts</span>
              </div>
            </div>
          </div>

          {/* Category Distribution Breakdown */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-500" />
              Category Concentration & Distribution
            </h4>

            <div className="space-y-2">
              {Object.entries(hotspot.categoryDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => {
                  const percent = Math.round((count / hotspot.totalComplaints) * 100);
                  const isDominant = category === hotspot.dominantCategory;

                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={`capitalize flex items-center gap-1.5 ${isDominant ? 'font-black text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {category}
                          {isDominant && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 uppercase">
                              Dominant
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {count} ({percent}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDominant ? 'bg-blue-600' : 'bg-slate-400 dark:bg-slate-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Related Contributing Complaints Section */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowRelatedIssues(!showRelatedIssues)}
              className="w-full px-5 py-4 bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Contributing Reports ({hotspot.complaints.length})
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  — View all citizen issues in this cluster
                </span>
              </div>
              {showRelatedIssues ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showRelatedIssues && (
              <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/80 max-h-80 overflow-y-auto">
                {hotspot.complaints.map((c) => {
                  const imageUrl = c.complaint_images?.[0]?.image_url || null;
                  const cSeverity = (c.severity || c.severity_score || 'Medium').toLowerCase();

                  return (
                    <div
                      key={c.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 p-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={c.title}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {c.title}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                cSeverity === 'critical'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                                  : cSeverity === 'high'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {c.severity || 'Medium'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                              {c.category}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {c.address || 'Location Tagged'}
                          </p>

                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center gap-0.5">
                              <ThumbsUp className="w-2.5 h-2.5" /> {c.upvotes || 1} upvotes
                            </span>
                            <span>•</span>
                            <span>Status: {c.status || 'Pending'}</span>
                          </div>
                        </div>
                      </div>

                      {onSelectComplaint && (
                        <button
                          type="button"
                          onClick={() => onSelectComplaint(c)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors shrink-0"
                        >
                          View Details &rarr;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <span className="text-xs text-slate-400 font-mono">
            Last analyzed: {new Date(hotspot.lastUpdated).toLocaleTimeString()}
          </span>

          <Button onClick={onClose} className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-5">
            Close Panel
          </Button>
        </div>

      </div>
    </div>
  );
}
