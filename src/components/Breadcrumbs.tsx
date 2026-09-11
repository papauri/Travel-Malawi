/**
 * The trail under the navbar.
 *
 * There was no way back out of a page except the browser's own button and the
 * logo. On a phone that was worse than on a desktop: the navbar's links are
 * hidden below `md`, so a guest deep in a property page, or a host inside one
 * of their listings, had nothing on screen telling them where they were or how
 * to get up a level. This shows at every width for that reason — the usual
 * trick of hiding breadcrumbs on small screens removes them exactly where they
 * are most needed.
 *
 * Most of the trail comes from the route. The one thing a route cannot supply
 * is the name of the thing being looked at, so a page holding a property calls
 * `useBreadcrumbLabel(hotel.name)` and it fills the last crumb.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import MaskedPlaceName from './MaskedPlaceName';

interface Crumb {
  label: string;
  to?: string;
}

const BreadcrumbLabelContext = createContext<{
  label: string;
  setLabel: (value: string) => void;
}>({ label: '', setLabel: () => {} });

export const BreadcrumbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [label, setLabel] = useState('');
  const value = useMemo(() => ({ label, setLabel }), [label]);
  return <BreadcrumbLabelContext.Provider value={value}>{children}</BreadcrumbLabelContext.Provider>;
};

/**
 * Names the current page's final crumb — a hotel's name, usually. Pass an
 * empty string while the record is still loading and the generic label from
 * the route is used instead.
 */
export function useBreadcrumbLabel(label: string | undefined): void {
  const { setLabel } = useContext(BreadcrumbLabelContext);
  const { pathname } = useLocation();
  useEffect(() => {
    setLabel(label ?? '');
    // Clearing on the way out stops one page's name flashing under the next.
    return () => setLabel('');
  }, [label, pathname, setLabel]);
}

/** The trail for a path. Empty means there is nothing worth showing. */
function trailFor(pathname: string, label: string): Crumb[] {
  const home: Crumb = { label: 'Home', to: '/' };

  if (pathname === '/' || pathname === '') return [];

  if (pathname.startsWith('/admin/hotel/')) {
    return [home, { label: 'Admin Dashboard', to: '/admin' }, { label: label || 'Property' }];
  }
  if (pathname.startsWith('/dashboard/hotel/')) {
    return [home, { label: 'Dashboard', to: '/dashboard' }, { label: label || 'Property' }];
  }
  if (pathname === '/dashboard') return [home, { label: 'Dashboard' }];
  if (pathname.startsWith('/hotel/')) return [home, { label: label || 'Property' }];
  if (
    pathname === '/my-bookings' ||
    pathname === '/bookings' ||
    pathname === '/mybookings' ||
    pathname === '/my-booking' ||
    pathname === '/booking' ||
    pathname === '/trips' ||
    pathname === '/my-trips'
  ) {
    return [home, { label: 'My bookings' }];
  }
  if (pathname === '/profile') return [home, { label: 'Profile' }];
  if (pathname === '/saved') return [home, { label: 'Saved properties' }];
  if (pathname === '/admin') return [home, { label: 'Admin Dashboard' }];
  if (pathname === '/list-your-property') return [home, { label: 'List your property' }];
  if (pathname === '/privacy') return [home, { label: 'Privacy Policy' }];
  if (pathname === '/terms') return [home, { label: 'Terms of Service' }];
  if (pathname === '/refunds') return [home, { label: 'Refunds & Cancellations' }];
  if (pathname === '/host-guide' || pathname === '/starter-pack' || pathname === '/host-starter-pack') {
    return [home, { label: 'Host Starter Pack & Guide' }];
  }
  if (pathname === '/marketing' || pathname === '/marketing-deck') {
    return [home, { label: 'Marketing Deck' }];
  }
  if (pathname === '/operations-guide') {
    return [home, { label: 'Operations Starter Pack' }];
  }
  if (pathname === '/listing-guide') {
    return [home, { label: 'How to List Guide' }];
  }
  if (pathname === '/uat' || pathname === '/uat-guide' || pathname === '/platform-guide' || pathname === '/uat-manual') {
    return [home, { label: 'Platform Guide & UAT Manual' }];
  }

  return [home, { label: 'Not found' }];
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const { label } = useContext(BreadcrumbLabelContext);
  const crumbs = trailFor(pathname, label);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="sticky top-14 sm:top-16 md:top-16 lg:top-[72px] z-40 w-full border-b border-stone-200/70 bg-white/95 backdrop-blur-md transition-all"
    >
      {/* Scrolls sideways rather than wrapping: a long property name on a
          narrow screen must not push the page into two rows or clip the
          links above it. */}
      <ol className="mx-auto flex flex-nowrap items-center w-full max-w-7xl gap-1 sm:gap-1.5 overflow-x-auto whitespace-nowrap px-3 sm:px-4 md:px-6 lg:px-8 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              {index > 0 && <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 text-stone-300" />}
              {crumb.to && !last ? (
                <Link
                  to={crumb.to}
                  className="flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-md px-1 sm:px-1.5 py-0.5 sm:py-1 font-medium text-stone-500 transition hover:text-stone-900 hover:bg-stone-100/80 text-[11px] sm:text-xs md:text-sm whitespace-nowrap"
                >
                  {index === 0 && <Home className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />}
                  <span className="truncate max-w-[110px] sm:max-w-none whitespace-nowrap">{crumb.label}</span>
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className="max-w-[130px] min-[380px]:max-w-[180px] sm:max-w-xs md:max-w-md truncate px-1 sm:px-1.5 py-0.5 sm:py-1 font-semibold text-stone-900 text-[11px] sm:text-xs md:text-sm shrink-0 whitespace-nowrap inline-block"
                >
                  {last && (pathname.startsWith('/hotel/') || pathname.includes('/hotel/')) ? (
                    <MaskedPlaceName name={crumb.label} fallback="[Your Lodge Name]" />
                  ) : (
                    crumb.label
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
