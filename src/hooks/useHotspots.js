import { useState, useMemo, useCallback } from 'react';
import { hotspotService, HOTSPOT_CONFIG } from '../services/hotspotService';

/**
 * Custom React hook for Hotspot Detection & Management
 * @param {Array} complaints - List of complaint records
 * @param {Object} initialOptions - Initial radius, minComplaints, etc.
 */
export function useHotspots(complaints = [], initialOptions = {}) {
  const [radiusMeters, setRadiusMeters] = useState(
    initialOptions.radiusMeters || HOTSPOT_CONFIG.DEFAULT_RADIUS_METERS
  );
  const [minComplaints, setMinComplaints] = useState(
    initialOptions.minComplaints || HOTSPOT_CONFIG.DEFAULT_MIN_COMPLAINTS
  );

  // Filters state
  const [filterRisk, setFilterRisk] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Selected hotspot for details modal
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  // Local overrides for status / department assignments made in session
  const [overrides, setOverrides] = useState({});

  // 1. Detect all hotspots from complaints
  const allHotspots = useMemo(() => {
    const raw = hotspotService.detectHotspots(complaints, {
      radiusMeters,
      minComplaints,
    });

    // Apply any local admin overrides (status, assigned department)
    return raw.map((h) => {
      const override = overrides[h.id];
      if (override) {
        return {
          ...h,
          status: override.status || h.status,
          assignedDepartment: override.assignedDepartment || h.assignedDepartment,
        };
      }
      return h;
    });
  }, [complaints, radiusMeters, minComplaints, overrides]);

  // 2. Filter hotspots according to active controls
  const filteredHotspots = useMemo(() => {
    return hotspotService.filterHotspots(allHotspots, {
      riskLevel: filterRisk,
      department: filterDepartment,
      status: filterStatus,
      category: filterCategory,
      search: filterSearch,
    });
  }, [allHotspots, filterRisk, filterDepartment, filterStatus, filterCategory, filterSearch]);

  // 3. Summary metrics
  const summaryMetrics = useMemo(() => {
    return hotspotService.getHotspotSummaryMetrics(allHotspots);
  }, [allHotspots]);

  // 4. Update hotspot status
  const updateStatus = useCallback(async (hotspotId, newStatus) => {
    setOverrides((prev) => ({
      ...prev,
      [hotspotId]: {
        ...(prev[hotspotId] || {}),
        status: newStatus,
      },
    }));

    setSelectedHotspot((prev) => {
      if (prev && prev.id === hotspotId) {
        return { ...prev, status: newStatus };
      }
      return prev;
    });

    await hotspotService.updateHotspotStatus(hotspotId, newStatus);
  }, []);

  // 5. Update hotspot department
  const updateDepartment = useCallback(async (hotspotId, newDepartment) => {
    setOverrides((prev) => ({
      ...prev,
      [hotspotId]: {
        ...(prev[hotspotId] || {}),
        assignedDepartment: newDepartment,
      },
    }));

    setSelectedHotspot((prev) => {
      if (prev && prev.id === hotspotId) {
        return { ...prev, assignedDepartment: newDepartment };
      }
      return prev;
    });

    await hotspotService.updateHotspotDepartment(hotspotId, newDepartment);
  }, []);

  return {
    allHotspots,
    filteredHotspots,
    summaryMetrics,
    radiusMeters,
    setRadiusMeters,
    minComplaints,
    setMinComplaints,
    filterRisk,
    setFilterRisk,
    filterDepartment,
    setFilterDepartment,
    filterStatus,
    setFilterStatus,
    filterCategory,
    setFilterCategory,
    filterSearch,
    setFilterSearch,
    selectedHotspot,
    setSelectedHotspot,
    updateStatus,
    updateDepartment,
  };
}
