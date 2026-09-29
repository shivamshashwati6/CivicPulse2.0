import { useState, useEffect } from 'react';
import { issueService } from '../services/issueService';

export function useIssues(initialFilters = {}) {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadIssues = async (filters = initialFilters) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await issueService.fetchAllComplaints(filters);
      if (fetchErr) throw fetchErr;
      setIssues(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  return { issues, loading, error, refresh: loadIssues };
}
