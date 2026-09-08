/**
 * SLA & Response Analytics Service
 * 
 * Provides centralized, deterministic SLA calculations and performance analytics
 * based on actual Supabase complaint creation timestamps and status_history audit logs.
 */

import { MUNICIPAL_DEPARTMENTS, ISSUE_CATEGORIES } from '../utils/constants.js';
import { getRecommendedDepartment } from '../utils/helpers.js';

/**
 * Centralized SLA Thresholds (in hours) based on priority / severity
 */
export const SLA_THRESHOLDS_HOURS = {
  Critical: 4,
  High: 12,
  Medium: 24,
  Low: 48,
};

/**
 * Format duration in hours into a human-readable string (e.g. "2h 18m", "45m", "N/A")
 */
export function formatDurationHours(hours) {
  if (hours === null || hours === undefined || isNaN(hours) || hours < 0) {
    return 'N/A';
  }
  
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes === 0) return '0m';

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Deterministically resolve SLA threshold in hours for a single complaint
 */
export function getSlaThresholdHours(complaint) {
  if (!complaint) return SLA_THRESHOLDS_HOURS.Medium;

  const rawKey = complaint.priority || complaint.severity || complaint.severity_score || 'Medium';
  const normalizedKey =
    String(rawKey).trim().charAt(0).toUpperCase() + String(rawKey).trim().slice(1).toLowerCase();

  return SLA_THRESHOLDS_HOURS[normalizedKey] || SLA_THRESHOLDS_HOURS.Medium;
}

/**
 * Extract response time, resolution time, and SLA compliance status for a single complaint
 */
export function getComplaintMetrics(complaint, referenceTime = new Date()) {
  if (!complaint || !complaint.created_at) {
    return {
      responseTimeHours: null,
      resolutionTimeHours: null,
      firstInProgressAt: null,
      firstResolvedAt: null,
      thresholdHours: SLA_THRESHOLDS_HOURS.Medium,
      currentAgeHours: 0,
      isResolved: false,
      isSlaMet: false,
      isSlaBreached: false,
      slaStatusLabel: 'N/A',
    };
  }

  const createdMs = new Date(complaint.created_at).getTime();
  const refMs = new Date(referenceTime).getTime();
  const thresholdHours = getSlaThresholdHours(complaint);
  const currentAgeHours = Math.max(0, (refMs - createdMs) / (1000 * 60 * 60));

  // Extract status_history array
  const history = Array.isArray(complaint.status_history) ? [...complaint.status_history] : [];
  
  // Sort history chronologically (ascending by updated_at)
  history.sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0));

  // 1. Find FIRST transition to "In Progress"
  const firstInProgressEntry = history.find(
    (h) => (h.new_status || '').toLowerCase() === 'in progress'
  );

  let responseTimeHours = null;
  let firstInProgressAt = null;

  if (firstInProgressEntry && firstInProgressEntry.updated_at) {
    firstInProgressAt = firstInProgressEntry.updated_at;
    const inProgressMs = new Date(firstInProgressEntry.updated_at).getTime();
    responseTimeHours = Math.max(0, (inProgressMs - createdMs) / (1000 * 60 * 60));
  } else if ((complaint.status || '').toLowerCase() === 'in progress' && complaint.updated_at) {
    // Fallback if status is In Progress but audit log missing
    const updatedMs = new Date(complaint.updated_at).getTime();
    if (updatedMs > createdMs) {
      responseTimeHours = Math.max(0, (updatedMs - createdMs) / (1000 * 60 * 60));
      firstInProgressAt = complaint.updated_at;
    }
  }

  // 2. Find FIRST transition to "Resolved"
  const firstResolvedEntry = history.find(
    (h) => (h.new_status || '').toLowerCase() === 'resolved'
  );

  let resolutionTimeHours = null;
  let firstResolvedAt = null;

  if (firstResolvedEntry && firstResolvedEntry.updated_at) {
    firstResolvedAt = firstResolvedEntry.updated_at;
    const resolvedMs = new Date(firstResolvedEntry.updated_at).getTime();
    resolutionTimeHours = Math.max(0, (resolvedMs - createdMs) / (1000 * 60 * 60));
  } else if ((complaint.status || '').toLowerCase() === 'resolved' && complaint.updated_at) {
    // Fallback if status is Resolved but audit log missing
    const updatedMs = new Date(complaint.updated_at).getTime();
    if (updatedMs > createdMs) {
      resolutionTimeHours = Math.max(0, (updatedMs - createdMs) / (1000 * 60 * 60));
      firstResolvedAt = complaint.updated_at;
    }
  }

  // 3. Determine SLA Status
  const currentStatus = (complaint.status || '').toLowerCase();
  const isResolved = currentStatus === 'resolved' || resolutionTimeHours !== null;

  let isSlaMet = false;
  let isSlaBreached = false;
  let slaStatusLabel = 'Within SLA';

  if (isResolved) {
    if (resolutionTimeHours !== null) {
      if (resolutionTimeHours <= thresholdHours) {
        isSlaMet = true;
        isSlaBreached = false;
        slaStatusLabel = 'SLA Met';
      } else {
        isSlaMet = false;
        isSlaBreached = true;
        slaStatusLabel = 'SLA Breached';
      }
    } else {
      // Resolved with 0/unknown resolution delta
      isSlaMet = true;
      slaStatusLabel = 'SLA Met';
    }
  } else {
    // Unresolved (Pending or In Progress)
    if (currentAgeHours > thresholdHours) {
      isSlaMet = false;
      isSlaBreached = true;
      slaStatusLabel = 'SLA Breached';
    } else {
      isSlaMet = true;
      isSlaBreached = false;
      slaStatusLabel = 'Within SLA';
    }
  }

  return {
    responseTimeHours,
    resolutionTimeHours,
    firstInProgressAt,
    firstResolvedAt,
    thresholdHours,
    currentAgeHours,
    isResolved,
    isSlaMet,
    isSlaBreached,
    slaStatusLabel,
  };
}

