'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePathname } from 'next/navigation';

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
      const name = seg.charAt(0).toUpperCase() + seg.slice(1);
      return (
        <span key={seg} className="flex items-center gap-1.5">
          {idx > 0 && <span className="text-slate-600">/</span>}
          <span className={idx === segments.length - 1 ? 'text-slate-200 font-semibold' : 'text-slate-500'}>
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
    <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 sticky top-0 z-20 w-[calc(100%-16rem)] ml-64">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm">
        {getBreadcrumbs()}
      </div>

      {/* User profile actions */}
      <div className="flex items-center gap-4">
        {/* Help tooltip/icon */}
        <div className="text-slate-400 hover:text-slate-300 cursor-pointer p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>

        {/* User drop menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 focus:outline-none group p-1.5 rounded-xl hover:bg-slate-800/40 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/20 group-hover:border-indigo-500/40 transition-colors">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-300 leading-none">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 leading-none mt-1">{user?.email || 'user@example.com'}</p>
            </div>
            <svg
              className={`w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 animate-slideUp z-50">
              <div className="px-4 py-2 border-b border-slate-800 md:hidden">
                <p className="text-xs font-semibold text-slate-300 leading-none">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-500 leading-none mt-1">{user?.email || 'user@example.com'}</p>
              </div>
              
              <Link
                href="/settings"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                My Profile
              </Link>
              
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 border-t border-slate-800/60 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
