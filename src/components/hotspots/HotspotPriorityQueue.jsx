import React from 'react';
import {
  Flame,
  AlertTriangle,
  Search,
  Eye,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MUNICIPAL_DEPARTMENTS } from '../../utils/constants';
import { HOTSPOT_STATUSES } from '../../services/hotspotService';
import { ACTION_PRIORITIES } from '../../services/hotspotScoring';

export function HotspotPriorityQueue({
  hotspots = [],
  allHotspotsCount = 0,
  filterRisk,
  setFilterRisk,
  filterDepartment,
  setFilterDepartment,
  filterStatus,
  setFilterStatus,
  filterSearch,
  setFilterSearch,
  radiusMeters,
  setRadiusMeters,
  minComplaints,
  setMinComplaints,
  onSelectHotspot,
}) {
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case ACTION_PRIORITIES.CRITICAL:
        return 'bg-rose-600 text-white font-black';
      case ACTION_PRIORITIES.HIGH:
        return 'bg-amber-600 text-white font-black';
      case ACTION_PRIORITIES.MEDIUM:
        return 'bg-blue-600 text-white font-bold';
      default:
        return 'bg-emerald-600 text-white font-medium';
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'resolved':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600';
      case 'in progress':
        return 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-600';
      case 'assigned':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-600';
      case 'under review':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-600';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 overflow-hidden space-y-4 transition-all duration-300">
      
      {/* Header and Controls */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                Hotspot Priority Queue (Sorted by Risk Score)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Actionable municipal clusters ranked from highest to lowest severity
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Input
              placeholder="Search area, ID, dominant category..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="pl-9 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {/* Risk Level Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Risk Level
            </label>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Risks</option>
              <option value="critical">Critical (&ge;75)</option>
              <option value="high">High (50-74)</option>
              <option value="moderate">Moderate (25-49)</option>
              <option value="low">Low (&lt;25)</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Routed Department
            </label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Departments</option>
              {MUNICIPAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Operational Status Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              {HOTSPOT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Clustering Radius Setting */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
              <span>Cluster Radius</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{radiusMeters}m</span>
            </label>
            <select
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
            >
              <option value={300}>300m (Tight)</option>
              <option value={500}>500m (Standard)</option>
              <option value={750}>750m (Sector)</option>
              <option value={1000}>1000m (Ward)</option>
              <option value={1500}>1500m (Zone)</option>
            </select>
          </div>

          {/* Minimum Complaints Threshold */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
              <span>Min Reports</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">&ge;{minComplaints}</span>
            </label>
            <select
              value={minComplaints}
              onChange={(e) => setMinComplaints(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono"
            >
              <option value={2}>&ge; 2 complaints</option>
              <option value={3}>&ge; 3 complaints (Standard)</option>
              <option value={4}>&ge; 4 complaints</option>
              <option value={5}>&ge; 5 complaints</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table / List */}
      <div className="overflow-x-auto">
        {hotspots.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {allHotspotsCount === 0
                ? 'No Active Hotspots Detected'
                : 'No Hotspots Match Active Filter Criteria'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {allHotspotsCount === 0
                ? `Not enough nearby reports within ~${radiusMeters}m to form a hotspot. Requires at least ${minComplaints} complaints.`
                : 'Adjust your risk level, department, status, or search filters above.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-800 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Hotspot</th>
                <th className="py-3 px-4">Area / Location</th>
                <th className="py-3 px-4">Dominant Issue</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Reports</th>
                <th className="py-3 px-4">SLA</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {hotspots.map((item) => {
                const config = item.scoringConfig;
                const dominantCount = item.categoryDistribution[item.dominantCategory] || 1;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectHotspot && onSelectHotspot(item)}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    {/* Hotspot # */}
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-slate-900 dark:text-white font-extrabold">
                          {item.title}
                        </span>
                      </div>
                    </td>

                    {/* Area */}
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {item.area}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ~{item.radiusMeters}m radius
                      </div>
                    </td>

                    {/* Dominant Issue */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold capitalize bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {item.dominantCategory}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({dominantCount}/{item.totalComplaints})
                        </span>
                      </div>
                    </td>

                    {/* Risk Score */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1 shadow-2xs"
                          style={{
                            borderColor: config.color,
                            backgroundColor: config.fillColor,
                            color: config.color,
                          }}
                        >
                          <Flame className="w-3 h-3" />
                          <span>{item.riskScore}</span>
                          <span className="text-[10px] opacity-75">/100</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase hidden xl:inline ${config.textColor}`}>
                          {item.riskLevel}
                        </span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 max-w-[170px]">
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold truncate block border ${item.departmentStyle.badge}`}>
                        {item.assignedDepartment}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${getPriorityStyle(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>

                    {/* Reports Count */}
                    <td className="py-3.5 px-4 font-mono">
                      <div>
                        <strong className="text-slate-900 dark:text-white text-xs">{item.totalComplaints}</strong>
                        <span className="text-slate-400 text-[10px]"> total</span>
                      </div>
                      <div className="text-[10px] text-rose-500 font-bold">
                        {item.unresolvedComplaints} open
                      </div>
                    </td>

                    {/* SLA */}
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-bold ${item.slaStatus === 'Action Required' ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {item.slaStatus}
                      </span>
                    </td>

                    {/* Operational Status */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadgeStyle(item.status)}`}>
                        {item.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectHotspot) onSelectHotspot(item);
                        }}
                        className="text-xs py-1 h-7 border-slate-300 dark:border-slate-700 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count indicator */}
      {hotspots.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
          <span>Showing {hotspots.length} active hotspot zones</span>
          <span>Clustered by Geographic Proximity (Haversine &le; {radiusMeters}m)</span>
        </div>
      )}

    </div>
  );
}
