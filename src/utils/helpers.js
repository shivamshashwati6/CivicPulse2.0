// Utility helper functions

import { ISSUE_STATUSES } from './constants.js';

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getStatusBadgeStyle(statusKey) {
  return ISSUE_STATUSES[statusKey]?.color || 'bg-slate-100 text-slate-800 border-slate-200';
}

export function getStatusLabel(statusKey) {
  return ISSUE_STATUSES[statusKey]?.label || statusKey;
}

export function truncateText(text, maxLength = 80) {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Calculates the Urban Impact Score (0–100) deterministically based on 4 weighted factors:
 * 1. Severity (40% max 40 pts): Low=10, Medium=20, High=30, Critical=40
 * 2. Community Support (20% max 20 pts): upvotes * 4 (capped at 20)
 * 3. Location / Urban Concentration (20% max 20 pts): nearby active issues within ~500m (5 pts per nearby, max 20)
 * 4. Age / Persistence (20% max 20 pts): unresolved age (<6h=5, 6-24h=10, 1-3d=15, >3d=20; Resolved=0)
 */
export function calculateUrbanImpactScore(complaint, allComplaints = []) {
  if (!complaint) {
    return {
      score: 25,
      category: 'Moderate Impact',
      badgeVariant: 'info',
      colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
      breakdown: { severity: 10, community: 5, concentration: 5, persistence: 5 },
    };
  }

  // Factor 1: Severity (40% max 40 pts)
  const sev = (complaint.severity || complaint.severity_score || 'Medium').toLowerCase();
  let severityScore = 20;
  if (sev === 'critical') severityScore = 40;
  else if (sev === 'high') severityScore = 30;
  else if (sev === 'medium') severityScore = 20;
  else if (sev === 'low') severityScore = 10;

  // Factor 2: Community Support / Upvotes (20% max 20 pts)
  const upvotesCount = Math.max(1, Number(complaint.upvotes) || 1);
  const communityScore = Math.min(20, Math.round(upvotesCount * 4));

  // Factor 3: Location / Urban Concentration (20% max 20 pts)
  let concentrationScore = 5; // Base default
  if (complaint.latitude && complaint.longitude && Array.isArray(allComplaints) && allComplaints.length > 0) {
    const lat = Number(complaint.latitude);
    const lng = Number(complaint.longitude);
    const nearbyCount = allComplaints.filter((other) => {
      if (!other || other.id === complaint.id || !other.latitude || !other.longitude) return false;
      const status = (other.status || '').toLowerCase();
      if (status === 'resolved' || status === 'closed') return false;
      const dLat = (Number(other.latitude) - lat) * 111; // approx km
      const dLng = (Number(other.longitude) - lng) * 111 * Math.cos((lat * Math.PI) / 180);
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
      return distKm <= 0.5; // within 500 meters
    }).length;

    concentrationScore = Math.min(20, Math.max(5, (nearbyCount + 1) * 5));
  }

  // Factor 4: Age / Persistence (20% max 20 pts)
  const status = (complaint.status || '').toLowerCase();
  let persistenceScore = 0;
  if (status !== 'resolved' && status !== 'closed') {
    const createdAt = complaint.created_at ? new Date(complaint.created_at).getTime() : Date.now();
    const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));

    if (ageHours < 6) persistenceScore = 5;
    else if (ageHours < 24) persistenceScore = 10;
    else if (ageHours < 72) persistenceScore = 15;
    else persistenceScore = 20;
  }

  // Total Score clamped between 0 and 100
  const rawScore = severityScore + communityScore + concentrationScore + persistenceScore;
  const score = Math.max(0, Math.min(100, rawScore));

  const categoryDetails = getImpactCategory(score);

  return {
    score,
    category: categoryDetails.label,
    badgeVariant: categoryDetails.variant,
    colorClass: categoryDetails.colorClass,
    breakdown: {
      severity: severityScore,
      community: communityScore,
      concentration: concentrationScore,
      persistence: persistenceScore,
    },
  };
}

export function getImpactCategory(score) {
  const num = Number(score) || 0;
  if (num >= 75) {
    return {
      label: 'Critical Impact',
      variant: 'danger',
      colorClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30',
    };
  }
  if (num >= 50) {
    return {
      label: 'High Impact',
      variant: 'warning',
      colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
    };
  }
  if (num >= 25) {
    return {
      label: 'Moderate Impact',
      variant: 'info',
      colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
    };
  }
  return {
    label: 'Low Impact',
    variant: 'success',
    colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
  };
}

/**
 * Detects and clusters Urban Hotspots (problem zones) from active complaints.
 * @param {Array} complaints - List of complaint records
 * @param {number} radiusMeters - Clustering distance threshold (default 400m)
 * @param {string} categoryFilter - Category filter ('all' or specific category)
 * @returns {Array} Array of hotspot objects with centroid, intensity, breakdown, emerging status
 */
