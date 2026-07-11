import React from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Core panel area */}
        <div className="flex-1 flex flex-col min-h-screen w-[calc(100%-16rem)]">
          {/* Top navigation */}
          <Topbar />

          {/* Main page content view */}
          <main className="flex-1 p-8 overflow-y-auto w-[calc(100%-16rem)] ml-64 bg-slate-950/40">
            <div className="max-w-7xl mx-auto animate-fadeIn">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
