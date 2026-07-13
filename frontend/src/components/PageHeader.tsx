import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 whitespace-nowrap">{actions}</div>}
    </div>
  );
}
