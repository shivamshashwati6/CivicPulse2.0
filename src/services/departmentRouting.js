/**
 * Smart Department Routing Service for CivicPulse 2.0
 * Maps civic issue categories to responsible municipal departments and determines
 * dispatch routing for hotspots and complaints.
 */

import { DEPARTMENT_MAPPING, MUNICIPAL_DEPARTMENTS } from '../utils/constants.js';

export const DEPARTMENTS = {
  PUBLIC_WORKS: 'Public Works Department',
  WASTE_MANAGEMENT: 'Waste Management Department',
  ELECTRICAL: 'Electrical / Street Lighting Department',
  WATER_SEWERAGE: 'Water & Sewerage Department',
  REVIEW_REQUIRED: 'Review Required',
};

export const DEPARTMENT_COLORS = {
  [DEPARTMENTS.PUBLIC_WORKS]: {
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
    badge: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    hex: '#f59e0b',
  },
  [DEPARTMENTS.WASTE_MANAGEMENT]: {
    bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
    badge: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    hex: '#10b981',
  },
  [DEPARTMENTS.ELECTRICAL]: {
    bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
    badge: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    hex: '#3b82f6',
  },
  [DEPARTMENTS.WATER_SEWERAGE]: {
    bg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-500/30',
    badge: 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    hex: '#06b6d4',
  },
  [DEPARTMENTS.REVIEW_REQUIRED]: {
    bg: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-500/30',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    hex: '#64748b',
  },
};

/**
 * Normalized dictionary mapping categories and alias keywords to departments
 */
const CATEGORY_TO_DEPARTMENT = {
  // Public Works
  pothole: DEPARTMENTS.PUBLIC_WORKS,
  potholes: DEPARTMENTS.PUBLIC_WORKS,
  damaged_road: DEPARTMENTS.PUBLIC_WORKS,
  'damaged road': DEPARTMENTS.PUBLIC_WORKS,
  'road damage': DEPARTMENTS.PUBLIC_WORKS,
  road: DEPARTMENTS.PUBLIC_WORKS,
  roads: DEPARTMENTS.PUBLIC_WORKS,
  footpath: DEPARTMENTS.PUBLIC_WORKS,
  sidewalk: DEPARTMENTS.PUBLIC_WORKS,
  bridge: DEPARTMENTS.PUBLIC_WORKS,

  // Waste Management
  garbage: DEPARTMENTS.WASTE_MANAGEMENT,
  'garbage & waste': DEPARTMENTS.WASTE_MANAGEMENT,
  waste: DEPARTMENTS.WASTE_MANAGEMENT,
  litter: DEPARTMENTS.WASTE_MANAGEMENT,
  dumping: DEPARTMENTS.WASTE_MANAGEMENT,
  illegal_dumping: DEPARTMENTS.WASTE_MANAGEMENT,
  'illegal dumping': DEPARTMENTS.WASTE_MANAGEMENT,
  trash: DEPARTMENTS.WASTE_MANAGEMENT,
  debris: DEPARTMENTS.WASTE_MANAGEMENT,

  // Electrical & Streetlighting
  streetlight: DEPARTMENTS.ELECTRICAL,
  streetlights: DEPARTMENTS.ELECTRICAL,
  'street light': DEPARTMENTS.ELECTRICAL,
  'street lights': DEPARTMENTS.ELECTRICAL,
  'broken streetlight': DEPARTMENTS.ELECTRICAL,
  'broken street light': DEPARTMENTS.ELECTRICAL,
  lighting: DEPARTMENTS.ELECTRICAL,
  power: DEPARTMENTS.ELECTRICAL,
  electricity: DEPARTMENTS.ELECTRICAL,
  transformer: DEPARTMENTS.ELECTRICAL,
  wire: DEPARTMENTS.ELECTRICAL,
  cable: DEPARTMENTS.ELECTRICAL,

  // Water & Sewerage
  water_leakage: DEPARTMENTS.WATER_SEWERAGE,
  'water leakage': DEPARTMENTS.WATER_SEWERAGE,
  water: DEPARTMENTS.WATER_SEWERAGE,
  pipe: DEPARTMENTS.WATER_SEWERAGE,
  pipes: DEPARTMENTS.WATER_SEWERAGE,
  leak: DEPARTMENTS.WATER_SEWERAGE,
  leakage: DEPARTMENTS.WATER_SEWERAGE,
  sewerage: DEPARTMENTS.WATER_SEWERAGE,
  sewage: DEPARTMENTS.WATER_SEWERAGE,
  drainage: DEPARTMENTS.WATER_SEWERAGE,
  open_drain: DEPARTMENTS.WATER_SEWERAGE,
  'open drain': DEPARTMENTS.WATER_SEWERAGE,
  drain: DEPARTMENTS.WATER_SEWERAGE,
  drains: DEPARTMENTS.WATER_SEWERAGE,
  overflow: DEPARTMENTS.WATER_SEWERAGE,
};

export const departmentRoutingService = {
  /**
   * Determine the assigned municipal department for a given issue category
   * @param {string} category
   * @returns {string} Municipal department name
   */
  getDepartmentForCategory(category) {
    if (!category) return DEPARTMENTS.REVIEW_REQUIRED;
    const cleanStr = String(category).trim().toLowerCase();
    const key = cleanStr.replace(/[-_]/g, ' ');

    // 1. Direct key lookups
    if (CATEGORY_TO_DEPARTMENT[cleanStr]) {
      return CATEGORY_TO_DEPARTMENT[cleanStr];
    }
    if (CATEGORY_TO_DEPARTMENT[key]) {
      return CATEGORY_TO_DEPARTMENT[key];
    }

    // 2. Substring matching (requires pattern or key length >= 3 to avoid false positives)
    for (const [pattern, dept] of Object.entries(CATEGORY_TO_DEPARTMENT)) {
      if (pattern.length >= 3 && (key.includes(pattern) || (key.length >= 4 && pattern.includes(key)))) {
        return dept;
      }
    }

    // 3. Fallback to existing constants mapping
    if (DEPARTMENT_MAPPING[category] || DEPARTMENT_MAPPING[cleanStr]) {
      return DEPARTMENT_MAPPING[category] || DEPARTMENT_MAPPING[cleanStr];
    }

    return DEPARTMENTS.REVIEW_REQUIRED;
  },

  /**
   * Get styling tokens for a given department
   * @param {string} department
   */
  getDepartmentStyle(department) {
    return (
      DEPARTMENT_COLORS[department] || DEPARTMENT_COLORS[DEPARTMENTS.REVIEW_REQUIRED]
    );
  },

  /**
   * Return all valid municipal departments
   */
  getAllDepartments() {
    return MUNICIPAL_DEPARTMENTS;
  },
};
