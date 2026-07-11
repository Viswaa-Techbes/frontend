'use client';

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import PageHeader from '../../../components/PageHeader';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <PageHeader
        title={`Welcome back, ${user?.name || 'User'}!`}
        subtitle="Here's a quick summary of your billing activities."
      />

      {/* Quick Action Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/clients/new"
          className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition-all duration-300 group flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200 group-hover:text-white transition-colors">
              Add New Client
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Add businesses or individuals, setup default billing addresses, and enter financial references.
            </p>
          </div>
        </Link>

        <Link
          href="/clients"
          className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-purple-500/40 transition-all duration-300 group flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200 group-hover:text-white transition-colors">
              Manage Clients
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              View, search, filter, edit, or delete existing clients registered with your business.
            </p>
          </div>
        </Link>
      </div>

      {/* Metrics placeholder */}
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h4 className="text-lg font-bold text-slate-300">Financial Insights Panel</h4>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">
          Sales summaries, outstanding credits, and invoice statistics will be displayed here in Phase 1B.
        </p>
      </div>
    </div>
  );
}
