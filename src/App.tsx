import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AuthDialogProvider } from './contexts/AuthDialogContext';
import { ChatModalProvider } from './contexts/ChatModalContext';
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
import GlobalNotificationManager from './components/GlobalNotificationManager';
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

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

    let animationFrameId: number;
    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AuthDialogProvider>
          <ChatModalProvider>
            <BreadcrumbProvider>
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
              <main className="flex-1 pb-16 md:pb-0">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/hotel/:id" element={<HotelDetails />} />
                  <Route path="/list-your-property" element={<ListProperty />} />
                  <Route path="/dashboard" element={<ManagerDashboard />} />
                  <Route path="/dashboard/hotel/:id" element={<ManageHotel />} />
                  <Route path="/my-bookings" element={<MyBookings />} />
                  <Route path="/saved" element={<SavedProperties />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/hotel/:id" element={<ManageHotel />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
              <MobileNav />
            </div>
            </BreadcrumbProvider>
          </ChatModalProvider>
        </AuthDialogProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
