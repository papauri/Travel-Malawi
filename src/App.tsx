import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation, useNavigationType, Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthDialogProvider, useAuthDialog } from './contexts/AuthDialogContext';
import { isAdmin, isMarketing, isHotelManager } from './lib/roles';
import { ChatModalProvider } from './contexts/ChatModalContext';
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext';
import { CompareProvider } from './contexts/CompareContext';
import { WishlistProvider } from './contexts/WishlistContext';
import Breadcrumbs, { BreadcrumbProvider } from './components/Breadcrumbs';
import Navbar from './components/Navbar';
import ShadowBanner from './components/ShadowBanner';
import MobileNav from './components/MobileNav';
import Footer from './components/Footer';
import Home from './pages/Home';
import SavedProperties from './pages/SavedProperties';
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const ManageHotel = lazy(() => import('./pages/ManageHotel'));
const ListProperty = lazy(() => import('./pages/ListProperty'));
const HotelDetails = lazy(() => import('./pages/HotelDetails'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Refunds = lazy(() => import('./pages/Refunds'));
const HostStarterPack = lazy(() => import('./pages/HostStarterPack'));
const MarketingDeck = lazy(() => import('./pages/MarketingDeck'));
const OperationsStarterPack = lazy(() => import('./pages/OperationsStarterPack'));
const PropertyListingGuide = lazy(() => import('./pages/PropertyListingGuide'));
const PlatformGuideUat = lazy(() => import('./pages/PlatformGuideUat'));
const ConceptValidationSurvey = lazy(() => import('./pages/ConceptValidationSurvey'));
const StayOwnerLeaflet = lazy(() => import('./pages/StayOwnerLeaflet'));
const HowHostingWorks = lazy(() => import('./pages/HowHostingWorks'));
import GlobalNotificationManager from './components/GlobalNotificationManager';
import PageLoader from './components/PageLoader';
import OfflineIndicator from './components/OfflineIndicator';
import SEOHead from './components/SEOHead';
import CompareWidget from './components/CompareWidget';
import OperationsCopilot from './components/OperationsCopilot';
import AccessRequestModal from './components/AccessRequestModal';
import { useTrafficMonitor } from './lib/trafficMonitor';
import { Toaster } from 'react-hot-toast';
import Lenis from 'lenis';

// Without this, an unmatched URL rendered an empty page with no way back.
function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <SEOHead title="Page not found" description="The page you are looking for does not exist or has been moved." noindex />
      <p className="text-xs font-bold tracking-[0.2em] text-stone-400 uppercase mb-4">Error 404</p>
      <h1 className="text-4xl md:text-5xl font-serif text-stone-900 mb-4 tracking-tight">Page not found</h1>
      <p className="text-stone-500 text-lg max-w-md mb-8">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition">
        Back to home
      </Link>
    </div>
  );
}

// The docs behind these pages are served by audience (see server/docUtils.ts), so a page
// the visitor may not read would only show an empty shell. Show a notice instead.
function RestrictedRoute({ audience, children }: { audience: 'staff' | 'host'; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { openAuth } = useAuthDialog();
  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" role="status" aria-label="Checking access" /></div>;
  }
  const staff = isAdmin(user) || isMarketing(user);
  if (user && (staff || (audience === 'host' && isHotelManager(user)))) return <>{children}</>;
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <SEOHead title="Restricted page" description="This page is only available to signed-in members of the Travel Malawi team or hosts." noindex />
      <p className="text-xs font-bold tracking-[0.2em] text-stone-400 uppercase mb-4">Restricted</p>
      <h1 className="text-3xl md:text-4xl font-serif text-stone-900 mb-4 tracking-tight">
        {user ? 'This page is not available to your account' : 'Sign in to view this page'}
      </h1>
      <p className="text-stone-500 text-lg max-w-md mb-8">
        {audience === 'host'
          ? 'This guide is for property owners listing on Travel Malawi.'
          : 'This page is for the Travel Malawi team.'}
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        {!user && (
          <button
            onClick={() => openAuth('signin')}
            className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition cursor-pointer"
          >
            Sign in
          </button>
        )}
        <Link to="/" className="bg-stone-100 text-stone-700 px-8 py-3 rounded-full font-medium hover:bg-stone-200 transition">
          Back to home
        </Link>
      </div>
    </div>
  );
}

function RouteErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />;
  }
  console.error("Route error:", error);

  // A deploy replaces the hashed page chunks; a tab opened before it then fails
  // to fetch the one it needs. One reload picks up the new build.
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message)) {
    try {
      if (!sessionStorage.getItem('tm_chunk_reload')) {
        sessionStorage.setItem('tm_chunk_reload', '1');
        window.location.reload();
        return null;
      }
    } catch {
      // storage unavailable: fall through to the manual reload button
    }
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h1 className="text-3xl font-serif text-stone-900 mb-3">Something went wrong</h1>
      <p className="text-stone-500 text-base max-w-md mb-6">
        An unexpected error occurred while loading this page.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => window.location.reload()}
          className="bg-stone-900 text-white px-6 py-2.5 rounded-full font-medium hover:bg-stone-800 transition cursor-pointer"
        >
          Reload Page
        </button>
        <Link
          to="/"
          className="bg-stone-100 text-stone-700 px-6 py-2.5 rounded-full font-medium hover:bg-stone-200 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { pathname, hash } = location;
  const positions = useRef(new Map<string, number>());
  const keyRef = useRef(location.key);
  keyRef.current = location.key;

  // Remember where each history entry was scrolled to, so Back lands on the
  // card the visitor left instead of the top of the page.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const onScroll = () => positions.current.set(keyRef.current, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (hash) {
      const timer = setTimeout(() => {
        const id = decodeURIComponent(hash.replace("#", ""));
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }

    const saved = navigationType === 'POP' ? positions.current.get(location.key) : undefined;
    if (!saved) {
      window.scrollTo(0, 0);
      return;
    }
    // The page may still be filling in; keep trying until it is tall enough.
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const tallEnough = document.documentElement.scrollHeight >= saved + window.innerHeight;
      if (tallEnough || tries >= 12) {
        window.scrollTo(0, saved);
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
    // location.key and navigationType belong to the same navigation as pathname/hash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash]);
  return null;
}

function RootContent({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  useTrafficMonitor();
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      <ShadowBanner />
      <Navbar />
      <Breadcrumbs />
      <Toaster 
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1c1917',
            color: '#fff',
            borderRadius: '16px',
            padding: '16px 24px',
          }
        }} 
      />
      <GlobalNotificationManager />
      <AccessRequestModal />
      <CompareWidget />
      {/* Strictly scoped to current authenticated session - unmounted and completely destroyed on logout or user switch */}
      {user && <OperationsCopilot key={`operations-copilot-${user.uid}`} />}
      <PageLoader />
      <OfflineIndicator />
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" role="status" aria-label="Loading page" /></div>}>
          {children || <Outlet />}
        </Suspense>
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}

function RootLayout({ children }: { children?: React.ReactNode }) {
  return (
      <AuthDialogProvider>
        <ChatModalProvider>
          <UnreadMessagesProvider>
          <CompareProvider>
            <WishlistProvider>
            <BreadcrumbProvider>
              <ScrollToTop />
              <RootContent>{children}</RootContent>
            </BreadcrumbProvider>
            </WishlistProvider>
          </CompareProvider>
          </UnreadMessagesProvider>
        </ChatModalProvider>
      </AuthDialogProvider>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: (
      <RootLayout>
        <RouteErrorBoundary />
      </RootLayout>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "hotel/:id", element: <HotelDetails /> },
      { path: "list-your-property", element: <ListProperty /> },
      { path: "list-property", element: <ListProperty /> },
      { path: "dashboard", element: <ManagerDashboard /> },
      { path: "dashboard/hotel/:id", element: <ManageHotel /> },
      { path: "manage/:id", element: <ManageHotel /> },
      { path: "my-bookings", element: <MyBookings /> },
      { path: "bookings", element: <MyBookings /> },
      { path: "mybookings", element: <MyBookings /> },
      { path: "my-booking", element: <MyBookings /> },
      { path: "booking", element: <MyBookings /> },
      { path: "trips", element: <MyBookings /> },
      { path: "my-trips", element: <MyBookings /> },
      { path: "saved", element: <SavedProperties /> },
      { path: "profile", element: <Profile /> },
      { path: "admin", element: <AdminDashboard /> },
      { path: "terms", element: <Terms /> },
      { path: "privacy", element: <Privacy /> },
      { path: "refunds", element: <Refunds /> },
      { path: "host-guide", element: <HostStarterPack /> },
      { path: "starter-pack", element: <HostStarterPack /> },
      { path: "host-starter-pack", element: <HostStarterPack /> },
      { path: "marketing", element: <RestrictedRoute audience="staff"><MarketingDeck /></RestrictedRoute> },
      { path: "marketing-deck", element: <RestrictedRoute audience="staff"><MarketingDeck /></RestrictedRoute> },
      { path: "operations-guide", element: <RestrictedRoute audience="staff"><OperationsStarterPack /></RestrictedRoute> },
      { path: "listing-guide", element: <RestrictedRoute audience="host"><PropertyListingGuide /></RestrictedRoute> },
      { path: "uat", element: <RestrictedRoute audience="staff"><PlatformGuideUat /></RestrictedRoute> },
      { path: "uat-guide", element: <RestrictedRoute audience="staff"><PlatformGuideUat /></RestrictedRoute> },
      { path: "platform-guide", element: <RestrictedRoute audience="staff"><PlatformGuideUat /></RestrictedRoute> },
      { path: "uat-manual", element: <RestrictedRoute audience="staff"><PlatformGuideUat /></RestrictedRoute> },
      { path: "concept-validation", element: <ConceptValidationSurvey /> },
      { path: "concept-survey", element: <ConceptValidationSurvey /> },
      { path: "survey", element: <ConceptValidationSurvey /> },
      { path: "stay-owner-leaflet", element: <StayOwnerLeaflet /> },
      { path: "leaflet", element: <StayOwnerLeaflet /> },
      { path: "host-leaflet", element: <StayOwnerLeaflet /> },
      { path: "how-it-works", element: <HowHostingWorks /> },
      { path: "hosting", element: <HowHostingWorks /> },
      { path: "how-hosting-works", element: <HowHostingWorks /> },
      { path: "admin/hotel/:id", element: <ManageHotel /> },
      { path: "*", element: <NotFound /> }
    ]
  }
]);

export default function App() {
  useEffect(() => {
    // Preserve native hardware-accelerated momentum scrolling on touch devices
    const isTouchDevice =
      typeof window !== 'undefined' &&
      (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia('(pointer: coarse)').matches);

    if (isTouchDevice) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth ease-out
      touchMultiplier: 0,
      syncTouch: false,
    });

    (window as any).__lenis = lenis;

    let animationFrameId: number;
    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      (window as any).__lenis = null;
      lenis.destroy();
    };
  }, []);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
