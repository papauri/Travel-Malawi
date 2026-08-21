/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ManagerDashboard from './pages/ManagerDashboard';
import ManageHotel from './pages/ManageHotel';
import HotelDetails from './pages/HotelDetails';
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/AdminDashboard';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
          <Navbar />
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
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/hotel/:id" element={<HotelDetails />} />
              <Route path="/dashboard" element={<ManagerDashboard />} />
              <Route path="/dashboard/hotel/:id" element={<ManageHotel />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
