/**
 * Hotspot Risk Scoring & Priority Calculation Engine for CivicPulse 2.0
 * Calculates a dynamic, transparent 0-100 score based on 5 weighted factors:
 * 1. Issue Density (30%)
 * 2. Severity (30%)
 * 3. Recurrence & Category Concentration (15%)
 * 4. Unresolved Age & SLA Pressure (15%)
 * 5. Citizen Confirmations / Upvotes (10%)
 */

export const RISK_LEVELS = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const ACTION_PRIORITIES = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

export const RISK_LEVEL_CONFIG = {
  [RISK_LEVELS.CRITICAL]: {
    min: 75,
    max: 100,
    label: 'Critical',
    color: '#ef4444',
    fillColor: 'rgba(239, 68, 68, 0.45)',
    textColor: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/30',
    priority: ACTION_PRIORITIES.CRITICAL,
    actionText: 'Immediate Action Required',
  },
  [RISK_LEVELS.HIGH]: {
    min: 50,
    max: 74,
    label: 'High',
    color: '#f97316',
    fillColor: 'rgba(249, 115, 22, 0.40)',
    textColor: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
    priority: ACTION_PRIORITIES.HIGH,
    actionText: 'Urgent Dispatch Scheduled',
  },
  [RISK_LEVELS.MODERATE]: {
    min: 25,
    max: 49,
    label: 'Moderate',
    color: '#eab308',
    fillColor: 'rgba(234, 179, 8, 0.35)',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    badgeClass: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500/30',
    priority: ACTION_PRIORITIES.MEDIUM,
    actionText: 'Routine Work Order',
  },
  [RISK_LEVELS.LOW]: {
    min: 0,
    max: 24,
    label: 'Low',
    color: '#10b981',
    fillColor: 'rgba(16, 185, 129, 0.35)',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
    priority: ACTION_PRIORITIES.LOW,
    actionText: 'Monitoring Status',
  },
};

/**
 * Severity weights mapping (0 to 30 pts max for severity factor)
 */
const SEVERITY_POINTS = {
  critical: 30,
  high: 22,
  medium: 14,
  low: 6,
};

