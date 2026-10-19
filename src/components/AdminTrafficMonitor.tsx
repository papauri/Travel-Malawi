import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  Users,
  Clock,
  Globe,
  Radio,
  Search,
  RefreshCw,
  Trash2,
  Download,
  Filter,
  Eye,
  X,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Smartphone,
  Tablet,
  Laptop,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  MapPin,
  Compass,
  Building2,
  Layers,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { isGlobalAdmin } from '../lib/roles';
import {
  fetchLiveTrafficSummary,
  clearTrafficBuffer,
  LiveTrafficResponse,
  TrafficSessionData,
} from '../lib/trafficMonitor';

interface AdminTrafficMonitorProps {
  compactMode?: boolean;
}

type TrafficFilter = 'all' | 'anonymous' | 'authenticated' | 'high_intent' | 'waiting_long';

export default function AdminTrafficMonitor({ compactMode = false }: AdminTrafficMonitorProps) {
  const { user: authedUser } = useAuth();
  const canClear = isGlobalAdmin(authedUser); // the server restricts clearing to global admins
  const [data, setData] = useState<LiveTrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5000); // 5s default
  const [activeFilter, setActiveFilter] = useState<TrafficFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<TrafficSessionData | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const timerRef = useRef<any>(null);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    const result = await fetchLiveTrafficSummary();
    if (result) {
      setData(result);
    } else {
      // Deduplicated by id so the 5s poll does not stack toasts.
      toast.error('Could not load live traffic. Showing the last data received.', { id: 'traffic-load-failed' });
    }
    setLoading(false);
    if (isManual) setRefreshing(false);
  };

  useEffect(() => {
    loadData();

    if (autoRefreshInterval > 0) {
      timerRef.current = setInterval(() => {
        loadData(false);
      }, autoRefreshInterval);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefreshInterval]);

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClearBuffer = async () => {
    setShowClearConfirm(false);
    setClearing(true);
    const success = await clearTrafficBuffer();
    if (success) {
      toast.success('Traffic telemetry buffer cleared');
      await loadData(true);
    } else {
      toast.error('Failed to clear buffer');
    }
    setClearing(false);
  };

  const formatWaitDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  };

  const renderDeviceIcon = (type?: string, className = 'w-3.5 h-3.5') => {
    if (type === 'Mobile') return <Smartphone className={className} />;
    if (type === 'Tablet') return <Tablet className={className} />;
    return <Laptop className={className} />;
  };

  const renderStatusBadge = (status: string, waitSecs: number) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Active · {formatWaitDuration(waitSecs)}</span>
        </span>
      );
    }
    if (status === 'waiting') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Viewing · {formatWaitDuration(waitSecs)}</span>
        </span>
      );
    }
    if (status === 'background' || status === 'idle') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
          <span>Idle · {formatWaitDuration(waitSecs)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
        <span>Left</span>
      </span>
    );
  };

  const renderIntentBadge = (intent: string) => {
    if (intent === 'booking_intent') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          Checking dates
        </span>
      );
    }
    if (intent === 'host_inquiry') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
          Host onboarding
        </span>
      );
    }
    if (intent === 'price_comparing') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-800 border border-stone-200">
          Comparing stays
        </span>
      );
    }
    if (intent === 'exploring_stays') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
          Viewing stays
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-50 text-stone-600 border border-stone-200/80">
        Browsing
      </span>
    );
  };

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();

    return data.recentSessions.filter((s) => {
      if (activeFilter === 'anonymous' && !s.isAnonymous) return false;
      if (activeFilter === 'authenticated' && s.isAnonymous) return false;
      if (activeFilter === 'high_intent' && s.conversionLikelihood !== 'High') return false;
      if (activeFilter === 'waiting_long' && s.currentWaitSeconds < 60) return false;

      if (q) {
        const matchVisitor = s.visitorId.toLowerCase().includes(q);
        const matchUser = (s.userName || '').toLowerCase().includes(q) || (s.userEmail || '').toLowerCase().includes(q);
        const matchCity = (s.location.city || '').toLowerCase().includes(q);
        const matchCountry = (s.location.country || '').toLowerCase().includes(q);
        const matchPath = s.currentPath.toLowerCase().includes(q);
        const matchTitle = s.currentTitle.toLowerCase().includes(q);
        const matchIP = (s.ip || '').toLowerCase().includes(q);
        const matchIntent = (s.intentSummary || '').toLowerCase().includes(q);
        if (!matchVisitor && !matchUser && !matchCity && !matchCountry && !matchPath && !matchTitle && !matchIP && !matchIntent) {
          return false;
        }
      }

      return true;
    });
  }, [data, activeFilter, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    if (!data) return;
    try {
      const headers = [
        'Visitor ID',
        'Type',
        'User Name',
        'User Email',
        'Status',
        'Current Path',
        'Page Title',
        'Page Duration Seconds',
        'Total Session Seconds',
        'Activity Category',
        'Activity Summary',
        'IP Address',
        'City',
        'Country',
        'Device Type',
        'OS',
        'Browser',
        'Started At',
        'Last Active',
      ];

      const rows = data.recentSessions.map((s) => [
        `"${s.visitorId}"`,
        `"${s.isAnonymous ? 'Anonymous' : 'Signed In'}"`,
        `"${(s.userName || 'Guest').replace(/"/g, '""')}"`,
        `"${(s.userEmail || '').replace(/"/g, '""')}"`,
        `"${s.status}"`,
        `"${s.currentPath.replace(/"/g, '""')}"`,
        `"${s.currentTitle.replace(/"/g, '""')}"`,
        s.currentWaitSeconds,
        s.totalSessionSeconds,
        `"${s.intent}"`,
        `"${s.intentSummary.replace(/"/g, '""')}"`,
        `"${s.ip}"`,
        `"${(s.location.city || '').replace(/"/g, '""')}"`,
        `"${(s.location.country || '').replace(/"/g, '""')}"`,
        `"${s.device?.type || ''}"`,
        `"${s.device?.os || ''}"`,
        `"${s.device?.browser || ''}"`,
        `"${new Date(s.startedAt).toISOString()}"`,
        `"${new Date(s.lastHeartbeatAt).toISOString()}"`,
      ]);

      // Page titles and names are visitor-controlled: neutralise spreadsheet formulas, and use a Blob
      // URL so a '#' in a title cannot truncate the file the way it does in a data: URI.
      const safeRows = rows.map((r) => r.map((c) => (typeof c === 'string' ? c.replace(/^"([=+\-@\t\r])/, '"\'$1') : c)));
      const csvString = [headers.join(','), ...safeRows.map((r) => r.join(','))].join('\n');
      const csvUrl = URL.createObjectURL(new Blob([csvString], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.setAttribute('href', csvUrl);
      anchor.setAttribute('download', `travel_malawi_visitors_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(csvUrl), 1000);
      setShowExportMenu(false);
      toast.success('Exported visitor sessions to CSV');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    if (!data) return;
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
      const anchor = document.createElement('a');
      anchor.setAttribute('href', dataStr);
      anchor.setAttribute('download', `travel_malawi_visitors_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setShowExportMenu(false);
      toast.success('Exported visitor sessions to JSON');
    } catch {
      toast.error('Failed to export JSON');
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center bg-white rounded-xl border border-stone-200 ">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-900 border-t-transparent mx-auto mb-2"></div>
        <p className="text-xs font-medium text-stone-600">Loading active visitors…</p>
      </div>
    );
  }

  const summary = data?.summary || {
    activeNow: 0,
    anonymousNow: 0,
    authenticatedNow: 0,
    avgWaitSeconds: 0,
    longestWaitSeconds: 0,
    highIntentCount: 0,
    topProperties: [],
    geoBreakdown: [],
    deviceBreakdown: [],
    intentBreakdown: {},
    totalMonitored24h: 0,
  };

  const renderSessionDrawer = () => {
    if (!selectedSession) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div
          className="fixed inset-0 bg-stone-900/25 "
          onClick={() => setSelectedSession(null)}
        />
        <div className="relative w-full sm:w-[460px] bg-white shadow-sm border-l border-stone-200 z-10 flex flex-col h-full animate-in slide-in-from-right-4 duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/60">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-stone-900 text-sm">
                  {selectedSession.isAnonymous
                    ? `Guest (${selectedSession.visitorId})`
                    : selectedSession.userName || selectedSession.userEmail || selectedSession.visitorId}
                </h4>
                <span className="text-[11px] font-medium px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-md">
                  {selectedSession.isAnonymous ? 'Anonymous' : selectedSession.userRole || 'Signed In'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Started {formatDistanceToNow(new Date(selectedSession.startedAt), { addSuffix: true })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
            {/* Activity Summary */}
            <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">Current Activity</span>
                {renderIntentBadge(selectedSession.intent)}
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                {selectedSession.intentSummary}
              </p>
              <div className="text-[11px] text-stone-500 flex items-center gap-3 pt-1.5 border-t border-stone-200/70">
                <span>Interest level: <strong className="text-stone-800">{selectedSession.conversionLikelihood}</strong></span>
                <span>·</span>
                <span>Page views: <strong className="text-stone-800">{selectedSession.steps.length}</strong></span>
              </div>
            </div>

            {/* Session Timing */}
            <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-2.5">
              <span className="text-xs font-semibold text-stone-800 block">
                Session Timing
              </span>
              <div className="grid grid-cols-2 gap-3 text-stone-700">
                <div>
                  <span className="text-stone-400 block text-[11px]">Time on page</span>
                  <span className="tabular-nums font-semibold text-stone-900 text-sm">
                    {formatWaitDuration(selectedSession.currentWaitSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Total Session Duration</span>
                  <span className="tabular-nums font-semibold text-stone-900 text-sm">
                    {formatWaitDuration(selectedSession.totalSessionSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Active Time</span>
                  <span className="tabular-nums font-medium text-emerald-700">
                    {formatWaitDuration(selectedSession.activeSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Idle Time</span>
                  <span className="tabular-nums font-medium text-stone-500">
                    {formatWaitDuration(selectedSession.idleSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Device & Location */}
            <div className="p-3.5 rounded-xl border border-stone-200 bg-white space-y-2.5">
              <span className="text-xs font-semibold text-stone-800 block">
                Device &amp; Location
              </span>
              <div className="grid grid-cols-2 gap-3 text-stone-700">
                <div>
                  <span className="text-stone-400 block text-[11px]">Location</span>
                  <span className="font-medium text-stone-900">
                    {selectedSession.location.city || 'Unknown'}, {selectedSession.location.country || 'Malawi'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">IP Address</span>
                  <span className="font-mono text-stone-700">{selectedSession.ip}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Device &amp; OS</span>
                  <span className="font-medium text-stone-900">
                    {selectedSession.device.type} · {selectedSession.device.os}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Browser</span>
                  <span className="font-medium text-stone-900">{selectedSession.device.browser}</span>
                </div>
              </div>
            </div>

            {/* Page History */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-800 block">
                Pages Visited ({selectedSession.steps.length})
              </span>
              <div className="space-y-1.5">
                {selectedSession.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-stone-200 bg-stone-50/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-stone-900 text-xs truncate">
                        {idx + 1}. {st.title || st.path}
                      </span>
                      <span className="tabular-nums text-stone-500 text-[11px] shrink-0">
                        {formatWaitDuration(st.dwellSeconds)}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 tabular-nums mt-0.5 truncate">
                      {st.path}
                    </div>
                    {st.hotelName && (
                      <div className="text-[11px] text-stone-700 font-medium mt-1">
                        Property: {st.hotelName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // COMPACT MODE (Used inside AdminDashboard Overview tab)
  if (compactMode) {
    const recentFive = (data?.recentSessions || []).slice(0, 5);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60">
            <span className="text-stone-500 text-xs font-medium block">Active Visitors</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">{summary.activeNow}</span>
              <span className="text-xs text-stone-400">
                {summary.anonymousNow} guest · {summary.authenticatedNow} signed in
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60">
            <span className="text-stone-500 text-xs font-medium block">Avg. Time on Page</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">
                {formatWaitDuration(summary.avgWaitSeconds)}
              </span>
              <span className="text-xs text-stone-400">max {formatWaitDuration(summary.longestWaitSeconds)}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60">
            <span className="text-stone-500 text-xs font-medium block">Checking Stays</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">{summary.highIntentCount}</span>
              <span className="text-xs text-stone-400 truncate">
                {summary.topProperties[0] ? summary.topProperties[0].name : 'Active sessions'}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/60">
            <span className="text-stone-500 text-xs font-medium block">Locations</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">
                {summary.geoBreakdown.length || 1}
              </span>
              <span className="text-xs text-stone-400 truncate">
                {summary.geoBreakdown.length > 0
                  ? summary.geoBreakdown.slice(0, 2).map((g) => g.country).join(', ')
                  : 'Malawi'}
              </span>
            </div>
          </div>
        </div>

        {recentFive.length > 0 ? (
          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                  <th className="px-3.5 py-2">Visitor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Current Page</th>
                  <th className="px-3 py-2">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentFive.map((s) => (
                  <tr
                    key={s.sessionId}
                    onClick={() => setSelectedSession(s)}
                    className="hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <td className="px-3.5 py-2 whitespace-nowrap">
                      <span className="font-medium text-stone-900">
                        {s.isAnonymous ? s.visitorId : s.userName || 'Signed-in User'}
                      </span>
                      <span className="text-stone-400 ml-2 text-[11px]">
                        {s.location.city || s.location.country || 'Malawi'}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {renderStatusBadge(s.status, s.currentWaitSeconds)}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate text-stone-700">
                      {s.currentTitle || s.currentPath}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {renderIntentBadge(s.intent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-stone-500 py-2">No active visitor sessions right now.</p>
        )}

        {renderSessionDrawer()}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-stone-200">
        <div className="min-w-0">
          <h2 className="tm-h1">Live visitors</h2>
          <p className="tm-muted mt-0.5">
            Who is browsing now, and for how long.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="tm-actions">
          <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 text-xs">
            <span className="text-stone-500 px-1.5 text-[11px]">Refresh:</span>
            {[
              { label: '5s', val: 5000 },
              { label: '15s', val: 15000 },
              { label: 'Off', val: 0 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setAutoRefreshInterval(opt.val)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  autoRefreshInterval === opt.val
                    ? 'bg-white text-stone-900 font-semibold '
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="tm-btn tm-btn-secondary tm-btn-sm"
            title="Refresh now" aria-label="Refresh now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="tm-btn tm-btn-secondary tm-btn-sm"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-sm border border-stone-200 p-1 z-30 space-y-0.5">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-stone-800 hover:bg-stone-100 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-stone-800 hover:bg-stone-100 rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-stone-500" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {canClear && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="tm-btn tm-btn-danger tm-btn-sm"
              title="Clear session history" aria-label="Clear session history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="tm-panel min-w-0">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Active now</span>
            <Users className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">
            {summary.activeNow}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {summary.anonymousNow} anonymous · {summary.authenticatedNow} signed in
          </p>
        </div>

        <div className="tm-panel min-w-0">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Avg. time on page</span>
            <Clock className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">
            {formatWaitDuration(summary.avgWaitSeconds)}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Longest: <span className="tabular-nums font-medium text-stone-700">{formatWaitDuration(summary.longestWaitSeconds)}</span>
          </p>
        </div>

        <div className="tm-panel min-w-0">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Viewing stays</span>
            <Building2 className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">
            {summary.highIntentCount}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5 truncate">
            {summary.topProperties[0]
              ? `Most viewed: ${summary.topProperties[0].name}`
              : 'Visitors exploring listings'}
          </p>
        </div>

        <div className="tm-panel min-w-0">
          <div className="flex items-center justify-between text-stone-500 text-xs font-medium mb-1">
            <span>Locations</span>
            <Globe className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl font-serif font-bold text-stone-900 tabular-nums">
            {summary.geoBreakdown.length || 1}
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5 truncate">
            {summary.geoBreakdown.length > 0
              ? summary.geoBreakdown.slice(0, 3).map((g) => `${g.country} (${g.percent}%)`).join(' · ')
              : 'Malawi (100%)'}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs min-w-0">
          {[
            { id: 'all', label: 'All', count: data?.recentSessions.length || 0 },
            { id: 'anonymous', label: 'Anonymous', count: data?.recentSessions.filter((s) => s.isAnonymous).length || 0 },
            { id: 'authenticated', label: 'Signed in', count: data?.recentSessions.filter((s) => !s.isAnonymous).length || 0 },
            { id: 'high_intent', label: 'Viewing stays', count: data?.recentSessions.filter((s) => s.conversionLikelihood === 'High').length || 0 },
            { id: 'waiting_long', label: 'Over 1 min', count: data?.recentSessions.filter((s) => s.currentWaitSeconds >= 60).length || 0 },
          ].map((tab) => {
            const selected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as TrafficFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  selected
                    ? 'bg-stone-900 text-white font-semibold '
                    : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selected ? 'bg-stone-800 text-stone-200' : 'bg-stone-100 text-stone-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64 min-w-0">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search visitor, city or page"
            className="tm-input pl-8 pr-7"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Visitor Sessions Table */}
      <div className="bg-white rounded-xl border border-stone-200  overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-stone-500">
            <p className="text-sm font-medium text-stone-900">No visitors match this filter</p>
            <p className="tm-muted mt-0.5">Clear the search or pick All.</p>
          </div>
        ) : (
          <>
            {/* Desktop & Laptop Table (md+) */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500">
                    <th className="px-4 py-2.5">Visitor</th>
                    <th className="px-3.5 py-2.5 whitespace-nowrap">Status</th>
                    <th className="px-3.5 py-2.5">Current page</th>
                    <th className="px-3.5 py-2.5">Activity</th>
                    <th className="hidden xl:table-cell px-3.5 py-2.5">Recent pages</th>
                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredSessions.map((s) => {
                    const isSelected = selectedSession?.sessionId === s.sessionId;
                    return (
                      <tr
                        key={s.sessionId}
                        onClick={() => setSelectedSession(s)}
                        className={`hover:bg-stone-50/90 transition-colors cursor-pointer ${
                          isSelected ? 'bg-stone-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-stone-900 text-xs">
                              {s.isAnonymous ? s.visitorId : s.userName || 'Signed-in User'}
                            </span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                              s.isAnonymous
                                ? 'bg-stone-100 text-stone-600'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}>
                              {s.isAnonymous ? 'Guest' : s.userRole || 'User'}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5">
                            {renderDeviceIcon(s.device?.type, 'w-3 h-3')}
                            <span>{s.location.city || s.location.country || 'Malawi'}</span>
                            <span>·</span>
                            <span>{s.device?.os || 'Web'}</span>
                          </div>
                        </td>

                        <td className="px-3.5 py-3 align-top whitespace-nowrap">
                          <div>{renderStatusBadge(s.status, s.currentWaitSeconds)}</div>
                          <div className="text-[11px] text-stone-400 mt-0.5">
                            Session: <span className="tabular-nums text-stone-600">{formatWaitDuration(s.totalSessionSeconds)}</span>
                          </div>
                        </td>

                        <td className="px-3.5 py-3 align-top">
                          <div className="font-medium text-stone-900 max-w-[200px] truncate">
                            {s.currentTitle || s.currentPath}
                          </div>
                          <div className="text-[11px] text-stone-400 tabular-nums truncate max-w-[200px] mt-0.5">
                            {s.currentPath}
                          </div>
                        </td>

                        <td className="px-3.5 py-3 align-top">
                          <div>{renderIntentBadge(s.intent)}</div>
                          <div className="text-[11px] text-stone-500 line-clamp-1 max-w-[220px] mt-0.5">
                            {s.intentSummary}
                          </div>
                        </td>

                        <td className="hidden xl:table-cell px-3.5 py-3 align-top">
                          <div className="flex items-center gap-1 flex-wrap max-w-[240px]">
                            {s.steps.slice(-3).map((st, i) => (
                              <span
                                key={i}
                                className="text-[11px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded truncate max-w-[120px]"
                                title={`${st.title} (${formatWaitDuration(st.dwellSeconds)})`}
                              >
                                {st.hotelName || (st.path === '/' ? 'Home' : st.path.replace(/\//g, ''))}
                              </span>
                            ))}
                            {s.steps.length > 3 && (
                              <span className="text-[11px] text-stone-400">+{s.steps.length - 3}</span>
                            )}
                          </div>
                        </td>

                        <td className="px-3.5 py-3 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSession(s);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-stone-700 border border-stone-200 bg-white hover:bg-stone-50 rounded-lg transition cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card List (<md) */}
            <div className="xl:hidden divide-y divide-stone-100">
              {filteredSessions.map((s) => {
                const isSelected = selectedSession?.sessionId === s.sessionId;
                return (
                  <div
                    key={`mobile-${s.sessionId}`}
                    onClick={() => setSelectedSession(s)}
                    className={`p-3.5 space-y-2.5 cursor-pointer transition hover:bg-stone-50/80 ${
                      isSelected ? 'bg-stone-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-stone-900 text-xs truncate">
                            {s.isAnonymous ? s.visitorId : s.userName || 'Signed-in User'}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded shrink-0 ${
                            s.isAnonymous
                              ? 'bg-stone-100 text-stone-600'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {s.isAnonymous ? 'Guest' : s.userRole || 'User'}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5">
                          {renderDeviceIcon(s.device?.type, 'w-3 h-3')}
                          <span>{s.location.city || s.location.country || 'Malawi'}</span>
                          <span>·</span>
                          <span>{s.device?.os || 'Web'}</span>
                        </div>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(s.status, s.currentWaitSeconds)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-stone-50/80 border border-stone-200/60 rounded-lg px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-xs text-stone-500 block">Current page</span>
                        <div className="font-medium text-stone-900 truncate mt-0.5">{s.currentTitle || s.currentPath}</div>
                        <div className="text-[11px] text-stone-400 tabular-nums truncate">{s.currentPath}</div>
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs text-stone-500 block">Activity</span>
                        <div className="mt-0.5">{renderIntentBadge(s.intent)}</div>
                        <div className="text-[11px] text-stone-500 truncate mt-0.5">
                          Session: {formatWaitDuration(s.totalSessionSeconds)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <p className="text-[11px] text-stone-500 truncate flex-1">{s.intentSummary}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSession(s);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-stone-700 border border-stone-200 bg-white hover:bg-stone-50 rounded-lg transition cursor-pointer shrink-0"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {renderSessionDrawer()}

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Visitor History"
        message="Clear all active in-memory visitor session records? This cannot be undone."
        confirmText="Clear History"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmClearBuffer}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
