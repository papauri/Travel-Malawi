import React from 'react';
import { Link } from 'react-router-dom';
import { Palmtree, Map, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { openAccessPermissionsModal } from './AccessRequestModal';

export default function Footer() {
  const { settings } = useSystemSettings();
  return (
    <footer className="bg-stone-900 text-stone-300 pt-16 pb-28 md:py-16 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="space-y-6">
          <Link to="/" className="flex items-center gap-2 text-white">
            <Palmtree className="h-8 w-8 text-white" />
            <span className="text-2xl font-serif font-bold tracking-tight">Travel Malawi</span>
          </Link>
          <p className="text-stone-400 text-sm leading-relaxed">
            Discover the warm heart of Africa. We curate the finest luxury lodges, boutique hotels, and wilderness camps across Malawi for your perfect getaway.
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
          <h4 className="text-white font-serif font-semibold text-lg mb-6">For Lodge Owners</h4>
          <ul className="space-y-4 text-sm">
            <li>
              <Link to="/host-guide" className="text-emerald-400 hover:text-emerald-300 transition font-medium flex items-center gap-1.5">
                <span>Host Starter Pack</span>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">New</span>
              </Link>
            </li>
            <li><Link to="/list-your-property" className="hover:text-white transition">List Your Property (0% Fee)</Link></li>
            <li><Link to="/dashboard" className="hover:text-white transition">Host Dashboard</Link></li>
            <li><Link to="/marketing" className="text-stone-400 hover:text-white transition text-xs">Marketing Playbook</Link></li>
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
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-16 pt-8 border-t border-stone-800 text-sm flex flex-col md:flex-row justify-between items-center text-stone-500">
        <p>&copy; {new Date().getFullYear()} Travel Malawi. All rights reserved.</p>
        <div className="flex flex-wrap items-center gap-6 mt-4 md:mt-0">
          <button
            type="button"
            onClick={openAccessPermissionsModal}
            className="hover:text-white transition cursor-pointer text-left"
          >
            Device Permissions
          </button>
          <Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white transition">Terms of Service</Link>
          <Link to="/refunds" className="hover:text-white transition">Refunds & Cancellations</Link>
        </div>
      </div>
    </footer>
  );
}