/**
 * Calculate dynamic overall KPI analytics for a set of complaints
 */
export function calculateSlaAnalytics(complaints = [], referenceTime = new Date()) {
  if (!Array.isArray(complaints) || complaints.length === 0) {
    return {
      totalComplaints: 0,
      resolvedCount: 0,
      pendingCount: 0,
      inProgressCount: 0,
      avgResponseTimeHours: null,
      avgResponseTimeFormatted: 'N/A',
      avgResolutionTimeHours: null,
      avgResolutionTimeFormatted: 'N/A',
      slaCompliancePct: null,
      slaComplianceFormatted: 'N/A',
      slaBreachesCount: 0,
      slaMetCount: 0,
    };
  }

  let totalComplaints = complaints.length;
  let resolvedCount = 0;
  let pendingCount = 0;
  let inProgressCount = 0;

  const validResponseTimes = [];
  const validResolutionTimes = [];

  let slaMetCount = 0;
  let slaBreachesCount = 0;
  let evaluatedSlaCount = 0;

  complaints.forEach((c) => {
    const status = (c.status || '').toLowerCase();
    if (status === 'resolved') resolvedCount++;
    else if (status === 'in progress') inProgressCount++;
    else pendingCount++;

    const metrics = getComplaintMetrics(c, referenceTime);

    if (metrics.responseTimeHours !== null) {
      validResponseTimes.push(metrics.responseTimeHours);
    }

    if (metrics.resolutionTimeHours !== null) {
      validResolutionTimes.push(metrics.resolutionTimeHours);
    }

    evaluatedSlaCount++;
    if (metrics.isSlaMet) {
      slaMetCount++;
    }
    if (metrics.isSlaBreached) {
      slaBreachesCount++;
    }
  });

  // Calculate averages
  const avgResponseTimeHours =
    validResponseTimes.length > 0
      ? validResponseTimes.reduce((acc, val) => acc + val, 0) / validResponseTimes.length
      : null;

  const avgResolutionTimeHours =
    validResolutionTimes.length > 0
      ? validResolutionTimes.reduce((acc, val) => acc + val, 0) / validResolutionTimes.length
      : null;

  const slaCompliancePct =
    evaluatedSlaCount > 0 ? Math.round((slaMetCount / evaluatedSlaCount) * 100) : null;

  return {
    totalComplaints,
    resolvedCount,
    pendingCount,
    inProgressCount,
    avgResponseTimeHours,
    avgResponseTimeFormatted: formatDurationHours(avgResponseTimeHours),
    avgResolutionTimeHours,
    avgResolutionTimeFormatted: formatDurationHours(avgResolutionTimeHours),
    slaCompliancePct,
    slaComplianceFormatted: slaCompliancePct !== null ? `${slaCompliancePct}%` : 'N/A',
    slaBreachesCount,
    slaMetCount,
  };
}

