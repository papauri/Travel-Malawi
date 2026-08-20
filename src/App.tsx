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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/hotel/:id" element={<HotelDetails />} />
              <Route path="/dashboard" element={<ManagerDashboard />} />
              <Route path="/dashboard/hotel/:id" element={<ManageHotel />} />
              <Route path="/my-bookings" element={<MyBookings />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
