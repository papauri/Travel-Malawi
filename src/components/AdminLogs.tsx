import React, { useEffect, useMemo, useState } from 'react';
import {
  SystemLog,
  subscribeToSystemLogs,
  deleteSystemLog,
  clearAllSystemLogs,
  bundleLogsByUser,
  UserSessionGroup,
  SessionBundle,
  LogCategory,
  normalizeSystemLog,
} from '../lib/logger';
import {
  Shield,
  ShieldCheck,
  Activity,
  User,
  Clock,
  Monitor,
  Smartphone,
  Laptop,
  Tablet,
  MapPin,
  Globe,
  Search,
  Filter,
  Download,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Info,
  SlidersHorizontal,
  Layers,
  Calendar,
  ArrowUpDown,
  Eye,
  RefreshCw,
  FileSpreadsheet,
  Building2,
  CalendarCheck,
  Key,
  Sparkles,
  Lock,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import Pagination from './Pagination';

type MainViewMode = 'intune_table' | 'session_bundles';
type DateRangeFilter = 'all' | '24h' | '7d' | '30d';
type StatusFilter = 'all' | 'Success' | 'Failed' | 'Info';
type BladeTab = 'summary' | 'actor' | 'target' | 'diff' | 'payload';

export default function AdminLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [mainView, setMainView] = useState<MainViewMode>('intune_table');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Intune Table sorting & mobile view
  const [sortField, setSortField] = useState<'timestamp' | 'activity' | 'userName' | 'status'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [mobileTableStyle, setMobileTableStyle] = useState<'responsive_cards' | 'dense_table'>('responsive_cards');

  // Slide-over Intune Details Blade
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [bladeTab, setBladeTab] = useState<BladeTab>('summary');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // User Session Bundles UI state
  const [expandedUserKeys, setExpandedUserKeys] = useState<Record<string, boolean>>({});
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});

  // Export menu
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Subscribe to real-time Firestore stream
  useEffect(() => {
    const unsubscribe = subscribeToSystemLogs((data) => {
      setLogs(data);
      setLoading(false);
    }, 400);

    return () => unsubscribe();
  }, []);

  // Filter logs based on date range, category, status, role, search query
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    let minTime = 0;
    if (dateRange === '24h') minTime = now - 24 * 60 * 60 * 1000;
    else if (dateRange === '7d') minTime = now - 7 * 24 * 60 * 60 * 1000;
    else if (dateRange === '30d') minTime = now - 30 * 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      // 1. Date Range
      if (minTime > 0 && log.timestamp < minTime) return false;

      // 2. Category
      if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;

      // 3. Status
      if (selectedStatus !== 'all' && log.status !== selectedStatus) return false;

      // 4. Role
      if (selectedRole !== 'all') {
        const userRole = (log.userRole || '').toLowerCase();
        if (selectedRole === 'system' && (log.userId || log.userEmail)) return false;
        if (selectedRole !== 'system' && !userRole.includes(selectedRole.toLowerCase())) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const activity = (log.activity || '').toLowerCase();
        const target = (log.target || '').toLowerCase();
        const msg = (log.message || '').toLowerCase();
        const userName = (log.userName || '').toLowerCase();
        const userEmail = (log.userEmail || '').toLowerCase();
        const role = (log.userRole || '').toLowerCase();
        const ip = (log.ip || '').toLowerCase();
        const city = (log.location?.city || '').toLowerCase();
        const country = (log.location?.country || '').toLowerCase();
        const sid = (log.sessionId || '').toLowerCase();
        const os = (log.device?.os || '').toLowerCase();
        const browser = (log.device?.browser || '').toLowerCase();

        const match =
          activity.includes(q) ||
          target.includes(q) ||
          msg.includes(q) ||
          userName.includes(q) ||
          userEmail.includes(q) ||
          role.includes(q) ||
          ip.includes(q) ||
          city.includes(q) ||
          country.includes(q) ||
          sid.includes(q) ||
          os.includes(q) ||
          browser.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [logs, dateRange, selectedCategory, selectedStatus, selectedRole, searchQuery]);

  // Sorted logs for Intune Table
  const sortedLogs = useMemo(() => {
    const list = [...filteredLogs];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === 'activity') {
        valA = (a.activity || a.message).toLowerCase();
        valB = (b.activity || b.message).toLowerCase();
      } else if (sortField === 'userName') {
        valA = (a.userName || a.userEmail || '').toLowerCase();
        valB = (b.userName || b.userEmail || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLogs, sortField, sortOrder]);

  // User session bundles
  const userBundles: UserSessionGroup[] = useMemo(() => {
    return bundleLogsByUser(filteredLogs);
  }, [filteredLogs]);

  // Telemetry metrics strip
  const metrics = useMemo(() => {
    const totalEvents = logs.length;
    const successCount = logs.filter((l) => l.status === 'Success').length;
    const failedCount = logs.filter((l) => l.status === 'Failed' || l.type === 'error').length;
    const successRate = totalEvents > 0 ? Math.round((successCount / totalEvents) * 100) : 100;

    // Distinct locations
    const locSet = new Set<string>();
    const activeSessionsSet = new Set<string>();
    const now = Date.now();

    logs.forEach((l) => {
      if (l.location?.country) {
        locSet.add(`${l.location.flag || ''} ${l.location.country}`);
      }
      if (l.sessionId && now - l.timestamp < 15 * 60 * 1000) {
        activeSessionsSet.add(l.sessionId);
      }
    });

    return {
      totalEvents,
      successCount,
      failedCount,
      successRate,
      activeSessions: activeSessionsSet.size,
      distinctCountries: locSet.size,
      sampleLocations: Array.from(locSet).slice(0, 3),
    };
  }, [logs]);

  // Toggle user group accordion in Session Bundles view
  const toggleUserExpanded = (userKey: string) => {
    setExpandedUserKeys((prev) => ({
      ...prev,
      [userKey]: !prev[userKey],
    }));
  };

  // Toggle single session bundle accordion
  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessionIds((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  // Quick jump from a session bundle to filtered Intune Table
  const handleFilterBySession = (sessionId: string) => {
    setSearchQuery(sessionId);
    setMainView('intune_table');
  };

  // Copy helper with feedback
  const handleCopyText = (key: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  // Delete single log
  const handleDeleteLog = async (id?: string) => {
    if (!id) return;
    try {
      await deleteSystemLog(id);
      if (selectedLog?.id === id) {
        setSelectedLog(null);
      }
      toast.success('Log entry deleted');
    } catch {
      toast.error('Failed to delete log entry');
    }
  };

  // Clear all logs
  const handleClearAllLogs = async () => {
    if (!window.confirm('Are you sure you want to delete all audit & system logs? This cannot be undone.')) {
      return;
    }
    setClearing(true);
    try {
      await clearAllSystemLogs();
      setSelectedLog(null);
      toast.success('All audit records deleted');
    } catch {
      toast.error('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    try {
      const headers = [
        'Date and Time (UTC)',
        'Date and Time (Local)',
        'Activity / Operation',
        'Status',
        'Initiated By Name',
        'Initiated By Email',
        'Role',
        'Target Resource',
        'Target Type',
        'Category',
        'Client IP',
        'City',
        'Region',
        'Country',
        'Device Type',
        'Device OS',
        'Device Browser',
        'Session ID',
        'Message',
        'Details Payload',
      ];

      const rows = filteredLogs.map((l) => [
        `"${new Date(l.timestamp).toISOString()}"`,
        `"${format(new Date(l.timestamp), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${(l.activity || l.message).replace(/"/g, '""')}"`,
        `"${l.status || (l.type === 'error' ? 'Failed' : 'Success')}"`,
        `"${(l.userName || 'System Core').replace(/"/g, '""')}"`,
        `"${(l.userEmail || '').replace(/"/g, '""')}"`,
        `"${(l.userRole || 'System').replace(/"/g, '""')}"`,
        `"${(l.target || 'Platform').replace(/"/g, '""')}"`,
        `"${(l.targetType || 'System').replace(/"/g, '""')}"`,
        `"${(l.category || 'system').replace(/"/g, '""')}"`,
        `"${(l.ip || '').replace(/"/g, '""')}"`,
        `"${(l.location?.city || '').replace(/"/g, '""')}"`,
        `"${(l.location?.region || '').replace(/"/g, '""')}"`,
        `"${(l.location?.country || '').replace(/"/g, '""')}"`,
        `"${(l.device?.type || '').replace(/"/g, '""')}"`,
        `"${(l.device?.os || '').replace(/"/g, '""')}"`,
        `"${(l.device?.browser || '').replace(/"/g, '""')}"`,
        `"${(l.sessionId || '').replace(/"/g, '""')}"`,
        `"${(l.message || '').replace(/"/g, '""')}"`,
        `"${l.details ? JSON.stringify(l.details).replace(/"/g, '""') : ''}"`,
      ]);

      const csvString = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const anchor = document.createElement('a');
      anchor.setAttribute('href', encodeURI(csvString));
      anchor.setAttribute('download', `travel_malawi_intune_audit_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setShowExportMenu(false);
      toast.success(`Exported ${filteredLogs.length} audit records to CSV`);
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
      const anchor = document.createElement('a');
      anchor.setAttribute('href', dataStr);
      anchor.setAttribute('download', `travel_malawi_intune_audit_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setShowExportMenu(false);
      toast.success(`Exported ${filteredLogs.length} audit records to JSON`);
    } catch {
      toast.error('Failed to export JSON');
    }
  };

  // Device icon component
  const renderDeviceIcon = (type?: string, className = 'w-3.5 h-3.5') => {
    if (type === 'Mobile') return <Smartphone className={className} />;
    if (type === 'Tablet') return <Tablet className={className} />;
    return <Laptop className={className} />;
  };

  // Intune Status Badge
  const renderStatusBadge = (status?: string, type?: string) => {
    const isFailed = status === 'Failed' || type === 'error';
    if (isFailed) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Failed</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>Success</span>
      </span>
    );
  };

  // Category Badge
  const renderCategoryBadge = (cat?: LogCategory) => {
    const map: Record<string, { label: string; bg: string; text: string }> = {
      admin: { label: 'Role-Based Access Control', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
      security: { label: 'Security & Suspensions', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
      auth: { label: 'Authentication', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
      session: { label: 'Session & Device', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
      booking: { label: 'Reservations & Bookings', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
      property: { label: 'Property Management', bg: 'bg-amber-50/80 border-amber-200', text: 'text-amber-900' },
      ai: { label: 'Ulendo Concierge AI', bg: 'bg-stone-100 border-stone-300', text: 'text-stone-800' },
      system: { label: 'System Configuration', bg: 'bg-stone-50 border-stone-200', text: 'text-stone-600' },
    };
    const c = (cat && map[cat]) || { label: cat || 'General', bg: 'bg-stone-100 border-stone-200', text: 'text-stone-700' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  // User Role Badge
  const renderRoleBadge = (role?: string) => {
    if (!role) {
      return <span className="text-[11px] text-stone-400 italic">System Core</span>;
    }
    const rLower = role.toLowerCase();
    let badgeClass = 'bg-stone-100 text-stone-700 border-stone-200';
    if (rLower.includes('admin')) {
      badgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
    } else if (rLower.includes('manager') || rLower.includes('host')) {
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (rLower.includes('traveller')) {
      badgeClass = 'bg-sky-50 text-sky-800 border-sky-200';
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}`}>
        <User className="w-2.5 h-2.5" />
        <span className="capitalize">{role}</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 sm:p-14 text-center bg-white rounded-2xl border border-stone-200 shadow-xs">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-stone-900 border-t-transparent mx-auto mb-3"></div>
        <p className="text-sm font-bold text-stone-800">Loading Intune Audit & Session Telemetry...</p>
        <p className="text-xs text-stone-400 mt-1">Connecting to live Firestore activity streams</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* ================= INTUNE AUDIT LOGS HEADER ================= */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight">Audit Logs</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Microsoft Intune–styled compliance tracking, IP geolocation, user session bundling, and resource audits.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-stretch lg:self-auto justify-end">
            
            {/* Export Dropdown */}
            <div className="relative flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                title="Export Intune Audit Data"
              >
                <Download className="w-4 h-4 text-stone-600" />
                <span>Export Audit</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
              </button>

              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-stone-200 p-1.5 z-30 space-y-1">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="w-full min-h-[44px] text-left px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-100 rounded-lg flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="font-bold">Export as CSV (Intune Table)</div>
                        <div className="text-[10px] text-stone-400">Columns with IP, location, activity</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="w-full min-h-[44px] text-left px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-100 rounded-lg flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-stone-500" />
                      <div>
                        <div className="font-bold">Export as JSON</div>
                        <div className="text-[10px] text-stone-400">Full audit payloads & raw footprint</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Clear All Logs */}
            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllLogs}
                disabled={clearing}
                className="min-h-[44px] px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border border-rose-200/60"
                title="Clear all stored logs"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearing ? 'Clearing...' : 'Clear All'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ================= INTUNE METRICS STRIP ================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-5">
          {/* Total Events */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-stone-200 bg-stone-50/80">
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Total Audited Events</span>
              <Activity className="w-4 h-4 text-stone-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-stone-900">{metrics.totalEvents}</div>
            <div className="text-[11px] text-stone-500 mt-0.5">Historical event stream</div>
          </div>

          {/* Success Rate */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-stone-200 bg-emerald-50/30">
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Success Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800">{metrics.successRate}%</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">{metrics.successCount} successful operations</div>
          </div>

          {/* Active Sessions */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-stone-200 bg-indigo-50/30">
            <div className="flex items-center justify-between text-indigo-800 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Active Sessions</span>
              <Monitor className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-900">{metrics.activeSessions}</div>
            <div className="text-[11px] text-indigo-600 mt-0.5">Active in last 15 mins</div>
          </div>

          {/* Locations & Flag Footprint */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-stone-200 bg-amber-50/30">
            <div className="flex items-center justify-between text-amber-900 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Geolocations</span>
              <Globe className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-stone-900">
              {metrics.distinctCountries > 0 ? `${metrics.distinctCountries} Countries` : '1 Region'}
            </div>
            <div className="text-[11px] text-amber-900/80 mt-0.5 truncate">
              {metrics.sampleLocations.length > 0 ? metrics.sampleLocations.join(' · ') : '🇲🇼 Malawi'}
            </div>
          </div>
        </div>
      </div>

      {/* ================= VIEW MODE SELECTOR (INTUNE TABLE VS USER SESSIONS) ================= */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          
          {/* Main Mode Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl max-w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setMainView('intune_table')}
              className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                mainView === 'intune_table'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Intune Audit Log Table</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                mainView === 'intune_table' ? 'bg-stone-800 text-amber-300' : 'bg-stone-200 text-stone-600'
              }`}>
                {filteredLogs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainView('session_bundles')}
              className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
                mainView === 'session_bundles'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>User Session Bundles</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                mainView === 'session_bundles' ? 'bg-stone-800 text-amber-300' : 'bg-stone-200 text-stone-600'
              }`}>
                {userBundles.length} Users
              </span>
            </button>
          </div>

          {/* If Intune Table view: Mobile style toggle (Cards vs Dense Table) */}
          {mainView === 'intune_table' && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[11px] font-semibold text-stone-400 hidden md:inline">Mobile Format:</span>
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMobileTableStyle('responsive_cards')}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    mobileTableStyle === 'responsive_cards'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  title="Card list with complete touch accessibility on phones"
                >
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTableStyle('dense_table')}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    mobileTableStyle === 'dense_table'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                  title="Horizontal scrollable enterprise table"
                >
                  <span>Dense Table</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= FILTER AND SEARCH BAR ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Search Box */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activity, target, user, IP, location, session..."
              className="w-full min-h-[44px] pl-9 pr-8 py-2 bg-stone-50 hover:bg-stone-100/80 focus:bg-white text-stone-900 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range */}
          <div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
              className="w-full min-h-[44px] px-3 py-2 bg-stone-50 text-stone-800 text-xs font-medium rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 bg-stone-50 text-stone-800 text-xs font-medium rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="admin">Role-Based Access Control</option>
              <option value="property">Property Management</option>
              <option value="booking">Reservations & Bookings</option>
              <option value="security">Security & Suspensions</option>
              <option value="auth">Authentication</option>
              <option value="session">Session & Device</option>
              <option value="ai">Ulendo Concierge AI</option>
            </select>
          </div>

          {/* Result / Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as StatusFilter)}
              className="w-full min-h-[44px] px-3 py-2 bg-stone-50 text-stone-800 text-xs font-medium rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Success">Success Only</option>
              <option value="Failed">Failed / Errors Only</option>
            </select>
          </div>
        </div>

        {/* Filter feedback & reset */}
        <div className="flex items-center justify-between text-xs text-stone-500 pt-1 flex-wrap gap-2">
          <div>
            Showing <strong className="text-stone-900">{filteredLogs.length}</strong> matching records
            {searchQuery && (
              <span className="ml-1 text-amber-800">
                for query: <code className="bg-amber-50 px-1 py-0.5 rounded font-mono">{searchQuery}</code>
              </span>
            )}
          </div>

          {(searchQuery || dateRange !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedRole !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDateRange('all');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSelectedRole('all');
              }}
              className="text-xs font-bold text-amber-800 hover:underline cursor-pointer min-h-[32px] flex items-center"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* ================= TAB 1: INTUNE AUDIT LOG TABLE ================= */}
      {mainView === 'intune_table' && (
        <div className="space-y-3">
          {sortedLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-10 text-center">
              <ShieldCheck className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <h4 className="font-bold text-stone-900 text-base">No Audit Records Found</h4>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                No events matched your current filters. Try resetting the search query or date range.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE RESPONSIVE CARDS (On mobile screens when selected) */}
              <div className={mobileTableStyle === 'responsive_cards' ? 'block md:hidden space-y-3' : 'hidden'}>
                {sortedLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log) => {
                  const timeFormatted = format(new Date(log.timestamp), 'MMM d, yyyy · h:mm a');
                  const timeAgo = formatDistanceToNow(new Date(log.timestamp), { addSuffix: true });

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="bg-white rounded-2xl border border-stone-200 hover:border-stone-400 p-4 transition-all shadow-xs cursor-pointer active:bg-stone-50"
                    >
                      {/* Top Bar: Status + Category + Relative time */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {renderStatusBadge(log.status, log.type)}
                          {renderCategoryBadge(log.category)}
                        </div>
                        <span className="text-[11px] font-semibold text-stone-500 shrink-0">{timeAgo}</span>
                      </div>

                      {/* Middle: Activity & Target */}
                      <div className="pt-2.5 pb-2">
                        <h4 className="text-sm font-bold text-stone-900 leading-snug">
                          {log.activity || log.message}
                        </h4>
                        {log.target && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1.5 rounded-md bg-stone-100 text-[11px] font-medium text-stone-700">
                            <span className="font-bold text-stone-500">Target:</span>
                            <span className="truncate max-w-[220px]">{log.target}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Footer: Actor + Device/Location */}
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs text-stone-600">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-stone-800">
                            {log.userName || log.userEmail || 'System'}
                          </span>
                          {log.userRole && (
                            <span className="text-[10px] text-stone-500">({log.userRole})</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 text-stone-500">
                          {log.location?.flag && <span>{log.location.flag}</span>}
                          {renderDeviceIcon(log.device?.type)}
                          <ChevronRight className="w-4 h-4 text-stone-400" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP & DENSE INTUNE TABLE */}
              <div
                className={`bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden ${
                  mobileTableStyle === 'responsive_cards' ? 'hidden md:block' : 'block'
                }`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 text-[11px] font-bold uppercase tracking-wider select-none">
                        <th
                          className="px-4 py-3.5 w-44 cursor-pointer hover:bg-stone-100/80 transition"
                          onClick={() => {
                            if (sortField === 'timestamp') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortField('timestamp'); setSortOrder('desc'); }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Date and time</span>
                            <ArrowUpDown className="w-3 h-3 text-stone-400" />
                          </div>
                        </th>

                        <th
                          className="px-4 py-3.5 min-w-[220px] cursor-pointer hover:bg-stone-100/80 transition"
                          onClick={() => {
                            if (sortField === 'activity') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortField('activity'); setSortOrder('asc'); }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Activity (Operation)</span>
                            <ArrowUpDown className="w-3 h-3 text-stone-400" />
                          </div>
                        </th>

                        <th
                          className="px-4 py-3.5 w-44 cursor-pointer hover:bg-stone-100/80 transition"
                          onClick={() => {
                            if (sortField === 'userName') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortField('userName'); setSortOrder('asc'); }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>Initiated by (Actor)</span>
                            <ArrowUpDown className="w-3 h-3 text-stone-400" />
                          </div>
                        </th>

                        <th className="px-4 py-3.5 min-w-[170px]">Target(s) / Resource</th>
                        <th className="px-4 py-3.5 w-40">Category</th>
                        <th className="px-4 py-3.5 w-24">Status</th>
                        <th className="px-4 py-3.5 w-48">Client IP & Location</th>
                        <th className="px-4 py-3.5 w-40">Device & OS</th>
                        <th className="px-3 py-3.5 w-16 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                      {sortedLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log) => {
                        const isFailed = log.status === 'Failed' || log.type === 'error';
                        const timeDistance = formatDistanceToNow(new Date(log.timestamp), { addSuffix: true });
                        const formattedDate = format(new Date(log.timestamp), 'MMM d, yyyy');
                        const formattedTime = format(new Date(log.timestamp), 'h:mm:ss a');

                        return (
                          <tr
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className={`hover:bg-stone-50 transition-colors cursor-pointer group ${
                              selectedLog?.id === log.id ? 'bg-amber-50/40 ring-1 ring-amber-300 inset-0' : ''
                            }`}
                          >
                            {/* Date & Time */}
                            <td className="px-4 py-3 align-top whitespace-nowrap text-stone-600">
                              <div className="font-semibold text-stone-900">{formattedDate}</div>
                              <div className="text-[11px] text-stone-400">{formattedTime}</div>
                              <div className="text-[10px] text-stone-500 mt-0.5">{timeDistance}</div>
                            </td>

                            {/* Activity Display Name */}
                            <td className="px-4 py-3 align-top">
                              <div className="font-bold text-stone-900 group-hover:text-amber-900 transition-colors">
                                {log.activity || log.message}
                              </div>
                              <div className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">
                                {log.message}
                              </div>
                              {log.sessionId && (
                                <div className="text-[10px] font-mono text-stone-400 mt-1">
                                  {log.sessionId}
                                </div>
                              )}
                            </td>

                            {/* Initiated by (Actor) */}
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-stone-900 truncate max-w-[160px]">
                                  {log.userName || log.userEmail || 'System Core'}
                                </span>
                                {log.userEmail && log.userName && (
                                  <span className="text-[11px] text-stone-400 truncate max-w-[160px]">
                                    {log.userEmail}
                                  </span>
                                )}
                                <div>{renderRoleBadge(log.userRole)}</div>
                              </div>
                            </td>

                            {/* Target(s) */}
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-stone-800 break-words max-w-[200px]">
                                {log.target || 'Platform / Core'}
                              </div>
                              {log.targetType && (
                                <span className="inline-block mt-1 text-[10px] uppercase font-bold text-stone-400">
                                  {log.targetType}
                                </span>
                              )}
                            </td>

                            {/* Category */}
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              {renderCategoryBadge(log.category)}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              {renderStatusBadge(log.status, log.type)}
                            </td>

                            {/* Client IP & Location */}
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 font-medium text-stone-800">
                                  <span>{log.location?.flag || '🌐'}</span>
                                  <span>{log.location?.city || log.location?.country || 'Malawi'}</span>
                                </div>
                                {log.ip && (
                                  <div className="text-[11px] font-mono text-stone-500">
                                    {log.ip}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Device & OS */}
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-stone-700">
                                {renderDeviceIcon(log.device?.type)}
                                <span className="font-medium text-stone-800">
                                  {log.device?.os || 'Client'}
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-400 mt-0.5">
                                {log.device?.browser || 'Browser'}
                              </div>
                            </td>

                            {/* Action Button */}
                            <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLog(log);
                                }}
                                className="min-h-[32px] min-w-[32px] p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition inline-flex items-center justify-center cursor-pointer"
                                title="Inspect audit details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {sortedLogs.length > itemsPerPage && (
                <div className="pt-2">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(sortedLogs.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================= TAB 2: USER SESSION BUNDLES ================= */}
      {mainView === 'session_bundles' && (
        <div className="space-y-4">
          <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
            <Layers className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                User Session Bundles Active
              </h4>
              <p className="text-xs text-amber-800/90 mt-0.5">
                Activity records are grouped by individual user account. Under each user, browser sessions are packaged
                with their IP address, geolocation, device telemetry, and full chronological activity timeline.
              </p>
            </div>
          </div>

          {userBundles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-10 text-center">
              <User className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <h4 className="font-bold text-stone-900 text-base">No User Sessions Found</h4>
              <p className="text-xs text-stone-500 mt-1">
                Try widening your date filters to see earlier user sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {userBundles.map((group) => {
                const isUserExpanded = !!expandedUserKeys[group.userKey];
                const lastActiveTimeAgo = formatDistanceToNow(new Date(group.lastActiveTime), { addSuffix: true });
                const isRecentlyActive = Date.now() - group.lastActiveTime < 15 * 60 * 1000;

                return (
                  <div
                    key={group.userKey}
                    className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* User Header Accordion Trigger (Min 44px height for mobile touch) */}
                    <div
                      onClick={() => toggleUserExpanded(group.userKey)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-stone-50/80 transition-colors select-none"
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        {/* Avatar / Initial */}
                        <div className="h-11 w-11 rounded-xl bg-stone-900 text-amber-300 font-bold flex items-center justify-center shrink-0 text-sm shadow-xs uppercase">
                          {group.userName.substring(0, 2) || 'TM'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base text-stone-900">{group.userName}</h3>
                            {renderRoleBadge(group.userRole)}
                            {isRecentlyActive && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Active Now
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 mt-1 flex-wrap text-xs text-stone-500">
                            {group.userEmail && <span>{group.userEmail}</span>}
                            <span>·</span>
                            <span>Last active {lastActiveTimeAgo}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right summary badges & expand arrow */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-stone-100 font-semibold text-stone-700">
                            {group.totalSessions} {group.totalSessions === 1 ? 'Session' : 'Sessions'}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-stone-100 font-semibold text-stone-700">
                            {group.totalEvents} Ops
                          </span>
                        </div>

                        <div className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400">
                          {isUserExpanded ? (
                            <ChevronUp className="w-5 h-5 text-stone-700" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-stone-700" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Distinct Locations & Devices Pills */}
                    <div className="px-4 sm:px-5 pb-3.5 flex items-center gap-2 flex-wrap text-xs text-stone-500">
                      {group.distinctLocations.length > 0 && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          <span className="font-medium text-stone-700">Locations:</span>
                          {group.distinctLocations.map((loc, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-stone-100 text-[11px] text-stone-800">
                              {loc}
                            </span>
                          ))}
                        </div>
                      )}

                      {group.distinctDevices.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Monitor className="w-3 h-3 text-stone-400 ml-2" />
                          <span className="font-medium text-stone-700">Devices:</span>
                          {group.distinctDevices.map((dev, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-stone-100 text-[11px] text-stone-800">
                              {dev}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* EXPANDED SESSIONS LIST */}
                    {isUserExpanded && (
                      <div className="border-t border-stone-200 bg-stone-50/50 p-3 sm:p-5 space-y-3">
                        <div className="text-xs font-bold text-stone-500 uppercase tracking-wider px-1">
                          Bundled Browser & Mobile Sessions ({group.sessions.length})
                        </div>

                        {group.sessions.map((session, sIndex) => {
                          const isSessionExpanded = !!expandedSessionIds[session.sessionId];
                          const sessionStartStr = format(new Date(session.startTime), 'MMM d, h:mm a');
                          const sessionEndStr = format(new Date(session.lastActiveTime), 'h:mm a');

                          return (
                            <div
                              key={session.sessionId}
                              className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden"
                            >
                              {/* Session Bundle Header */}
                              <div
                                onClick={() => toggleSessionExpanded(session.sessionId)}
                                className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-stone-50 transition-colors select-none"
                              >
                                <div className="flex items-start sm:items-center gap-3">
                                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                                    <Monitor className="w-4 h-4" />
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-xs font-bold text-stone-900">
                                        {session.sessionId}
                                      </span>
                                      {session.isActive ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                          Active Session
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600">
                                          Completed ({session.durationMinutes}m duration)
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-xs text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-stone-400" />
                                        <span>{sessionStartStr} – {sessionEndStr}</span>
                                      </span>
                                      <span>·</span>
                                      <span>{session.totalEvents} actions performed</span>
                                      {session.errorEvents > 0 && (
                                        <span className="text-rose-600 font-semibold">({session.errorEvents} errors)</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Network & Device Badges */}
                                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    {/* IP & Location */}
                                    {(session.location || session.ip) && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 text-[11px] font-medium text-stone-700">
                                        <span>{session.location?.flag || '🌐'}</span>
                                        <span>{session.location?.city || session.location?.country || session.ip}</span>
                                      </span>
                                    )}

                                    {/* Device */}
                                    {session.device && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 text-[11px] font-medium text-stone-700">
                                        {renderDeviceIcon(session.device.type)}
                                        <span>{session.device.os} · {session.device.browser}</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="min-h-[36px] min-w-[36px] flex items-center justify-center text-stone-400">
                                    {isSessionExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-stone-600" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-stone-600" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Timeline inside this Session */}
                              {isSessionExpanded && (
                                <div className="border-t border-stone-100 bg-stone-50/40 p-4 space-y-3">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-xs font-bold text-stone-600">
                                      Session Operations Timeline ({session.events.length})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleFilterBySession(session.sessionId)}
                                      className="text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>View this session in Intune Table</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Step-by-step audit activity timeline */}
                                  <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                                    {session.events.map((event, eIndex) => {
                                      const isError = event.status === 'Failed' || event.type === 'error';
                                      const timeStr = format(new Date(event.timestamp), 'h:mm:ss a');

                                      return (
                                        <div
                                          key={event.id || eIndex}
                                          onClick={() => setSelectedLog(event)}
                                          className="relative group cursor-pointer"
                                        >
                                          {/* Dot indicator */}
                                          <div
                                            className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${
                                              isError ? 'bg-rose-500' : 'bg-emerald-500'
                                            }`}
                                          />

                                          <div className="bg-white p-3 rounded-xl border border-stone-200 hover:border-stone-400 transition-colors shadow-2xs">
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                              <div className="flex items-center gap-2">
                                                <span className="font-bold text-xs text-stone-900">
                                                  {event.activity || event.message}
                                                </span>
                                                {renderStatusBadge(event.status, event.type)}
                                              </div>
                                              <span className="text-[11px] font-mono text-stone-400">{timeStr}</span>
                                            </div>

                                            <div className="text-xs text-stone-500 mt-1">
                                              {event.message}
                                            </div>

                                            {event.target && (
                                              <div className="mt-1.5 inline-block text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded font-medium">
                                                Target: {event.target}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MICROSOFT INTUNE DETAILS BLADE / DRAWER ================= */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedLog(null)}
          />

          {/* Blade Panel (Slide over on desktop, full sheet on mobile) */}
          <div className="relative w-full sm:w-[540px] md:w-[620px] bg-white h-full shadow-2xl z-10 flex flex-col border-l border-stone-200 overflow-hidden animate-in slide-in-from-right duration-200">
            
            {/* Blade Header */}
            <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Audit Log Blade
                  </span>
                  {renderStatusBadge(selectedLog.status, selectedLog.type)}
                  {renderCategoryBadge(selectedLog.category)}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-stone-900 mt-1 leading-snug">
                  {selectedLog.activity || selectedLog.message}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="min-h-[44px] min-w-[44px] p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition flex items-center justify-center cursor-pointer"
                title="Close Blade"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Blade Navigation Tabs (Intune Style) */}
            <div className="border-b border-stone-200 bg-white px-4 sm:px-5 flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setBladeTab('summary')}
                className={`min-h-[44px] px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  bladeTab === 'summary'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Summary
              </button>

              <button
                type="button"
                onClick={() => setBladeTab('actor')}
                className={`min-h-[44px] px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  bladeTab === 'actor'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Initiated By & Network
              </button>

              <button
                type="button"
                onClick={() => setBladeTab('target')}
                className={`min-h-[44px] px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  bladeTab === 'target'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Target(s)
              </button>

              <button
                type="button"
                onClick={() => setBladeTab('diff')}
                className={`min-h-[44px] px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  bladeTab === 'diff'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Modified Properties
              </button>

              <button
                type="button"
                onClick={() => setBladeTab('payload')}
                className={`min-h-[44px] px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  bladeTab === 'payload'
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                JSON Payload
              </button>
            </div>

            {/* Blade Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              
              {/* TAB 1: SUMMARY */}
              {bladeTab === 'summary' && (
                <div className="space-y-4">
                  <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 space-y-3">
                    <div>
                      <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                        Activity Display Name
                      </div>
                      <div className="text-sm font-semibold text-stone-900 mt-0.5">
                        {selectedLog.activity || selectedLog.message}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200/70">
                      <div>
                        <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                          Date and Time (Local)
                        </div>
                        <div className="text-xs font-medium text-stone-800 mt-0.5">
                          {format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                          UTC ISO Timestamp
                        </div>
                        <div className="text-xs font-mono text-stone-600 mt-0.5 break-all">
                          {new Date(selectedLog.timestamp).toISOString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200/70">
                      <div>
                        <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                          Category
                        </div>
                        <div className="mt-1">{renderCategoryBadge(selectedLog.category)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                          Result
                        </div>
                        <div className="mt-1">{renderStatusBadge(selectedLog.status, selectedLog.type)}</div>
                      </div>
                    </div>

                    {selectedLog.sessionId && (
                      <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                            Correlation / Session ID
                          </div>
                          <div className="text-xs font-mono text-stone-800 mt-0.5">
                            {selectedLog.sessionId}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyText('sid', selectedLog.sessionId || '')}
                          className="px-2 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 text-[11px] font-bold rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'sid' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'sid' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Primary Narrative Message */}
                  <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-1">
                    <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      Audit Log Message
                    </div>
                    <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                      {selectedLog.message}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: INITIATED BY & NETWORK */}
              {bladeTab === 'actor' && (
                <div className="space-y-4">
                  {/* Actor Details Card */}
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-stone-700" />
                      <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                        Initiated By (User Identity)
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Display Name</div>
                        <div className="text-xs font-semibold text-stone-900 mt-0.5">
                          {selectedLog.userName || 'System Automated Process'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">User Principal Name (Email)</div>
                        <div className="text-xs font-mono text-stone-800 mt-0.5 break-all">
                          {selectedLog.userEmail || 'system@travelmalawi.internal'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Role Assignment</div>
                        <div className="mt-1">{renderRoleBadge(selectedLog.userRole)}</div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">User ID (UID)</div>
                        <div className="text-xs font-mono text-stone-600 mt-0.5 break-all">
                          {selectedLog.userId || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Network & IP Geolocation Card */}
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-stone-700" />
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Client IP & Geolocation Telemetry
                        </h4>
                      </div>

                      {selectedLog.ip && (
                        <button
                          type="button"
                          onClick={() => handleCopyText('ip', selectedLog.ip || '')}
                          className="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'ip' ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                          <span>{copiedKey === 'ip' ? 'Copied' : 'Copy IP'}</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Client IP Address</div>
                        <div className="text-xs font-mono font-bold text-stone-900 mt-0.5">
                          {selectedLog.ip || selectedLog.location?.ip || '127.0.0.1 (Local)'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Location & Flag</div>
                        <div className="text-xs font-semibold text-stone-900 mt-0.5 flex items-center gap-1.5">
                          <span>{selectedLog.location?.flag || '🇲🇼'}</span>
                          <span>
                            {[selectedLog.location?.city, selectedLog.location?.country].filter(Boolean).join(', ') || 'Malawi'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Timezone</div>
                        <div className="text-xs text-stone-800 mt-0.5">
                          {selectedLog.location?.timezone || selectedLog.device?.timezone || 'Africa/Blantyre'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Network ISP / ASN</div>
                        <div className="text-xs text-stone-600 mt-0.5">
                          {selectedLog.location?.org || 'Malawi Gateway Network'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Device & Client Fingerprint Card */}
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-stone-700" />
                      <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                        Client Device & Environment
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Device Form Factor</div>
                        <div className="text-xs font-semibold text-stone-900 mt-0.5 flex items-center gap-1.5">
                          {renderDeviceIcon(selectedLog.device?.type)}
                          <span>{selectedLog.device?.type || 'Desktop'}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Operating System</div>
                        <div className="text-xs font-medium text-stone-900 mt-0.5">
                          {selectedLog.device?.os || 'Standard OS'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Web Browser</div>
                        <div className="text-xs font-medium text-stone-900 mt-0.5">
                          {selectedLog.device?.browser || 'Chrome / Safari'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Display Resolution</div>
                        <div className="text-xs font-mono text-stone-700 mt-0.5">
                          {selectedLog.device?.screen || 'Responsive Canvas'}
                        </div>
                      </div>
                    </div>

                    {selectedLog.userAgent && (
                      <div className="pt-2 border-t border-stone-200">
                        <div className="text-[10px] font-bold text-stone-400 uppercase">User-Agent Header</div>
                        <div className="text-[11px] font-mono text-stone-600 break-all mt-0.5">
                          {selectedLog.userAgent}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: TARGET(S) */}
              {bladeTab === 'target' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
                    <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      Affected Resource Target
                    </div>
                    <div className="text-base font-bold text-stone-900">
                      {selectedLog.target || 'Platform Core'}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Target Resource Type</div>
                        <div className="text-xs font-semibold text-stone-800 mt-0.5">
                          {selectedLog.targetType || 'System Resource'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-stone-500 font-bold">Target Identifier</div>
                        <div className="text-xs font-mono text-stone-700 mt-0.5 break-all">
                          {selectedLog.details?.hotelId ||
                            selectedLog.details?.bookingId ||
                            selectedLog.details?.reference ||
                            selectedLog.details?.targetUserId ||
                            'platform_internal'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Target details breakdown */}
                  {selectedLog.details && (
                    <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-2">
                      <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                        Contextual Target Attributes
                      </div>
                      <div className="space-y-1.5 text-xs text-stone-700">
                        {Object.entries(selectedLog.details).map(([key, val]) => {
                          if (typeof val === 'object') return null;
                          return (
                            <div key={key} className="flex items-center justify-between py-1 border-b border-stone-100">
                              <span className="font-mono text-stone-500">{key}:</span>
                              <span className="font-semibold text-stone-900">{String(val)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MODIFIED PROPERTIES (INTUNE DIFF BLADE) */}
              {bladeTab === 'diff' && (
                <div className="space-y-4">
                  <div className="text-xs text-stone-600">
                    Audit comparison of modified properties and state transitions recorded for this action.
                  </div>

                  {selectedLog.details ? (
                    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="px-3.5 py-2.5">Property Name</th>
                            <th className="px-3.5 py-2.5">Old Value</th>
                            <th className="px-3.5 py-2.5">New Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 font-mono">
                          {/* Status diff if available */}
                          {selectedLog.details.previousStatus && selectedLog.details.newStatus && (
                            <tr>
                              <td className="px-3.5 py-2 text-stone-800 font-semibold font-sans">status</td>
                              <td className="px-3.5 py-2 text-stone-500">{String(selectedLog.details.previousStatus)}</td>
                              <td className="px-3.5 py-2 text-emerald-600 font-bold">{String(selectedLog.details.newStatus)}</td>
                            </tr>
                          )}

                          {/* Roles diff */}
                          {selectedLog.details.roles && (
                            <tr>
                              <td className="px-3.5 py-2 text-stone-800 font-semibold font-sans">roles</td>
                              <td className="px-3.5 py-2 text-stone-400 italic font-sans">[inherited]</td>
                              <td className="px-3.5 py-2 text-indigo-600 font-bold">
                                {Array.isArray(selectedLog.details.roles)
                                  ? selectedLog.details.roles.join(', ')
                                  : String(selectedLog.details.roles)}
                              </td>
                            </tr>
                          )}

                          {/* Featured diff */}
                          {typeof selectedLog.details.featured === 'boolean' && (
                            <tr>
                              <td className="px-3.5 py-2 text-stone-800 font-semibold font-sans">featured</td>
                              <td className="px-3.5 py-2 text-stone-500">{String(!selectedLog.details.featured)}</td>
                              <td className="px-3.5 py-2 text-amber-700 font-bold">{String(selectedLog.details.featured)}</td>
                            </tr>
                          )}

                          {/* Fallback to dump all primitive keys in details */}
                          {Object.entries(selectedLog.details).map(([k, v]) => {
                            if (['previousStatus', 'newStatus', 'roles', 'featured', 'ip', 'sessionId'].includes(k)) return null;
                            return (
                              <tr key={k}>
                                <td className="px-3.5 py-2 text-stone-700 font-sans">{k}</td>
                                <td className="px-3.5 py-2 text-stone-400 italic font-sans">--</td>
                                <td className="px-3.5 py-2 text-stone-900 font-medium">
                                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-stone-50 rounded-xl border border-stone-200 text-stone-500 text-xs">
                      No property mutations recorded for this event.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: JSON PAYLOAD */}
              {bladeTab === 'payload' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                      Complete Document Payload
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('json', JSON.stringify(selectedLog, null, 2))}
                      className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-100 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedKey === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'json' ? 'Copied JSON' : 'Copy JSON'}</span>
                    </button>
                  </div>

                  <pre className="p-4 bg-stone-900 text-amber-200/90 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed max-h-[480px]">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Blade Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteLog(selectedLog.id)}
                className="min-h-[44px] px-3.5 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer border border-rose-200/80"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Log Entry</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="min-h-[44px] px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
