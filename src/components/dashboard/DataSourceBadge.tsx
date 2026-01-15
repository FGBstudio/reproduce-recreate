/**
 * DataSourceBadge - Indicates whether chart data is LIVE or DEMO
 */

import { Badge } from "@/components/ui/badge";
import { Radio, Database } from "lucide-react";

interface DataSourceBadgeProps {
  isRealData: boolean;
  isLoading?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export const DataSourceBadge = ({ 
  isRealData, 
  isLoading = false, 
  className = "",
  size = "sm"
}: DataSourceBadgeProps) => {
  const sizeClasses = size === "sm" 
    ? "text-[9px] px-1.5 py-0.5 gap-1" 
    : "text-[10px] px-2 py-1 gap-1.5";

  if (isLoading) {
    return (
      <Badge 
        className={`${sizeClasses} bg-gray-100 text-gray-500 border border-gray-200 font-medium uppercase tracking-wider animate-pulse ${className}`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Loading
      </Badge>
    );
  }

  if (isRealData) {
    return (
      <Badge 
        className={`${sizeClasses} bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium uppercase tracking-wider ${className}`}
      >
        <Radio className="w-2.5 h-2.5" />
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
        Live
      </Badge>
    );
  }

  return (
    <Badge 
      className={`${sizeClasses} bg-amber-50 text-amber-700 border border-amber-200 font-medium uppercase tracking-wider ${className}`}
    >
      <Database className="w-2.5 h-2.5" />
      Demo
    </Badge>
  );
};

export default DataSourceBadge;