/**
 * Calculate department-level performance metrics
 */
export function calculateDepartmentPerformance(complaints = [], referenceTime = new Date()) {
  const deptMap = {};

  MUNICIPAL_DEPARTMENTS.forEach((dept) => {
    deptMap[dept] = [];
  });

  (complaints || []).forEach((c) => {
    const dept = c.recommended_department || getRecommendedDepartment(c.category) || 'Review Required';
    if (!deptMap[dept]) {
      deptMap[dept] = [];
    }
    deptMap[dept].push(c);
  });

  return Object.entries(deptMap).map(([deptName, deptComplaints]) => {
    const analytics = calculateSlaAnalytics(deptComplaints, referenceTime);
    return {
      department: deptName,
      totalComplaints: analytics.totalComplaints,
      resolvedCount: analytics.resolvedCount,
      activeCount: analytics.totalComplaints - analytics.resolvedCount,
      avgResponseTimeFormatted: analytics.avgResponseTimeFormatted,
      avgResolutionTimeFormatted: analytics.avgResolutionTimeFormatted,
      slaComplianceFormatted: analytics.slaComplianceFormatted,
      slaCompliancePct: analytics.slaCompliancePct,
      slaBreachesCount: analytics.slaBreachesCount,
    };
  });
}

/**
 * Calculate category-level performance metrics
 */
export function calculateCategoryPerformance(complaints = [], referenceTime = new Date()) {
  const catMap = {};

  ISSUE_CATEGORIES.forEach((cat) => {
    catMap[cat.id] = { label: cat.label, complaints: [] };
  });

  (complaints || []).forEach((c) => {
    const catKey = (c.category || 'other').toLowerCase();
    if (!catMap[catKey]) {
      catMap[catKey] = { label: c.category || 'Other', complaints: [] };
    }
    catMap[catKey].complaints.push(c);
  });

  return Object.entries(catMap).map(([catId, data]) => {
    const analytics = calculateSlaAnalytics(data.complaints, referenceTime);
    return {
      categoryId: catId,
      label: data.label,
      totalCount: analytics.totalComplaints,
      resolvedCount: analytics.resolvedCount,
      avgResolutionTimeFormatted: analytics.avgResolutionTimeFormatted,
      avgResolutionTimeHours: analytics.avgResolutionTimeHours,
      slaComplianceFormatted: analytics.slaComplianceFormatted,
      slaCompliancePct: analytics.slaCompliancePct,
      slaBreachesCount: analytics.slaBreachesCount,
    };
  });
}

/**
 * Calculate historical time trend data for Recharts visualization
 */
export function calculateTimeTrendData(complaints = [], referenceTime = new Date()) {
  if (!Array.isArray(complaints) || complaints.length === 0) {
    return [];
  }

  const dateMap = {};

  complaints.forEach((c) => {
    if (!c.created_at) return;
    const dateObj = new Date(c.created_at);
    // Format YYYY-MM-DD for sorting, and display label
    const dateKey = dateObj.toISOString().split('T')[0];
    const displayLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (!dateMap[dateKey]) {
      dateMap[dateKey] = {
        dateKey,
        label: displayLabel,
        complaints: [],
      };
    }
    dateMap[dateKey].complaints.push(c);
  });

  // Sort keys chronologically
  const sortedKeys = Object.keys(dateMap).sort();

  return sortedKeys.map((key) => {
    const item = dateMap[key];
    const analytics = calculateSlaAnalytics(item.complaints, referenceTime);
    return {
      date: item.label,
      fullDate: item.dateKey,
      Complaints: analytics.totalComplaints,
      Resolved: analytics.resolvedCount,
      avgResolutionHours:
        analytics.avgResolutionTimeHours !== null
          ? Number(analytics.avgResolutionTimeHours.toFixed(1))
          : 0,
      avgResolutionFormatted: analytics.avgResolutionTimeFormatted,
      slaCompliancePct: analytics.slaCompliancePct || 0,
    };
  });
}

export const slaService = {
  SLA_THRESHOLDS_HOURS,
  formatDurationHours,
  getSlaThresholdHours,
  getComplaintMetrics,
  calculateSlaAnalytics,
  calculateDepartmentPerformance,
  calculateCategoryPerformance,
  calculateTimeTrendData,
};

export default slaService;
