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
    <footer className="bg-stone-900 text-stone-300 pt-10 sm:pt-14 pb-28 sm:pb-24 md:py-16 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-5 sm:gap-x-8 gap-y-7 sm:gap-y-8 lg:gap-10">
        <div className="col-span-2 md:col-span-4 lg:col-span-1 space-y-3 sm:space-y-4">
          <Link to="/" className="flex items-center gap-2 text-white">
            <Palmtree className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-400" />
            <span className="text-lg sm:text-xl font-serif font-bold tracking-tight">Travel Malawi</span>
          </Link>
          <p className="text-stone-400 text-xs sm:text-sm leading-relaxed max-w-sm lg:max-w-none">
            Discover the warm heart of Africa. Explore independent hotels, resorts, lodges, B&amp;Bs, cottages, guest houses, and safari camps across Malawi for your perfect getaway.
          </p>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-sm sm:text-base mb-2.5 sm:mb-4">Explore</h4>
          <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
            <li><Link to="/?category=Lakefront" className="hover:text-white transition inline-block py-0.5">Lake Malawi</Link></li>
            <li><Link to="/?category=Safari Lodge" className="hover:text-white transition inline-block py-0.5">Safari &amp; Wildlife</Link></li>
            <li><Link to="/?category=Boutique Hotel" className="hover:text-white transition inline-block py-0.5">Romantic Escapes</Link></li>
            <li><Link to="/?category=Eco Camp" className="hover:text-white transition inline-block py-0.5">Family Adventures</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-sm sm:text-base mb-2.5 sm:mb-4">For Property Owners</h4>
          <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
            {showHostStarterPack && (
              <li>
                <Link to="/host-guide" className="hover:text-white transition flex items-center gap-1.5 py-0.5">
                  <span>Host Starter Pack</span>
                  <span className="bg-stone-800 text-stone-300 border border-stone-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full">Host Only</span>
                </Link>
              </li>
            )}
            <li><Link to="/list-your-property" className="hover:text-white transition inline-block py-0.5">List Your Property</Link></li>
            <li><Link to="/dashboard" className="hover:text-white transition inline-block py-0.5">Host Dashboard</Link></li>
            {showMarketingPlaybook && (
              <>
                <li><Link to="/marketing" className="text-stone-400 hover:text-white transition text-xs inline-block py-0.5">Marketing Playbook</Link></li>
                <li>
                  <Link to="/uat" className="text-emerald-400 hover:text-emerald-300 transition text-xs flex items-center gap-1.5 py-0.5">
                    <span>UAT &amp; Platform Guide</span>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">QA</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-sm sm:text-base mb-2.5 sm:mb-4">Contact</h4>
          <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
            {settings.contactEmail && (
              <li className="flex items-center gap-2.5">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-stone-500 shrink-0" />
                <span className="truncate">{settings.contactEmail}</span>
              </li>
            )}
            {settings.contactPhone && (
              <li className="flex items-center gap-2.5">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-stone-500 shrink-0" />
                <span>{settings.contactPhone}</span>
              </li>
            )}
            <li className="flex items-center gap-2.5">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-stone-500 shrink-0" />
              <span>Lilongwe, Malawi</span>
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-white font-serif font-semibold text-sm sm:text-base mb-2.5 sm:mb-4">Follow Us</h4>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <a href="#" aria-label="Facebook" className="bg-stone-800 p-2 sm:p-2.5 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Instagram" className="bg-stone-800 p-2 sm:p-2.5 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Twitter" className="bg-stone-800 p-2 sm:p-2.5 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Twitter className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 sm:mt-14 pt-5 sm:pt-7 border-t border-stone-800 text-xs sm:text-sm flex flex-col md:flex-row justify-between items-center text-stone-400 gap-4 sm:gap-6 md:gap-0 text-center md:text-left">
        <p>&copy; {new Date().getFullYear()} Travel Malawi. All rights reserved.</p>
        <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-5">
          <div className="flex items-center bg-stone-800 p-0.5 rounded-full border border-stone-700 text-xs font-bold mr-1">
            <button
              type="button"
              onClick={() => { setCurrency('MWK'); storeCurrency('MWK'); }}
              className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer min-h-[30px] ${
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
              className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer min-h-[30px] ${
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
            className="hover:text-white transition cursor-pointer py-1"
          >
            Device Permissions
          </button>
          <Link to="/privacy" className="hover:text-white transition py-1">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white transition py-1">Terms of Service</Link>
          <Link to="/refunds" className="hover:text-white transition py-1">Refunds</Link>
        </div>
      </div>
    </footer>
  );
}