export const hotspotScoringService = {
  /**
   * Calculate deterministic Hotspot Risk Score (0-100) and breakdown
   * @param {Object} params
   * @param {Array} params.complaints - Array of complaints in the cluster
   * @param {number} params.radiusMeters - Radius of the cluster
   * @returns {Object} Score details, breakdown, risk level, action priority
   */
  calculateScore({ complaints = [] }) {
    const count = complaints.length;
    if (count === 0) {
      return {
        score: 0,
        riskLevel: RISK_LEVELS.LOW,
        priority: ACTION_PRIORITIES.LOW,
        config: RISK_LEVEL_CONFIG[RISK_LEVELS.LOW],
        breakdown: {
          density: 0,
          severity: 0,
          recurrence: 0,
          unresolvedAge: 0,
          confirmations: 0,
        },
      };
    }

    // 1. Issue Density (30% max 30 pts)
    // Scale: 3 complaints = 12 pts, 5 = 18 pts, 8 = 24 pts, 10+ = 30 pts
    const densityPts = Math.min(30, Math.round(count >= 10 ? 30 : count * 3));

    // 2. Severity (30% max 30 pts)
    // Averaged across complaints, with bonus for critical count
    let severitySum = 0;
    let criticalCount = 0;
    complaints.forEach((c) => {
      const sev = (c.severity || c.severity_score || 'Medium').toLowerCase();
      if (sev === 'critical') criticalCount += 1;
      severitySum += SEVERITY_POINTS[sev] || SEVERITY_POINTS.medium;
    });
    const avgSeverity = severitySum / count;
    // Boost score if multiple critical issues are concentrated
    const criticalBonus = Math.min(6, criticalCount * 2);
    const severityPts = Math.min(30, Math.round(avgSeverity + criticalBonus));

    // 3. Recurrence & Category Concentration (15% max 15 pts)
    // Repeated same-category issues in close proximity indicate chronic localized failure
    const categoryCounts = {};
    complaints.forEach((c) => {
      const cat = (c.category || 'other').toLowerCase();
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const maxCategoryCount = Math.max(...Object.values(categoryCounts));
    const concentrationRatio = maxCategoryCount / count; // 0.0 to 1.0
    // If concentration >= 60% and count >= 3 -> max recurrence pts
    const recurrencePts = Math.min(
      15,
      Math.round(concentrationRatio * 10 + (count >= 4 ? 5 : count))
    );

    // 4. Age of Unresolved Complaints & SLA Pressure (15% max 15 pts)
    const now = Date.now();
    let oldestUnresolvedAgeHours = 0;
    let unresolvedCount = 0;

    complaints.forEach((c) => {
      const status = (c.status || '').toLowerCase();
      if (status !== 'resolved' && status !== 'closed') {
        unresolvedCount += 1;
        const createdTime = c.created_at ? new Date(c.created_at).getTime() : now;
        const ageHours = Math.max(0, (now - createdTime) / (1000 * 60 * 60));
        if (ageHours > oldestUnresolvedAgeHours) {
          oldestUnresolvedAgeHours = ageHours;
        }
      }
    });

    let agePts = 3;
    if (oldestUnresolvedAgeHours >= 168) {
      // > 7 days unresolved
      agePts = 15;
    } else if (oldestUnresolvedAgeHours >= 72) {
      // > 3 days
      agePts = 12;
    } else if (oldestUnresolvedAgeHours >= 24) {
      // > 24 hours
      agePts = 8;
    } else if (oldestUnresolvedAgeHours >= 6) {
      agePts = 5;
    }

    const unresolvedRatio = count > 0 ? unresolvedCount / count : 0;
    const unresolvedPts = Math.min(15, Math.round(agePts * 0.7 + unresolvedRatio * 4.5));

    // 5. Citizen Confirmations / Upvotes (10% max 10 pts)
    const totalUpvotes = complaints.reduce((sum, c) => sum + Math.max(1, Number(c.upvotes) || 1), 0);
    const avgUpvotes = totalUpvotes / count;
    const confirmationsPts = Math.min(
      10,
      Math.round(Math.min(6, totalUpvotes * 0.8) + Math.min(4, avgUpvotes * 1.5))
    );

    // Sum and clamp final score between 0 and 100
    const rawTotal = densityPts + severityPts + recurrencePts + unresolvedPts + confirmationsPts;
    const finalScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

    // Classify Risk Level
    let riskLevel = RISK_LEVELS.LOW;
    if (finalScore >= 75) {
      riskLevel = RISK_LEVELS.CRITICAL;
    } else if (finalScore >= 50) {
      riskLevel = RISK_LEVELS.HIGH;
    } else if (finalScore >= 25) {
      riskLevel = RISK_LEVELS.MODERATE;
    }

    // Classify Action Priority
    let priority = ACTION_PRIORITIES.LOW;
    if (finalScore >= 75 || criticalCount >= 2 || (criticalCount >= 1 && unresolvedCount >= 3)) {
      priority = ACTION_PRIORITIES.CRITICAL;
    } else if (finalScore >= 50 || criticalCount >= 1 || unresolvedCount >= 4) {
      priority = ACTION_PRIORITIES.HIGH;
    } else if (finalScore >= 25 || unresolvedCount >= 2) {
      priority = ACTION_PRIORITIES.MEDIUM;
    }

    const config = RISK_LEVEL_CONFIG[riskLevel];

    return {
      score: finalScore,
      riskLevel,
      priority,
      config,
      breakdown: {
        density: densityPts,
        severity: severityPts,
        recurrence: recurrencePts,
        unresolvedAge: unresolvedPts,
        confirmations: confirmationsPts,
      },
      metrics: {
        totalComplaints: count,
        unresolvedComplaints: unresolvedCount,
        criticalComplaints: criticalCount,
        totalUpvotes,
        oldestUnresolvedHours: Math.round(oldestUnresolvedAgeHours),
        oldestUnresolvedDays: Number((oldestUnresolvedAgeHours / 24).toFixed(1)),
      },
    };
  },

  /**
   * Helper to get styling for any risk level
   */
  getRiskConfig(riskLevel) {
    return RISK_LEVEL_CONFIG[riskLevel] || RISK_LEVEL_CONFIG[RISK_LEVELS.LOW];
  },
};
