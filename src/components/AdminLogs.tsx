import React, { useEffect, useState } from 'react';
import { SystemLog, getSystemLogs } from '../lib/logger';
import { Activity, AlertCircle, Info, ShieldCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const data = await getSystemLogs(100);
      setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-stone-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-900 border-t-transparent mx-auto mb-3"></div>
        <p className="text-sm">Loading system logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-stone-100">
          <div className="p-2 bg-stone-100 rounded-lg text-stone-900">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-900">System Logs</h3>
            <p className="text-sm text-stone-500">Review recent actions and system health events</p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-10 bg-stone-50 rounded-xl border border-dashed border-stone-200">
            <ShieldCheck className="w-8 h-8 text-stone-400 mx-auto mb-3" />
            <h4 className="font-bold text-stone-900 text-sm">No Logs Available</h4>
            <p className="text-xs text-stone-500 mt-1">System events will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="flex gap-4 p-4 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-colors">
                <div className="shrink-0 mt-0.5">
                  {log.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                  ) : log.type === 'action' ? (
                    <Activity className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-stone-900 leading-snug">
                      {log.message}
                    </p>
                    <span className="shrink-0 flex items-center gap-1.5 text-xs text-stone-400 font-medium">
                      <Clock className="w-3 h-3" />
                      {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  
                  {log.userName && (
                    <p className="text-xs text-stone-500 mt-1.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-stone-200/60 rounded text-stone-700 font-medium">User: {log.userName}</span>
                      {log.userEmail && <span>({log.userEmail})</span>}
                    </p>
                  )}
                  
                  {log.details && (
                    <div className="mt-2.5">
                      <details className="group">
                        <summary className="text-[11px] font-semibold text-stone-500 cursor-pointer hover:text-stone-700 list-none flex items-center gap-1">
                          <span className="group-open:hidden">▶</span>
                          <span className="hidden group-open:inline">▼</span>
                          View Raw Details
                        </summary>
                        <pre className="mt-2 p-3 bg-stone-900 text-stone-300 rounded-lg text-[10px] overflow-x-auto font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
