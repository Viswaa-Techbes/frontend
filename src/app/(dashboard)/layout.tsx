import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 flex text-slate-800">
        {/* Sidebar (Fixed width 256px / w-64) */}
        <Sidebar />

        {/* Content Panel Wrapper (Offset by 256px via pl-64) */}
        <div className="flex-1 pl-64 flex flex-col min-h-screen print:pl-0">
          {/* Top Bar */}
          <Topbar />

          {/* Page Body Viewport */}
          <main className="flex-1 p-8 overflow-y-auto print:p-0">
            <div className="max-w-7xl mx-auto animate-fadeIn print:max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
