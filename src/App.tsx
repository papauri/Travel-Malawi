import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, useLocation, Link, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthDialogProvider } from './contexts/AuthDialogContext';
import { ChatModalProvider } from './contexts/ChatModalContext';
import { CompareProvider } from './contexts/CompareContext';
import Breadcrumbs, { BreadcrumbProvider } from './components/Breadcrumbs';
import Navbar from './components/Navbar';
import MobileNav from './components/MobileNav';
import Footer from './components/Footer';
import Home from './pages/Home';
import ManagerDashboard from './pages/ManagerDashboard';
import ManageHotel from './pages/ManageHotel';
import ListProperty from './pages/ListProperty';
import HotelDetails from './pages/HotelDetails';
import MyBookings from './pages/MyBookings';
import SavedProperties from './pages/SavedProperties';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Refunds from './pages/Refunds';
import HostStarterPack from './pages/HostStarterPack';
import MarketingDeck from './pages/MarketingDeck';
import GlobalNotificationManager from './components/GlobalNotificationManager';
import PageLoader from './components/PageLoader';
import CompareWidget from './components/CompareWidget';
import OperationsCopilot from './components/OperationsCopilot';
import AccessRequestModal from './components/AccessRequestModal';
import { Toaster } from 'react-hot-toast';
import Lenis from 'lenis';

// Without this, an unmatched URL rendered an empty page with no way back.
function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
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

function RouteErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />;
  }
  console.error("Route error:", error);
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
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const id = hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

function RootContent({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
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
      <main className="flex-1">
        {children || <Outlet />}
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
          <CompareProvider>
            <BreadcrumbProvider>
              <ScrollToTop />
              <RootContent>{children}</RootContent>
            </BreadcrumbProvider>
          </CompareProvider>
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
      { path: "dashboard", element: <ManagerDashboard /> },
      { path: "dashboard/hotel/:id", element: <ManageHotel /> },
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
      { path: "marketing", element: <MarketingDeck /> },
      { path: "marketing-deck", element: <MarketingDeck /> },
      { path: "operations-guide", element: <MarketingDeck /> },
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
