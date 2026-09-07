// CivicPulse Constants

export const APP_NAME = "CivicPulse";
export const APP_TAGLINE = "AI-Powered Civic Issue Reporting & Management Platform";

export const ISSUE_CATEGORIES = [
  { id: 'pothole', label: 'Pothole', description: 'Damaged or broken road surface' },
  { id: 'garbage', label: 'Garbage & Waste', description: 'Uncollected garbage or illegal dumping' },
  { id: 'streetlight', label: 'Broken Streetlight', description: 'Non-functioning or damaged streetlight' },
  { id: 'water_leakage', label: 'Water Leakage', description: 'Leaking pipe or water main issue' },
  { id: 'damaged_road', label: 'Damaged Road', description: 'Severe road erosion or collapse' },
  { id: 'other', label: 'Other Civic Issue', description: 'Other public infrastructure problem' },
];

export const DEPARTMENT_MAPPING = {
  pothole: 'Public Works Department',
  damaged_road: 'Public Works Department',
  garbage: 'Waste Management Department',
  streetlight: 'Electrical / Street Lighting Department',
  water_leakage: 'Water & Sewerage Department',
};

export const MUNICIPAL_DEPARTMENTS = [
  'Public Works Department',
  'Waste Management Department',
  'Electrical / Street Lighting Department',
  'Water & Sewerage Department',
  'Review Required',
];

export const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

export const ISSUE_STATUSES = {
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  UNDER_REVIEW: { label: 'Under Review', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  RESOLVED: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Rejected', color: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export const NAV_LINKS = [
  { name: 'Home', path: '/' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Report Issue', path: '/report' },
  { name: 'Track Issues', path: '/track' },
  { name: 'Admin', path: '/admin' },
];
