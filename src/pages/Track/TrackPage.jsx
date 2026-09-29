import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, PlusCircle, Calendar, Tag, FileText, Loader2, ThumbsUp } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ISSUE_CATEGORIES } from '../../utils/constants';
import { calculateUrbanImpactScore } from '../../utils/helpers';
import { issueService } from '../../services/issueService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../services/supabaseClient';

export function TrackPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [votedIds, setVotedIds] = useState(new Set());
  const [upvotingId, setUpvotingId] = useState(null);

  const loadComplaints = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await issueService.fetchUserComplaints(user.id);
    setComplaints(data || []);
    
    if (user?.id) {
      const userVotesSet = await issueService.getUserUpvotedIssueIds(user.id);
      setVotedIds(userVotesSet);
    }
    setLoading(false);
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
    loadComplaints();

    const currentUserId = user?.id;

    const channel = supabase
      .channel(`citizen-track-realtime-${currentUserId || 'guest'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new?.id) {
            const isUserComplaint = !currentUserId || payload.new.user_id === currentUserId;
            if (isUserComplaint) {
              try {
                const { data: newItem } = await issueService.fetchIssueById(payload.new.id);
                const itemToAdd = newItem || payload.new;
                setComplaints((prev) => {
                  if (prev.some((c) => c.id === itemToAdd.id)) return prev;
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
          console.error('Track Page Realtime error:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadComplaints, user?.id]);

  // Deduplicate complaints by unique complaint ID
  const uniqueComplaints = Array.from(
    (complaints || []).reduce((acc, item) => {
      if (item && item.id && !acc.has(item.id)) {
        acc.set(item.id, item);
      }
      return acc;
    }, new Map()).values()
  );

  const filteredComplaints = uniqueComplaints.filter((c) => {
    const matchesSearch =
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-slate-900 dark:text-white transition-colors duration-300">
      <PageHeader
        title="My Complaints & Issue Tracking"
        description="Track the status, municipal progress, and updates for your submitted civic reports."
        action={
          <Link to="/report">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20">
              <PlusCircle className="w-4 h-4 mr-2" />
              Report New Issue
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Input
            placeholder="Search your reports by title, location, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
          >
            <option value="all">All Categories</option>
            {ISSUE_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading your reported issues...</p>
          </div>
        </Card>
      ) : filteredComplaints.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Complaints Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No complaints match your current search or category filter.'
                  : 'You have not submitted any civic issue reports yet.'}
              </p>
              <Link to="/report">
                <Button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Submit Your First Report
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredComplaints.map((item) => {
            const firstImage = item.complaint_images?.[0]?.image_url;
            return (
              <Card key={item.id} className="overflow-hidden p-0 hover:shadow-lg transition-all border border-slate-200/80 dark:border-slate-800">
                {firstImage && (
                  <div className="h-48 w-full bg-slate-100 dark:bg-slate-950 overflow-hidden relative">
                    <img
                      src={firstImage}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3">
                      <Badge variant={getStatusBadgeVariant(item.status)} className="shadow-xs font-semibold">
                        {item.status || 'Pending'}
                      </Badge>
                    </div>
                  </div>
                )}
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">{item.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium capitalize">{item.category}</span>
                        <span>•</span>
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${calculateUrbanImpactScore(item, uniqueComplaints).colorClass}`}>
                          ⚡ Urban Impact: {calculateUrbanImpactScore(item, uniqueComplaints).category.replace(' Impact', '')}
                        </span>
                      </div>
                    </div>
                    {!firstImage && (
                      <Badge variant={getStatusBadgeVariant(item.status)} className="font-semibold">
                        {item.status || 'Pending'}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate max-w-[180px]">
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
