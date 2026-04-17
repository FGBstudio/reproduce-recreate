import React from 'react';
import { Info } from 'lucide-react';

interface LegendTooltipProps {
  content: React.ReactNode;
  iconSize?: number;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function LegendTooltip({
  content,
  iconSize = 14,
  className = '',
  position = 'top'
}: LegendTooltipProps) {
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  return (
    <div className={`relative inline-flex items-center group cursor-help ${className}`}>
      <Info size={iconSize} className="text-slate-400 hover:text-slate-600 transition-colors" />
      
      {/* Tooltip Content */}
      <div className={`absolute z-50 w-64 p-3 rounded-xl invisible opacity-0 
        group-hover:visible group-hover:opacity-100 transition-all duration-200 
        bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 
        pointer-events-none text-xs font-medium text-slate-600 leading-relaxed ${getPositionClasses()}`}
      >
        {content}
      </div>
    </div>
  );
}
