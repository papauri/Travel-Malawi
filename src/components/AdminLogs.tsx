import React, { useEffect, useState } from 'react';
import { SystemLog, subscribeToSystemLogs, deleteSystemLog, clearAllSystemLogs } from '../lib/logger';
import { Activity, AlertCircle, Info, ShieldCheck, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSystemLogs((data) => {
      setLogs(data);
      setLoading(false);
    }, 200);

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    try {
      await deleteSystemLog(id);
      toast.success('Log deleted');
    } catch (err) {
      toast.error('Failed to delete log');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all system logs? This action cannot be undone.')) return;
    
    setClearing(true);
    try {
      await clearAllSystemLogs();
      toast.success('All logs cleared successfully');
    } catch (err) {
      toast.error('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

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
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-stone-100 rounded-lg text-stone-900">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">System Logs</h3>
              <p className="text-xs text-stone-500">Review recent actions and system health events</p>
            </div>
          </div>
          {logs.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 text-xs font-bold uppercase tracking-wider rounded-xl transition disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          )}
        </div>

        {/* Content */}
        {logs.length === 0 ? (
          <div className="text-center py-12 bg-stone-50">
            <ShieldCheck className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <h4 className="font-bold text-stone-900 text-sm">No Logs Available</h4>
            <p className="text-xs text-stone-500 mt-1">System events will appear here in real-time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold w-12 text-center">Type</th>
                  <th className="px-4 py-3 font-semibold">Message & Details</th>
                  <th className="px-4 py-3 font-semibold w-40">User</th>
                  <th className="px-4 py-3 font-semibold w-40 text-right">Timestamp</th>
                  <th className="px-4 py-3 font-semibold w-16 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-stone-50/80 transition-colors group">
                    <td className="px-4 py-3 align-top text-center">
                      <div className="mt-0.5 inline-flex justify-center">
                        {log.type === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        ) : log.type === 'action' ? (
                          <Activity className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top min-w-0">
                      <p className="font-semibold text-stone-900">{log.message}</p>
                      {log.details && (
                        <div className="mt-1.5">
                          <details className="group/details">
                            <summary className="text-[10px] font-bold text-stone-400 hover:text-stone-600 cursor-pointer list-none flex items-center gap-1 transition">
                              <span className="group-open/details:hidden">▶</span>
                              <span className="hidden group-open/details:inline">▼</span>
                              Raw Details
                            </summary>
                            <pre className="mt-2 p-2 bg-stone-900 text-stone-300 rounded-lg text-[10px] overflow-x-auto font-mono whitespace-pre-wrap break-all shadow-inner">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-stone-600">
                      {log.userName ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-stone-800">{log.userName}</span>
                          {log.userEmail && <span className="text-[10px] text-stone-400">{log.userEmail}</span>}
                        </div>
                      ) : (
                        <span className="text-stone-400 italic">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right whitespace-nowrap text-stone-500">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
