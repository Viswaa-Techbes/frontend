import React from 'react';

interface BrandLogoProps {
  collapsed?: boolean;
}

export default function BrandLogo({ collapsed = false }: BrandLogoProps) {
  if (collapsed) {
    return (
      <div className="w-8 h-8 flex items-center justify-center overflow-hidden rounded-lg bg-white border border-slate-100 shadow-xs">
        <img
          src="/brand/techbes-logo.png"
          alt="TechBes Logo Mark"
          className="w-16 h-8 max-w-none object-cover object-left"
          style={{ marginLeft: '1px' }} // Visual centering adjustment
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start h-10 w-full">
      <img
        src="/brand/techbes-logo.png"
        alt="TechBes Billing"
        className="max-h-[38px] max-w-[170px] object-contain"
      />
    </div>
  );
}
