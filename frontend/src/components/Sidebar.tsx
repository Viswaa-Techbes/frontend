'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import BrandLogo from '@/components/BrandLogo';

export default function Sidebar() {
  const pathname = usePathname();
  const [isSalesExpanded, setIsSalesExpanded] = useState(false);

  const salesSubLinks = [
    { name: 'Clients & Prospects', path: '/clients' },
    { name: 'Quotation & Estimates', path: '/quotations' },
    { name: 'Proforma Invoices', path: '/proforma-invoices' },
    { name: 'Invoices', path: '/invoices' },
    { name: 'Payment Receipts', path: '/payments' },
    { name: 'Sales Orders', path: '/sales-orders' },
    { name: 'Delivery Challans', path: '/delivery-challans' },
    { name: 'Credit Notes', path: '/credit-notes' },
  ];

  // Auto-expand Sales & Invoices if any sub-link is active
  useEffect(() => {
    const isActiveSubLink = salesSubLinks.some(link => 
      pathname === link.path || pathname.startsWith(link.path + '/')
    );
    if (isActiveSubLink) {
      setIsSalesExpanded(true);
    }
  }, [pathname]);

  const isLinkActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/');
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-30 select-none print:hidden">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 bg-white">
        <Link href="/dashboard" className="block w-full">
          <BrandLogo />
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto bg-white">
        {/* Dashboard Link */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
            isLinkActive('/dashboard')
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
          </svg>
          <span className="text-sm">Dashboard</span>
        </Link>

        {/* Settings Link */}
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
            isLinkActive('/settings')
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.756.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm">Settings</span>
        </Link>

        {/* Sales & Invoices Expandable Header */}
        <div className="space-y-1">
          <button
            onClick={() => setIsSalesExpanded(!isSalesExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-150 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium">Sales & Invoices</span>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                isSalesExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Sub menu list */}
          <div
            className={`pl-8 pr-1 space-y-1 transition-all duration-150 overflow-hidden ${
              isSalesExpanded ? 'max-h-[400px] opacity-100 py-0.5' : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            {salesSubLinks.map((subLink) => {
              const active = isLinkActive(subLink.path);
              return (
                <Link
                  key={subLink.name}
                  href={subLink.path}
                  className={`block px-3 py-1.5 rounded-md text-xs transition-colors truncate ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-650 hover:bg-slate-50 hover:text-slate-905'
                  }`}
                  title={subLink.name}
                >
                  {subLink.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Bottom context information */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-600">TechBes Billing</span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">v1.1</span>
        </div>
      </div>
    </aside>
  );
}
