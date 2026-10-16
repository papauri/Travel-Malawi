import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, LogOut, ShieldAlert, ArrowRight } from 'lucide-react';

export default function ShadowBanner() {
  const { isShadowing, shadowedUser, actualUser, exitShadowMode } = useAuth();

  if (!isShadowing || !shadowedUser) return null;

  const targetName = shadowedUser.displayName || shadowedUser.email || 'Property Manager';

  return (
    <aside 
      aria-label="Active shadow mode notice" 
      className="sticky top-0 z-[110] bg-stone-950 text-stone-100 border-b-2 border-amber-500 shadow-md px-3 sm:px-6 py-2 transition-all"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Shadow Mode Active
              </span>
              <span className="text-[10px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full border border-stone-700">
                Manager Perspective
              </span>
            </div>
            <p className="text-xs text-stone-300 truncate">
              Viewing as <strong className="text-white">{targetName}</strong>
              {shadowedUser.email && <span className="text-stone-400 font-mono text-[11px] ml-1">({shadowedUser.email})</span>}
              {actualUser?.email && (
                <span className="hidden md:inline text-stone-400 ml-2">
                  · Shadowed by {actualUser.email}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exitShadowMode()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Restore your administrator session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Shadow Mode</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
