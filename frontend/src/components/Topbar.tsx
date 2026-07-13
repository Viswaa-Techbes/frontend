'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Topbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse path to create breadcrumbs
  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    
    return segments.map((seg, idx) => {
      const name = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
      return (
        <span key={seg} className="flex items-center gap-1.5 text-xs text-slate-600">
          {idx > 0 && <span className="text-slate-350">/</span>}
          <span className={idx === segments.length - 1 ? 'text-slate-900 font-semibold' : 'text-slate-500'}>
            {name}
          </span>
        </span>
      );
    });
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20 w-full select-none print:hidden">
      {/* Left Area: Breadcrumbs & Search */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          {getBreadcrumbs()}
        </div>
      </div>

      {/* Right Area: Actions & Avatar */}
      <div className="flex items-center gap-4">
        {/* Search Placeholder Input */}
        <div className="relative hidden md:block">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search document, clients..."
            className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-300 text-xs w-48 focus:outline-none focus:border-brand-primary bg-slate-50 text-slate-900 placeholder:text-slate-400"
            disabled
          />
        </div>

        {/* Notifications Icon */}
        <button className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-50 transition-colors relative">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-accent rounded-full" />
        </button>

        {/* User profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 focus:outline-none group p-1 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-brand-primary flex items-center justify-center font-bold text-sm border border-blue-100 transition-colors">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-900 leading-none">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 leading-none mt-1">{user?.email || 'user@example.com'}</p>
            </div>
            <svg
              className={`w-4 h-4 text-slate-500 group-hover:text-slate-650 transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 animate-slideUp z-50">
              <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                <p className="text-xs font-semibold text-slate-900 leading-none">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-500 leading-none mt-1">{user?.email || 'user@example.com'}</p>
              </div>
              
              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-650 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                My Profile
              </Link>
              
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-xs text-rose-500 hover:bg-rose-50 hover:text-rose-600 border-t border-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
