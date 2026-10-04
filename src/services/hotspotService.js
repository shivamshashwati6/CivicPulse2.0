/**
 * Hotspot Detection & Management Service for CivicPulse 2.0
 * Provides automatic geographic proximity clustering, risk scoring, dominant issue detection,
 * and smart municipal department routing.
 */

import { supabase } from './supabaseClient';
import { departmentRoutingService } from './departmentRouting';
import { hotspotScoringService, RISK_LEVELS } from './hotspotScoring';

/**
 * Central Configuration for Hotspot Detection
 * Configurable in one location; easily adjustable by admin controls.
 */
export const HOTSPOT_CONFIG = {
  DEFAULT_RADIUS_METERS: 500,
  DEFAULT_MIN_COMPLAINTS: 3,
  MIN_RADIUS_METERS: 100,
  MAX_RADIUS_METERS: 2500,
  MIN_COMPLAINTS_RANGE: [2, 10],
};

export const HOTSPOT_STATUSES = [
  'Detected',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
];

/**
 * Calculate accurate geographic distance in meters between two coordinates using Haversine formula
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate a stable, deterministic identifier for a geographic cluster
 */
function generateStableHotspotId(centerLat, centerLng, seedComplaintId) {
  const latKey = Number(centerLat).toFixed(3).replace('.', 'p');
  const lngKey = Number(centerLng).toFixed(3).replace('.', 'p');
  const shortSeed = seedComplaintId ? seedComplaintId.slice(0, 6) : 'zone';
  return `HS-${latKey}-${lngKey}-${shortSeed}`;
}

