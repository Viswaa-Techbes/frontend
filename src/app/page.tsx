import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col justify-between overflow-hidden">
      {/* Background blobs for premium depth */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-x-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
            TB
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            TechBes<span className="text-indigo-400 font-medium">Billing</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-white px-4 py-2 rounded-xl btn-primary shadow-lg shadow-indigo-500/15"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto w-full px-6 flex-1 flex flex-col items-center justify-center text-center z-10 py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6 animate-pulse">
          ✨ Introducing TechBes Billing Phase 1A
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-none mb-6 max-w-4xl">
          Automate and Scale Your <span className="text-gradient">Billing Operations</span>
        </h1>

        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          Create clients, manage profiles, track payments, and generate beautiful GST-compliant invoices seamlessly. Built for modern freelancers and businesses.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link
            href="/register"
            className="w-full sm:w-auto text-center px-8 py-4 rounded-xl text-base font-semibold text-white btn-primary shadow-xl shadow-indigo-500/20"
          >
            Create Your Account
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto text-center px-8 py-4 rounded-xl text-base font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800/80 hover:text-white transition-all duration-200"
          >
            Sign In to Dashboard
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-xs gap-4 z-10">
        <p>© 2026 TechBes Billing. All rights reserved.</p>
        <div className="flex gap-6">
          <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
          <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
        </div>
      </footer>
    </div>
  );
}
