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
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Active · {formatWaitDuration(waitSecs)}</span>
        </span>
      );
    }
    if (status === 'waiting') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>Waiting · {formatWaitDuration(waitSecs)}</span>
        </span>
      );
    }
    if (status === 'background' || status === 'idle') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
          <span className="w-2 h-2 rounded-full bg-stone-400"></span>
          <span>Idle · {formatWaitDuration(waitSecs)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-400">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-300"></span>
        <span>Exited</span>
      </span>
    );
  };

  const renderIntentBadge = (intent: string, score: number) => {
    if (intent === 'booking_intent') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80">
          <span>Booking Intent</span>
          <span className="font-mono text-[9px] opacity-80">{score}%</span>
        </span>
      );
    }
    if (intent === 'host_inquiry') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-stone-900 text-amber-300 border border-stone-800">
          <span>Host Scout</span>
          <span className="font-mono text-[9px] opacity-80">{score}%</span>
        </span>
      );
    }
    if (intent === 'price_comparing') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50/80 text-amber-900 border border-amber-200">
          <span>Comparing</span>
          <span className="font-mono text-[9px] opacity-80">{score}%</span>
        </span>
      );
    }
    if (intent === 'exploring_stays') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span>Exploring Stays</span>
          <span className="font-mono text-[9px] opacity-80">{score}%</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
        <span>Browsing</span>
        <span className="font-mono text-[9px] text-stone-400">{score}%</span>
      </span>
    );
  };

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.toLowerCase().trim();

    return data.recentSessions.filter((s) => {
      // Filter tab
      if (activeFilter === 'anonymous' && !s.isAnonymous) return false;
      if (activeFilter === 'authenticated' && s.isAnonymous) return false;
      if (activeFilter === 'high_intent' && s.conversionLikelihood !== 'High') return false;
      if (activeFilter === 'waiting_long' && s.currentWaitSeconds < 60) return false;

      // Text query
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
        'Wait / Dwell Seconds',
        'Total Session Seconds',
        'Intent Category',
        'Intent Score',
        'Intent Summary',
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
        `"${s.isAnonymous ? 'Anonymous' : 'Authenticated'}"`,
        `"${(s.userName || 'Anonymous Guest').replace(/"/g, '""')}"`,
        `"${(s.userEmail || '').replace(/"/g, '""')}"`,
        `"${s.status}"`,
        `"${s.currentPath.replace(/"/g, '""')}"`,
        `"${s.currentTitle.replace(/"/g, '""')}"`,
        s.currentWaitSeconds,
        s.totalSessionSeconds,
        `"${s.intent}"`,
        s.intentScore,
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

      const csvString = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const anchor = document.createElement('a');
      anchor.setAttribute('href', encodeURI(csvString));
      anchor.setAttribute('download', `travel_malawi_live_traffic_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setShowExportMenu(false);
      toast.success('Exported live traffic telemetry to CSV');
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
      anchor.setAttribute('download', `travel_malawi_live_traffic_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setShowExportMenu(false);
      toast.success('Exported live traffic telemetry to JSON');
    } catch {
      toast.error('Failed to export JSON');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 shadow-2xs">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-900 border-t-transparent mx-auto mb-2"></div>
        <p className="text-xs font-semibold text-stone-900">Connecting to Traffic &amp; Waiting Telemetry...</p>
        <p className="text-[11px] text-stone-500 mt-0.5">Capturing live anonymous &amp; authenticated visitor streams</p>
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

  return (
    <div className="space-y-3.5">
      {/* COMPACT TOP BAR: Controls & Stream Health */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-stone-900 text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 leading-tight">
                  Live Traffic &amp; Waiting Intelligence
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Stream
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Real-time traffic telemetry and dwell/waiting metrics for anonymous visitors and authenticated users.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Auto refresh cadence selector */}
            <div className="flex items-center gap-1.5 bg-stone-100 rounded-lg p-1 text-[11px]">
              <span className="text-stone-400 px-1 font-medium">Refresh:</span>
              <button
                type="button"
                onClick={() => setAutoRefreshInterval(3000)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  autoRefreshInterval === 3000 ? 'bg-stone-900 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                3s
              </button>
              <button
                type="button"
                onClick={() => setAutoRefreshInterval(5000)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  autoRefreshInterval === 5000 ? 'bg-stone-900 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                5s
              </button>
              <button
                type="button"
                onClick={() => setAutoRefreshInterval(0)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  autoRefreshInterval === 0 ? 'bg-stone-900 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Pause
              </button>
            </div>

            {/* Manual Refresh */}
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg border border-stone-200 transition cursor-pointer"
              title="Refresh now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-stone-500" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-stone-200 p-1 z-30 space-y-0.5">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-stone-800 hover:bg-stone-100 rounded-lg flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Export as CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-stone-800 hover:bg-stone-100 rounded-lg flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5 text-stone-500" />
                      <span>Export as JSON</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Clear button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200/60 transition cursor-pointer"
              title="Clear traffic buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* HIGH-DENSITY COMPACT KPI METRIC STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3.5 pt-3.5 border-t border-stone-100">
          {/* 1. Live Active Traffic & Anon Breakdown */}
          <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/70">
            <div className="flex items-center justify-between text-stone-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Active Traffic</span>
              <Users className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">
                {summary.activeNow}
              </span>
              <span className="text-[11px] text-stone-500">Live now</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-1 flex items-center gap-2 truncate">
              <span className="font-semibold text-amber-900">{summary.anonymousNow} Anonymous</span>
              <span>·</span>
              <span>{summary.authenticatedNow} Signed In</span>
            </div>
          </div>

          {/* 2. Dwell & Waiting Time */}
          <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/70">
            <div className="flex items-center justify-between text-stone-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Waiting / Dwell</span>
              <Clock className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">
                {formatWaitDuration(summary.avgWaitSeconds)}
              </span>
              <span className="text-[11px] text-stone-500">Avg dwell</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-1 truncate">
              Longest: <span className="font-mono text-stone-700 font-semibold">{formatWaitDuration(summary.longestWaitSeconds)}</span>
            </div>
          </div>

          {/* 3. Conversion Intent */}
          <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/70">
            <div className="flex items-center justify-between text-stone-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Conversion Intent</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">
                {summary.highIntentCount}
              </span>
              <span className="text-[11px] text-stone-500">High-intent</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-1 truncate">
              {summary.topProperties[0] ? (
                <>Top eyed: <span className="font-semibold text-stone-800">{summary.topProperties[0].name}</span></>
              ) : (
                'Tracking active lodge selections'
              )}
            </div>
          </div>

          {/* 4. Geography Footprint */}
          <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/70">
            <div className="flex items-center justify-between text-stone-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Geographies</span>
              <Globe className="w-3.5 h-3.5 text-stone-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-serif font-bold text-stone-900 tabular-nums">
                {summary.geoBreakdown.length || 1}
              </span>
              <span className="text-[11px] text-stone-500">Regions</span>
            </div>
            <div className="text-[10px] text-stone-500 mt-1 truncate flex items-center gap-1.5">
              {summary.geoBreakdown.slice(0, 3).map((g) => (
                <span key={g.country} title={`${g.country}: ${g.percent}%`}>
                  {g.flag} {g.country.slice(0, 8)} ({g.percent}%)
                </span>
              ))}
              {summary.geoBreakdown.length === 0 && <span>🇲🇼 Malawi (100%)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Compact Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              All Traffic ({data?.recentSessions.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('anonymous')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                activeFilter === 'anonymous'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              Anonymous ({data?.recentSessions.filter((s) => s.isAnonymous).length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('authenticated')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                activeFilter === 'authenticated'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              Signed In ({data?.recentSessions.filter((s) => !s.isAnonymous).length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('high_intent')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                activeFilter === 'high_intent'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              High Intent ({data?.recentSessions.filter((s) => s.conversionLikelihood === 'High').length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('waiting_long')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                activeFilter === 'waiting_long'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              Waiting &gt; 1m ({data?.recentSessions.filter((s) => s.currentWaitSeconds >= 60).length || 0})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor ID, city, path, lodge..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* COMPACT HIGH-DENSITY TRAFFIC MATRIX */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-stone-500">
            <Radio className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-stone-900">No visitors match the current filter</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Try clearing the search query or switching tabs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-200 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="px-3.5 py-2.5">Visitor &amp; Telemetry</th>
                  <th className="px-3 py-2.5">Waiting &amp; Presence</th>
                  <th className="px-3 py-2.5">Current Stop &amp; Path</th>
                  <th className="px-3 py-2.5">Intelligent Intent</th>
                  <th className="px-3 py-2.5">Journey Breadcrumbs</th>
                  <th className="px-2.5 py-2.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSessions.map((s) => {
                  const isSelected = selectedSession?.sessionId === s.sessionId;
                  return (
                    <tr
                      key={s.sessionId}
                      onClick={() => setSelectedSession(s)}
                      className={`hover:bg-amber-50/30 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-amber-50/60 ring-1 ring-amber-300 inset-0' : ''
                      }`}
                    >
                      {/* Visitor & Telemetry */}
                      <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{s.location.flag || '🇲🇼'}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-stone-900 font-mono text-[11px]">
                                {s.isAnonymous ? s.visitorId : s.userName || 'Signed User'}
                              </span>
                              {s.isAnonymous ? (
                                <span className="text-[9px] uppercase font-bold px-1 py-0.2 bg-stone-100 text-stone-600 rounded">
                                  Anon
                                </span>
                              ) : (
                                <span className="text-[9px] uppercase font-bold px-1 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                                  {s.userRole || 'User'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1">
                              {renderDeviceIcon(s.device?.type, 'w-3 h-3')}
                              <span>{s.location.city || s.location.country || 'Malawi'}</span>
                              <span>·</span>
                              <span className="font-mono">{s.device?.os || 'Web'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Waiting & Presence */}
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div>{renderStatusBadge(s.status, s.currentWaitSeconds)}</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">
                          Total: <span className="font-mono font-medium text-stone-600">{formatWaitDuration(s.totalSessionSeconds)}</span>
                          <span className="ml-1.5">({s.totalInteractions} actions)</span>
                        </div>
                      </td>

                      {/* Current Stop & Path */}
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-medium text-stone-900 max-w-[210px] truncate leading-tight">
                          {s.currentTitle || s.currentPath}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono truncate max-w-[210px] mt-0.5">
                          {s.currentPath}
                        </div>
                      </td>

                      {/* Intelligent Intent */}
                      <td className="px-3 py-2.5 align-top">
                        <div>{renderIntentBadge(s.intent, s.intentScore)}</div>
                        <div className="text-[10px] text-stone-600 line-clamp-1 max-w-[260px] mt-0.5">
                          {s.intentSummary}
                        </div>
                      </td>

                      {/* Journey Trail */}
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex items-center gap-1 flex-wrap max-w-[260px]">
                          {s.steps.slice(-3).map((st, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded truncate max-w-[110px]"
                              title={`${st.title} (${formatWaitDuration(st.dwellSeconds)})`}
                            >
                              {st.hotelName || (st.path === '/' ? 'Home' : st.path.replace(/\//g, ''))}
                              <span className="text-stone-400 ml-1 font-mono text-[9px]">
                                {formatWaitDuration(st.dwellSeconds)}
                              </span>
                            </span>
                          ))}
                          {s.steps.length > 3 && (
                            <span className="text-[9px] text-stone-400 font-medium">+{s.steps.length - 3}</span>
                          )}
                        </div>
                      </td>

                      {/* Inspect */}
                      <td className="px-2.5 py-2.5 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(s);
                          }}
                          className="p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded transition cursor-pointer"
                          title="Inspect deep telemetry"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COMPACT SLIDE-OVER INSPECTION BLADE */}
      {selectedSession && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl border-l border-stone-200 z-50 flex flex-col animate-in slide-in-from-right-4 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
            <div className="flex items-center gap-2">
              <span className="text-xl">{selectedSession.location.flag || '🇲🇼'}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-stone-900 text-sm font-mono">
                    {selectedSession.visitorId}
                  </h4>
                  {selectedSession.isAnonymous ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-stone-200 text-stone-700 rounded">
                      Anonymous
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                      {selectedSession.userRole || 'User'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Started {formatDistanceToNow(new Date(selectedSession.startedAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSession(null)}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Intelligent Intent Card */}
            <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  Intelligent Intent Analysis
                </span>
                {renderIntentBadge(selectedSession.intent, selectedSession.intentScore)}
              </div>
              <p className="text-xs text-amber-950 font-medium">
                {selectedSession.intentSummary}
              </p>
              <div className="text-[11px] text-amber-800 flex items-center gap-3 pt-1 border-t border-amber-200/60">
                <span>Conversion: <strong className="text-amber-950">{selectedSession.conversionLikelihood}</strong></span>
                <span>·</span>
                <span>Interactions: <strong className="text-amber-950">{selectedSession.totalInteractions}</strong></span>
              </div>
            </div>

            {/* Waiting Telemetry */}
            <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Waiting &amp; Dwell Telemetry
              </span>
              <div className="grid grid-cols-2 gap-2 text-stone-700">
                <div>
                  <span className="text-stone-400 block text-[10px]">Current Page Wait</span>
                  <span className="font-mono font-bold text-stone-900 text-sm">
                    {formatWaitDuration(selectedSession.currentWaitSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Total Session Dwell</span>
                  <span className="font-mono font-bold text-stone-900 text-sm">
                    {formatWaitDuration(selectedSession.totalSessionSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Active Interacting</span>
                  <span className="font-mono font-medium text-emerald-700">
                    {formatWaitDuration(selectedSession.activeSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Idle / Background</span>
                  <span className="font-mono font-medium text-stone-500">
                    {formatWaitDuration(selectedSession.idleSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Network & Location */}
            <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Network &amp; Geolocation
              </span>
              <div className="grid grid-cols-2 gap-2 text-stone-700">
                <div>
                  <span className="text-stone-400 block text-[10px]">Client IP</span>
                  <span className="font-mono text-stone-900">{selectedSession.ip}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">City / Country</span>
                  <span className="font-medium text-stone-900">
                    {selectedSession.location.city}, {selectedSession.location.country}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Device / OS</span>
                  <span className="font-medium text-stone-900">
                    {selectedSession.device.type} · {selectedSession.device.os}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Browser</span>
                  <span className="font-medium text-stone-900">{selectedSession.device.browser}</span>
                </div>
              </div>
            </div>

            {/* Complete Chronological Journey */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Chronological Stop History ({selectedSession.steps.length} stops)
              </span>
              <div className="space-y-1.5">
                {selectedSession.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-900 text-[11px] truncate max-w-[260px]">
                        {idx + 1}. {st.title || st.path}
                      </span>
                      <span className="font-mono text-stone-600 font-semibold text-[10px]">
                        {formatWaitDuration(st.dwellSeconds)} dwell
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono mt-0.5 truncate">
                      {st.path}
                    </div>
                    {st.hotelName && (
                      <div className="text-[10px] text-amber-800 font-semibold mt-1">
                        Eyed Stay: {st.hotelName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Traffic Buffer"
        message="Clear all in-memory traffic and waiting telemetry records? This cannot be undone."
        confirmText="Clear Buffer"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={confirmClearBuffer}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