export const hotspotService = {
  config: { ...HOTSPOT_CONFIG },

  /**
   * Update runtime clustering configuration
   */
  updateConfig(newConfig = {}) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  },

  /**
   * Reset configuration to default values
   */
  resetConfig() {
    this.config = { ...HOTSPOT_CONFIG };
    return this.config;
  },

  /**
   * Detect urban hotspots from complaint records using geographic proximity clustering
   * @param {Array} complaints - Raw complaints list
   * @param {Object} options - Clustering options (radiusMeters, minComplaints, categoryFilter, statusFilter)
   * @returns {Array} List of detected Hotspot objects
   */
  detectHotspots(complaints = [], options = {}) {
    if (!Array.isArray(complaints) || complaints.length === 0) {
      return [];
    }

    const radiusMeters = options.radiusMeters || this.config.DEFAULT_RADIUS_METERS;
    const minComplaints = options.minComplaints || this.config.DEFAULT_MIN_COMPLAINTS;
    const categoryFilter = options.categoryFilter || 'all';
    const departmentFilter = options.departmentFilter || 'all';

    // 1. Filter complaints with valid geographic coordinates
    const geoComplaints = complaints.filter((c) => {
      if (!c || c.latitude === null || c.latitude === undefined || c.longitude === null || c.longitude === undefined) {
        return false;
      }
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return false;
      }

      if (categoryFilter !== 'all' && (c.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      return true;
    });

    if (geoComplaints.length < minComplaints) {
      return [];
    }

    // 2. Spatial Clustering using Proximity Grid / Density Seed
    // Sort complaints by creation date (newest first) or severity to form stable clusters
    const sorted = [...geoComplaints].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    const clusters = [];
    const assignedIds = new Set();

    for (let i = 0; i < sorted.length; i++) {
      const candidate = sorted[i];
      if (assignedIds.has(candidate.id)) continue;

      const cLat = Number(candidate.latitude);
      const cLng = Number(candidate.longitude);

      // Find all neighbors within radiusMeters that are not yet clustered
      const neighbors = [];
      for (let j = 0; j < sorted.length; j++) {
        const other = sorted[j];
        if (assignedIds.has(other.id)) continue;

        const oLat = Number(other.latitude);
        const oLng = Number(other.longitude);
        const dist = calculateDistanceMeters(cLat, cLng, oLat, oLng);

        if (dist <= radiusMeters) {
          neighbors.push(other);
        }
      }

      // Check if cluster meets minimum complaints threshold
      if (neighbors.length >= minComplaints) {
        neighbors.forEach((item) => assignedIds.add(item.id));

        // Calculate dynamic cluster centroid
        const avgLat = neighbors.reduce((acc, curr) => acc + Number(curr.latitude), 0) / neighbors.length;
        const avgLng = neighbors.reduce((acc, curr) => acc + Number(curr.longitude), 0) / neighbors.length;

        clusters.push({
          seedId: candidate.id,
          centerLat: avgLat,
          centerLng: avgLng,
          complaints: neighbors,
          radiusMeters,
        });
      }
    }

    // 3. Enrich each cluster with scoring, dominant issue, and department routing
    const enrichedHotspots = clusters.map((cluster, idx) => {
      const clusterComplaints = cluster.complaints;
      const totalCount = clusterComplaints.length;

      // Category Distribution & Dominant Category
      const categoryDistribution = {};
      clusterComplaints.forEach((c) => {
        const cat = (c.category || 'other').toLowerCase();
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
      });

      const sortedCategories = Object.entries(categoryDistribution).sort((a, b) => b[1] - a[1]);
      const dominantCategory = sortedCategories[0]?.[0] || 'other';

      // Severity Distribution
      const severityDistribution = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
      clusterComplaints.forEach((c) => {
        const sev = (c.severity || c.severity_score || 'Medium').toLowerCase();
        if (severityDistribution[sev] !== undefined) {
          severityDistribution[sev] += 1;
        } else {
          severityDistribution.medium += 1;
        }
      });

      // Unresolved & Resolved Complaints
      let unresolvedCount = 0;
      let inProgressCount = 0;
      let resolvedCount = 0;
      clusterComplaints.forEach((c) => {
        const st = (c.status || 'pending').toLowerCase();
        if (st === 'resolved' || st === 'closed') {
          resolvedCount += 1;
        } else if (st === 'in progress') {
          inProgressCount += 1;
          unresolvedCount += 1;
        } else {
          unresolvedCount += 1;
        }
      });

      // Oldest Complaint & Average Complaint Age
      const timestamps = clusterComplaints
        .map((c) => (c.created_at ? new Date(c.created_at).getTime() : null))
        .filter(Boolean);
      const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
      const newestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
      const oldestComplaintAt = new Date(oldestTimestamp).toISOString();

      const now = Date.now();
      const agesHours = timestamps.map((t) => (now - t) / (1000 * 60 * 60));
      const avgAgeHours = agesHours.length > 0 ? agesHours.reduce((a, b) => a + b, 0) / agesHours.length : 0;
      const avgAgeDays = Number((avgAgeHours / 24).toFixed(1));

      // SLA Status
      let slaStatus = 'On Track';
      if (unresolvedCount === 0) {
        slaStatus = 'Resolved';
      } else if (severityDistribution.critical > 0 || avgAgeHours > 24) {
        slaStatus = 'Action Required';
      }

      // Smart Municipal Department Routing
      const assignedDepartment = departmentRoutingService.getDepartmentForCategory(dominantCategory);

      // Hotspot Risk Score & Priority
      const scoreResult = hotspotScoringService.calculateScore({
        complaints: clusterComplaints,
        radiusMeters,
      });

      // Operational Hotspot Status
      let operationalStatus = 'Detected';
      if (unresolvedCount === 0) {
        operationalStatus = 'Resolved';
      } else if (inProgressCount > 0) {
        operationalStatus = 'In Progress';
      } else if (assignedDepartment !== 'Review Required') {
        operationalStatus = 'Assigned';
      }

      // Derive human-readable area name from the complaints
      const bestAddressComplaint = clusterComplaints.find(
        (c) => c.address && !c.address.startsWith('Selected map location')
      );
      const area =
        bestAddressComplaint?.locality ||
        bestAddressComplaint?.city ||
        bestAddressComplaint?.road ||
        bestAddressComplaint?.address ||
        `Urban Sector (${cluster.centerLat.toFixed(3)}, ${cluster.centerLng.toFixed(3)})`;

      const hotspotId = generateStableHotspotId(cluster.centerLat, cluster.centerLng, cluster.seedId);

      return {
        id: hotspotId,
        index: idx + 1,
        title: `Hotspot #${String(idx + 1).padStart(2, '0')}`,
        area,
        center: [cluster.centerLat, cluster.centerLng],
        centerLat: cluster.centerLat,
        centerLng: cluster.centerLng,
        radiusMeters,
        // Scoring & Classification
        riskScore: scoreResult.score,
        riskLevel: scoreResult.riskLevel,
        priority: scoreResult.priority,
        scoringConfig: scoreResult.config,
        scoreBreakdown: scoreResult.breakdown,
        // Metrics
        totalComplaints: totalCount,
        unresolvedComplaints: unresolvedCount,
        resolvedComplaints: resolvedCount,
        criticalComplaints: severityDistribution.critical,
        // Categories & Routing
        dominantCategory,
        categoryDistribution,
        categoriesCount: Object.keys(categoryDistribution).length,
        severityDistribution,
        assignedDepartment,
        departmentStyle: departmentRoutingService.getDepartmentStyle(assignedDepartment),
        // Age & SLA
        oldestComplaintAt,
        newestComplaintAt: new Date(newestTimestamp).toISOString(),
        avgAgeHours: Math.round(avgAgeHours),
        avgAgeDays,
        slaStatus,
        status: operationalStatus,
        lastUpdated: new Date().toISOString(),
        // Underlying complaints
        complaints: clusterComplaints,
      };
    });

    // 4. Sort by highest Risk Score first (descending)
    let sortedHotspots = enrichedHotspots.sort((a, b) => b.riskScore - a.riskScore);

    // Filter by department if requested
    if (departmentFilter !== 'all') {
      sortedHotspots = sortedHotspots.filter(
        (h) => (h.assignedDepartment || '').toLowerCase() === departmentFilter.toLowerCase()
      );
    }

    return sortedHotspots;
  },

  /**
   * Compute aggregate summary metrics from active hotspots
   */
  getHotspotSummaryMetrics(hotspots = []) {
    const totalActive = hotspots.filter((h) => h.status !== 'Resolved').length;
    const critical = hotspots.filter((h) => h.riskLevel === RISK_LEVELS.CRITICAL && h.status !== 'Resolved').length;
    const high = hotspots.filter((h) => h.riskLevel === RISK_LEVELS.HIGH && h.status !== 'Resolved').length;
    const moderate = hotspots.filter((h) => h.riskLevel === RISK_LEVELS.MODERATE && h.status !== 'Resolved').length;
    const low = hotspots.filter((h) => h.riskLevel === RISK_LEVELS.LOW && h.status !== 'Resolved').length;

    return {
      total: hotspots.length,
      totalActive,
      critical,
      high,
      moderate,
      low,
    };
  },

  /**
   * Filter hotspots by user criteria (risk level, department, status, search query)
   */
  filterHotspots(hotspots = [], filters = {}) {
    return hotspots.filter((h) => {
      if (filters.riskLevel && filters.riskLevel !== 'all') {
        if (h.riskLevel.toLowerCase() !== filters.riskLevel.toLowerCase()) return false;
      }
      if (filters.department && filters.department !== 'all') {
        if (h.assignedDepartment.toLowerCase() !== filters.department.toLowerCase()) return false;
      }
      if (filters.status && filters.status !== 'all') {
        if (h.status.toLowerCase() !== filters.status.toLowerCase()) return false;
      }
      if (filters.category && filters.category !== 'all') {
        if (h.dominantCategory.toLowerCase() !== filters.category.toLowerCase()) return false;
      }
      if (filters.search && filters.search.trim()) {
        const query = filters.search.trim().toLowerCase();
        const matchesArea = h.area.toLowerCase().includes(query);
        const matchesId = h.id.toLowerCase().includes(query);
        const matchesTitle = h.title.toLowerCase().includes(query);
        const matchesDept = h.assignedDepartment.toLowerCase().includes(query);
        const matchesCat = h.dominantCategory.toLowerCase().includes(query);
        if (!matchesArea && !matchesId && !matchesTitle && !matchesDept && !matchesCat) {
          return false;
        }
      }
      return true;
    });
  },

  /**
   * Update hotspot operational status
   * Supports local state and persists to Supabase if table exists
   */
  async updateHotspotStatus(hotspotId, newStatus) {
    try {
      const { data, error } = await supabase
        .from('hotspots')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', hotspotId)
        .select();

      return { data, error: error || null };
    } catch (err) {
      console.warn('Hotspot DB status update notice (fallback to local state):', err);
      return { data: null, error: err };
    }
  },

  /**
   * Update hotspot assigned department
   */
  async updateHotspotDepartment(hotspotId, newDepartment) {
    try {
      const { data, error } = await supabase
        .from('hotspots')
        .update({ assigned_department: newDepartment, updated_at: new Date().toISOString() })
        .eq('id', hotspotId)
        .select();

      return { data, error: error || null };
    } catch (err) {
      console.warn('Hotspot DB department update notice (fallback to local state):', err);
      return { data: null, error: err };
    }
  },
};