export function detectUrbanHotspots(complaints = [], radiusMeters = 400, categoryFilter = 'all') {
  if (!Array.isArray(complaints) || complaints.length === 0) return [];

  // Filter unresolved complaints with valid coordinates
  let activeList = complaints.filter((c) => {
    if (!c || !c.latitude || !c.longitude) return false;
    const status = (c.status || '').toLowerCase();
    if (status === 'resolved' || status === 'closed') return false;
    if (categoryFilter !== 'all' && (c.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  if (activeList.length === 0) return [];

  const radiusKm = radiusMeters / 1000;
  const clusters = [];

  // Spatial clustering loop
  activeList.forEach((c) => {
    const lat = Number(c.latitude);
    const lng = Number(c.longitude);

    let assigned = false;
    for (const cluster of clusters) {
      const dLat = (cluster.centerLat - lat) * 111;
      const dLng = (cluster.centerLng - lng) * 111 * Math.cos((lat * Math.PI) / 180);
      const distKm = Math.sqrt(dLat * dLat + dLng * dLng);

      if (distKm <= radiusKm) {
        cluster.complaints.push(c);
        const total = cluster.complaints.length;
        cluster.centerLat = cluster.complaints.reduce((acc, curr) => acc + Number(curr.latitude), 0) / total;
        cluster.centerLng = cluster.complaints.reduce((acc, curr) => acc + Number(curr.longitude), 0) / total;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      clusters.push({
        centerLat: lat,
        centerLng: lng,
        complaints: [c],
      });
    }
  });

  // Calculate intensity, main issue, category diversity, and emerging status for each cluster
  const hotspots = clusters.map((cluster, index) => {
    const count = cluster.complaints.length;

    // Category frequency analysis
    const catCounts = {};
    cluster.complaints.forEach((c) => {
      const cat = c.category || 'General';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const mainCategory = sortedCats[0]?.[0] || 'General';
    const categoriesCount = Object.keys(catCounts).length;

    // Calculate Average Urban Impact Score
    const impactScores = cluster.complaints.map((c) => calculateUrbanImpactScore(c, complaints).score);
    const avgImpactScore = Math.round(
      impactScores.reduce((acc, curr) => acc + curr, 0) / impactScores.length
    );

    // Calculate Severity Average (Critical=15, High=11, Medium=7, Low=3)
    const sevWeights = { critical: 15, high: 11, medium: 7, low: 3 };
    const avgSeverityPts = Math.round(
      cluster.complaints.reduce((acc, curr) => {
        const sev = (curr.severity || curr.severity_score || 'Medium').toLowerCase();
        return acc + (sevWeights[sev] || 7);
      }, 0) / count
    );

    // Deterministic Intensity Score (0–100)
    const countPts = Math.min(35, count * 10);
    const impactPts = Math.round((avgImpactScore / 100) * 35);
    const diversityPts = Math.min(15, categoriesCount * 5);
    const severityPts = Math.min(15, avgSeverityPts);

    const rawIntensity = countPts + impactPts + diversityPts + severityPts;
    const intensityScore = Math.max(0, Math.min(100, rawIntensity));

    // Intensity Category & Visual Parameters
    let intensityLabel = 'Low';
    let color = '#10b981'; // emerald
    let fillColor = 'rgba(16, 185, 129, 0.35)';
    let radiusPx = 20;

    if (intensityScore >= 75) {
      intensityLabel = 'Critical';
      color = '#ef4444'; // red
      fillColor = 'rgba(239, 68, 68, 0.45)';
      radiusPx = 42;
    } else if (intensityScore >= 50) {
      intensityLabel = 'High';
      color = '#f97316'; // orange
      fillColor = 'rgba(249, 115, 22, 0.4)';
      radiusPx = 34;
    } else if (intensityScore >= 25) {
      intensityLabel = 'Moderate';
      color = '#3b82f6'; // blue
      fillColor = 'rgba(59, 130, 246, 0.35)';
      radiusPx = 26;
    }

    // Emerging Zone Trend Detection:
    // >= 50% created within last 48 hours and complaint count is 2 to 5
    const now = Date.now();
    const recentCount = cluster.complaints.filter((c) => {
      const created = c.created_at ? new Date(c.created_at).getTime() : 0;
      return now - created <= 48 * 60 * 60 * 1000;
    }).length;

    const isEmerging = recentCount / count >= 0.5 && count >= 2;
    const primaryAddress = cluster.complaints.find((c) => c.address)?.address || 'Urban Sector Zone';

    // Calculate Max Severity in cluster
    const severities = cluster.complaints.map((c) =>
      (c.severity || c.severity_score || 'Medium').toLowerCase()
    );
    let maxSeverity = 'Low';
    if (severities.includes('critical')) maxSeverity = 'Critical';
    else if (severities.includes('high')) maxSeverity = 'High';
    else if (severities.includes('medium')) maxSeverity = 'Medium';

    return {
      id: `hotspot-${index}-${cluster.centerLat.toFixed(4)}-${cluster.centerLng.toFixed(4)}`,
      center: [cluster.centerLat, cluster.centerLng],
      centerLat: cluster.centerLat,
      centerLng: cluster.centerLng,
      complaintCount: count,
      complaints: cluster.complaints,
      mainCategory,
      categoriesCount,
      avgImpactScore,
      maxSeverity,
      intensityScore,
      intensityLabel,
      color,
      fillColor,
      strokeColor: color,
      radiusPx,
      isEmerging,
      address: primaryAddress,
    };
  });

  return hotspots.sort((a, b) => b.intensityScore - a.intensityScore);
}

/**
 * Deterministically map an issue category to its corresponding municipal department.
 * @param {string} category - The complaint category identifier or title
 * @returns {string} - The recommended municipal department name or 'Review Required'
 */
export function getRecommendedDepartment(category) {
  if (!category) return 'Review Required';
  const cat = String(category).trim().toLowerCase();

  if (cat === 'pothole') {
    return 'Public Works Department';
  }
  if (cat === 'damaged_road' || cat === 'damaged road' || cat === 'road') {
    return 'Public Works Department';
  }
  if (cat === 'garbage' || cat === 'garbage & waste' || cat === 'waste' || cat === 'litter') {
    return 'Waste Management Department';
  }
  if (cat === 'streetlight' || cat === 'street lighting' || cat === 'broken streetlight' || cat === 'lighting') {
    return 'Electrical / Street Lighting Department';
  }
  if (cat === 'water_leakage' || cat === 'water leakage' || cat === 'water' || cat === 'pipe') {
    return 'Water & Sewerage Department';
  }

  return 'Review Required';
}

