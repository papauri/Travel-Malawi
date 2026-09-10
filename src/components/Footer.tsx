import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Palmtree, Map, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { openAccessPermissionsModal } from './AccessRequestModal';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin, isMarketing, isHotelManager } from '../lib/roles';
import { readStoredCurrency, storeCurrency, onCurrencyChange } from '../lib/currency';
import { CurrencyCode } from '../types';

export default function Footer() {
  const { settings } = useSystemSettings();
  const { user } = useAuth();
  const [currency, setCurrency] = useState<CurrencyCode>(readStoredCurrency);

  useEffect(() => {
    return onCurrencyChange(setCurrency);
  }, []);

  
  const showMarketingPlaybook = user && (isAdmin(user) || isMarketing(user));
  const showHostStarterPack = user && isHotelManager(user);

  return (
    <footer className="bg-stone-900 text-stone-300 pt-16 pb-28 md:py-16 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="space-y-6">
          <Link to="/" className="flex items-center gap-2 text-white">
            <Palmtree className="h-8 w-8 text-white" />
            <span className="text-2xl font-serif font-bold tracking-tight">Travel Malawi</span>
          </Link>
          <p className="text-stone-400 text-sm leading-relaxed">
            Discover the warm heart of Africa. Explore independent lodges, B&Bs, cottages, guest houses, and safari camps across Malawi for your perfect getaway.
          </p>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-lg mb-6">Explore</h4>
          <ul className="space-y-4 text-sm">
            <li><Link to="/?category=Lakefront" className="hover:text-white transition">Lake Malawi</Link></li>
            <li><Link to="/?category=Safari Lodge" className="hover:text-white transition">Safari &amp; Wildlife</Link></li>
            <li><Link to="/?category=Boutique Hotel" className="hover:text-white transition">Romantic Escapes</Link></li>
            <li><Link to="/?category=Eco Camp" className="hover:text-white transition">Family Adventures</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-lg mb-6">For Property Owners</h4>
          <ul className="space-y-4 text-sm">
            {showHostStarterPack && (
              <li>
                <Link to="/host-guide" className="hover:text-white transition flex items-center gap-1.5">
                  <span>Host Starter Pack</span>
                  <span className="bg-stone-800 text-stone-300 border border-stone-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full">Host Only</span>
                </Link>
              </li>
            )}
            <li><Link to="/list-your-property" className="hover:text-white transition">List Your Property</Link></li>
            <li><Link to="/dashboard" className="hover:text-white transition">Host Dashboard</Link></li>
            {showMarketingPlaybook && (
              <>
                <li><Link to="/marketing" className="text-stone-400 hover:text-white transition text-xs">Marketing Playbook</Link></li>
                <li>
                  <Link to="/uat" className="text-emerald-400 hover:text-emerald-300 transition text-xs flex items-center gap-1.5">
                    <span>UAT &amp; Platform Guide</span>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">QA</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-lg mb-6">Contact</h4>
          <ul className="space-y-4 text-sm">
            {settings.contactEmail && (
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-stone-500" />
                <span>{settings.contactEmail}</span>
              </li>
            )}
            {settings.contactPhone && (
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-stone-500" />
                <span>{settings.contactPhone}</span>
              </li>
            )}
            <li className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-stone-500" />
              <span>Lilongwe, Malawi</span>
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-lg mb-6">Follow Us</h4>
          <div className="flex items-center gap-4">
            <a href="#" className="bg-stone-800 p-3 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="#" className="bg-stone-800 p-3 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" className="bg-stone-800 p-3 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Twitter className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-16 pt-8 border-t border-stone-800 text-sm flex flex-col md:flex-row justify-between items-center text-stone-500 gap-6 md:gap-0">
        <p>&copy; {new Date().getFullYear()} Travel Malawi. All rights reserved.</p>
        <div className="flex flex-wrap justify-center items-center gap-6">
          <div className="flex items-center bg-stone-800 p-0.5 rounded-full border border-stone-700 text-xs font-bold mr-2">
            <button
              type="button"
              onClick={() => { setCurrency('MWK'); storeCurrency('MWK'); }}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                currency === 'MWK'
                  ? 'bg-stone-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Malawi Kwacha"
            >
              MWK
            </button>
            <button
              type="button"
              onClick={() => { setCurrency('USD'); storeCurrency('USD'); }}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                currency === 'USD'
                  ? 'bg-stone-600 text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="US Dollar"
            >
              USD
            </button>
          </div>
          <button
            type="button"
            onClick={() => openAccessPermissionsModal('permissions')}
            className="hover:text-white transition cursor-pointer text-left"
          >
            Device Permissions
          </button>
          <Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white transition">Terms of Service</Link>
          <Link to="/refunds" className="hover:text-white transition">Refunds</Link>
        </div>
      </div>
    </footer>
  );
}
