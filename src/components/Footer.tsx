import React from 'react';
import { Link } from 'react-router-dom';
import { Palmtree, Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import { PROPERTY_CATEGORIES } from '../lib/listing';

export default function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 py-16 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-6">
          {/* The wordmark here still read "MalawiScapes", the name the site
              carried before the rebrand — on every page, under the new one. */}
          <Link to="/" className="flex items-center gap-2 text-white">
            <Palmtree className="h-8 w-8 text-white" />
            <span className="text-2xl font-serif font-bold tracking-tight">Travel Malawi</span>
          </Link>
          <p className="text-stone-400 text-sm leading-relaxed">
            Lodges, camps and guesthouses across Malawi, listed by the people who run them
            and booked directly with them. No agency, no booking fee.
          </p>
        </div>

        <div>
          <h4 className="text-white font-serif font-semibold text-lg mb-6">Browse</h4>
          <ul className="space-y-4 text-sm">
            {/* These all pointed at the bare home page, so every one of them
                landed on an unfiltered list. */}
            {PROPERTY_CATEGORIES.slice(0, 4).map(category => (
              <li key={category}>
                <Link
                  to={`/?category=${encodeURIComponent(category)}#search-results`}
                  className="hover:text-white transition"
                >
                  {category}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-serif font-semibold text-lg mb-6">Hosts</h4>
          <ul className="space-y-4 text-sm">
            <li><Link to="/list-your-property" className="hover:text-white transition">List your property</Link></li>
            <li><Link to="/dashboard" className="hover:text-white transition">Host dashboard</Link></li>
            <li><Link to="/my-bookings" className="hover:text-white transition">Your bookings</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-serif font-semibold text-lg mb-6">Reach us</h4>
          <ul className="space-y-4 text-sm">
            <li className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-stone-500" />
              <span>bookings@travelmalawi.com</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-stone-500" />
              <span>+265 99 123 4567</span>
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-stone-500" />
              <span>Lilongwe, Malawi</span>
            </li>
          </ul>
          <div className="flex items-center gap-3 mt-6">
            <a href="#" aria-label="Facebook" className="bg-stone-800 p-3 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Instagram" className="bg-stone-800 p-3 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" aria-label="Twitter" className="bg-stone-800 p-3 rounded-full hover:bg-stone-700 hover:text-white transition">
              <Twitter className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-16 pt-8 border-t border-stone-800 text-sm flex flex-col md:flex-row justify-between items-center text-stone-500">
        <p>&copy; {new Date().getFullYear()} Travel Malawi. All rights reserved.</p>
        <div className="flex items-center gap-6 mt-4 md:mt-0">
          <a href="#" className="hover:text-white transition">Privacy Policy</a>
          <a href="#" className="hover:text-white transition">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
