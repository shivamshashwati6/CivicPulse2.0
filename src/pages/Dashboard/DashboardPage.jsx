import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, CheckCircle2, Clock, AlertTriangle, FileText, ArrowUpRight, MapPin, Calendar, Tag, Layers, Trash2, Loader2, AlertCircle, ThumbsUp } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { calculateUrbanImpactScore } from '../../utils/helpers';
import { issueService } from '../../services/issueService';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [votedIds, setVotedIds] = useState(new Set());
  const [upvotingId, setUpvotingId] = useState(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Safely resolve active user session ID using Supabase getSession
      let currentUserId = user?.id;
      if (!currentUserId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          currentUserId = session?.user?.id;
        } catch (e) {
          console.warn('Dashboard auth session fetch notice:', e);
        }
      }

      let fetchedComplaints = [];
      if (currentUserId) {
        const { data } = await issueService.fetchUserComplaints(currentUserId);
        fetchedComplaints = data || [];
      } else {
        // Fallback gracefully if no user session exists
        const { data } = await issueService.fetchAllComplaints();
        fetchedComplaints = data || [];
      }

      setComplaints(fetchedComplaints);

      if (currentUserId) {
        const userVotesSet = await issueService.getUserUpvotedIssueIds(currentUserId);
        setVotedIds(userVotesSet);
      }
    } catch (err) {
      console.error('Error fetching citizen dashboard complaints:', err);
      setComplaints([]);
    } finally {
      // Ensure skeleton loaders unmount regardless of fetch success or empty arrays
      setLoading(false);
    }
  }, [user]);

  const handleUpvote = async (complaintId) => {
    if (!complaintId || upvotingId === complaintId) return;

    let activeUserId = user?.id;
    if (!activeUserId) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        activeUserId = session?.user?.id;
      } catch (e) {
        console.warn('Auth session check notice:', e);
      }
    }

    if (!activeUserId) {
      toast.info('Please sign in to support this issue ("I Face This Too").');
      return;
    }

    if (votedIds.has(complaintId)) {
      toast.info('You have already supported this issue ("I Face This Too").');
      return;
    }

    // Optimistic UI update
    setUpvotingId(complaintId);
    setComplaints((prev) =>
      prev.map((c) => (c.id === complaintId ? { ...c, upvotes: (c.upvotes || 1) + 1 } : c))
    );
    setVotedIds((prev) => new Set(prev).add(complaintId));

    try {
      const res = await issueService.upvoteComplaint(complaintId, activeUserId);

      if (res.alreadyVoted) {
        toast.info(res.message || 'You have already supported this issue.');
        if (typeof res.upvotes === 'number') {
          setComplaints((prev) =>
            prev.map((c) => (c.id === complaintId ? { ...c, upvotes: res.upvotes } : c))
          );
        }
      } else if (res.success) {
        toast.success('Thank you for supporting this issue ("I Face This Too")!');
        if (typeof res.upvotes === 'number') {
          setComplaints((prev) =>
            prev.map((c) => (c.id === complaintId ? { ...c, upvotes: res.upvotes } : c))
          );
        }
      } else {
        // Revert on error
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.delete(complaintId);
          return next;
        });
        setComplaints((prev) =>
          prev.map((c) => (c.id === complaintId ? { ...c, upvotes: Math.max(1, (c.upvotes || 1) - 1) } : c))
        );
        toast.error(res.error?.message || 'Failed to submit vote. Please try again.');
      }
    } catch (err) {
      console.error('Upvote error:', err);
      // Revert optimistic update
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.delete(complaintId);
        return next;
      });
      setComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? { ...c, upvotes: Math.max(1, (c.upvotes || 1) - 1) } : c))
      );
      toast.error('Network error during upvote.');
    } finally {
      setUpvotingId(null);
    }
  };

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      if (active) {
        await loadDashboardData();
      }
    };

    fetchData();

    const currentUserId = user?.id;

    const channel = supabase
      .channel(`citizen-dashboard-realtime-${currentUserId || 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        async (payload) => {
          console.log('Realtime event in Citizen Dashboard:', payload);

          if (payload.eventType === 'INSERT' && payload.new?.id) {
            const isUserComplaint = !currentUserId || payload.new.user_id === currentUserId;
            if (isUserComplaint) {
              try {
                const { data: newItem } = await issueService.fetchIssueById(payload.new.id);
                const itemToAdd = newItem || payload.new;
                setComplaints((prev) => {
                  if (prev.some((c) => c.id === itemToAdd.id)) {
                    return prev.map((c) => (c.id === itemToAdd.id ? { ...c, ...itemToAdd } : c));
                  }
                  return [itemToAdd, ...prev];
                });
              } catch {
                setComplaints((prev) => {
                  if (prev.some((c) => c.id === payload.new.id)) return prev;
                  return [payload.new, ...prev];
                });
              }
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
        if (err) {
          console.error('Citizen Dashboard Realtime error:', err);
        }
      });

    const handleFocus = () => {
      loadDashboardData();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [loadDashboardData, user?.id]);

  const handleDeleteComplaint = async (complaintId) => {
    // Optimistic UI deletion
    setComplaints((prev) => prev.filter((c) => c.id !== complaintId));
    setConfirmDeleteId(null);

    setDeletingId(complaintId);
    try {
      // Execute direct delete query against Supabase complaints table
      const { error } = await supabase.from('complaints').delete().eq('id', complaintId);

      // Clean local queue backup as well
      issueService.deleteComplaint(complaintId, user?.id);

      if (error) {
        console.error('Supabase DB delete complaint error:', error);
        toast.error(`Database delete warning: ${error.message || 'Permission denied'}`);
      } else {
        toast.success('Report deleted successfully.');
      }
    } catch (err) {
      console.error('Exception during complaint deletion:', err);
      toast.error('Deletion error occurred.');
    } finally {
      setDeletingId(null);
    }
  };

  // Deduplicate complaints list using a unique key check
  const uniqueComplaints = Array.from(
    (complaints || []).reduce((acc, item) => {
      if (item && item.id && !acc.has(item.id)) {
        acc.set(item.id, item);
      }
      return acc;
    }, new Map()).values()
  );

  // Compute metric totals from deduplicated complaints
  const totalReports = uniqueComplaints.length;
  const pendingCount = uniqueComplaints.filter(
    (c) => (c.status || '').toLowerCase() === 'pending'
  ).length;
  const inProgressCount = uniqueComplaints.filter(
    (c) => (c.status || '').toLowerCase() === 'in progress'
  ).length;
  const resolvedCount = uniqueComplaints.filter(
    (c) => (c.status || '').toLowerCase() === 'resolved'
  ).length;

  const getStatusBadgeVariant = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'resolved':
        return 'success';
      case 'in progress':
        return 'info';
      case 'pending':
      default:
        return 'warning';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <PageHeader
        title="Citizen Overview Dashboard"
        description="Monitor your submitted reports, municipal updates, and resolution status."
        action={
          <Link to="/report">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Report
            </Button>
          </Link>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse p-6 space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded w-1/4"></div>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card className="border-l-4 border-l-blue-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Reports</p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-blue-400 mt-1">{totalReports}</h3>
                </div>
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/80 dark:border-blue-500/30">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Review</p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-amber-400 mt-1">{pendingCount}</h3>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-600/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/80 dark:border-amber-500/30">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-indigo-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">In Progress</p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-indigo-300 mt-1">{inProgressCount}</h3>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/80 dark:border-indigo-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-emerald-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resolved</p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-emerald-400 mt-1">{resolvedCount}</h3>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Recent Submissions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <CardTitle>Recent Issue Reports</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your live complaints ordered by newest first</p>
          </div>
          {uniqueComplaints.length > 0 && (
            <Link to="/track" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center">
              View All Reports <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          )}
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            /* Loading Skeleton */
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-lg shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-900 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : uniqueComplaints.length === 0 ? (
            /* Empty State */
            <div className="py-12 text-center">
              <div className="max-w-xs mx-auto space-y-3">
                <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                  <FileText className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">No Reports Submitted Yet</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  When you submit a civic issue report, it will appear here with live status and municipal resolution tracking.
                </p>
                <Link to="/report">
                  <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                    <PlusCircle className="w-4 h-4 mr-1.5" />
                    Submit Your First Report
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* Real User Complaints List */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {uniqueComplaints.map((item) => {
                const imageUrl = item.complaint_images?.[0]?.image_url;
                const formattedDate = new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                const isConfirming = confirmDeleteId === item.id;
                const isDeleting = deletingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative flex flex-col bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:dark:border-blue-500/40 hover:dark:shadow-[0_0_20px_rgba(59,130,246,0.15)] rounded-2xl overflow-hidden transition-all duration-300 group"
                  >
                    {/* Confirmation Overlay when Delete is Clicked */}
                    {isConfirming && (
                      <div className="absolute inset-0 z-20 bg-slate-900/90 backdrop-blur-xs p-6 flex flex-col items-center justify-center text-center space-y-3 text-white transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold">Delete Report?</p>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            This action cannot be undone. Are you sure you want to remove this complaint?
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isDeleting}
                            className="bg-transparent text-slate-200 border-slate-700 hover:bg-slate-800 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDeleteComplaint(item.id)}
                            disabled={isDeleting}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Deleting...
                              </>
                            ) : (
                              'Confirm Delete'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Complaint Image Header */}
                    <div className="h-44 w-full bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 space-y-1">
                          <Layers className="w-8 h-8" />
                          <span className="text-[11px] font-medium">No Image Uploaded</span>
                        </div>
                      )}

                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(item.status)} className="font-semibold shadow-xs">
                          {item.status || 'Pending'}
                        </Badge>

                        {/* Delete Button (Trash Icon) */}
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="p-1.5 rounded-lg bg-slate-900/70 hover:bg-rose-600 text-white backdrop-blur-xs transition-colors shadow-xs cursor-pointer"
                          title="Delete Complaint"
                          aria-label="Delete report"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Complaint Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1">
                          {item.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span className="capitalize font-medium text-slate-700 dark:text-slate-300">{item.category}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formattedDate}</span>
                          </div>
                          <span>•</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${calculateUrbanImpactScore(item, uniqueComplaints).colorClass}`}>
                            ⚡ Urban Impact: {calculateUrbanImpactScore(item, uniqueComplaints).category.replace(' Impact', '')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Footer Details */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate">{item.address || 'Location Tagged'}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUpvote(item.id)}
                          disabled={upvotingId === item.id || votedIds.has(item.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            votedIds.has(item.id)
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400'
                          }`}
                        >
                          {upvotingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <ThumbsUp className={`w-3.5 h-3.5 ${votedIds.has(item.id) ? 'fill-current text-blue-600 dark:text-blue-400' : ''}`} />
                          )}
                          <span>{votedIds.has(item.id) ? 'Supported' : 'I Face This Too'}</span>
                          <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-200/80 dark:bg-slate-700 text-[10px] font-mono">
                            {item.upvotes || 1}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
