import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, LogOut } from 'lucide-react';

export default function ShadowBanner() {
  const { isShadowing, shadowedUser, actualUser, exitShadowMode } = useAuth();

  if (!isShadowing || !shadowedUser) return null;

  const targetName = shadowedUser.displayName || shadowedUser.email || 'Property Manager';

  return (
    <aside
      aria-label="Viewing as another user"
      className="sticky top-0 z-[110] border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-900 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Eye className="h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
          <p className="min-w-0 truncate text-sm">
            You're viewing the site as <strong className="font-semibold">{targetName}</strong>
            {shadowedUser.email && shadowedUser.email !== targetName && (
              <span className="ml-1 text-amber-800/80">({shadowedUser.email})</span>
            )}
            {actualUser?.email && (
              <span className="ml-2 hidden text-amber-800/80 md:inline">· signed in as {actualUser.email}</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => exitShadowMode()}
          className="tm-btn tm-btn-secondary tm-btn-sm shrink-0"
          title="Go back to your own admin account"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to my account</span>
        </button>
      </div>
    </aside>
  );
}
