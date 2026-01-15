/**
 * Loading skeleton components for dashboard
 */

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

// Skeleton for map markers loading state
export const MapLoadingSkeleton = () => (
  <div className="absolute bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 text-center animate-pulse pointer-events-none z-[1000]">
    <div className="glass-panel rounded-xl px-4 py-2 flex items-center gap-2">
      <div className="w-4 h-4 rounded-full bg-fgb-accent/50 animate-pulse" />
      <span className="text-fgb-cream/70 text-xs">Caricamento progetti...</span>
    </div>
  </div>
);

// Skeleton for brand overlay stats
export const BrandOverlaySkeleton = () => (
  <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3 md:gap-6 animate-fade-in max-w-6xl w-full">
    {/* Left: Logo & Stats skeleton */}
    <div className="flex flex-col items-center gap-3 md:gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full scale-150" />
        <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl p-4 md:p-6 border border-white/20">
          <Skeleton className="h-12 md:h-20 w-24 md:w-32 bg-white/20" />
        </div>
      </div>
      
      <div className="glass-panel rounded-xl md:rounded-2xl p-3 md:p-5 min-w-[220px] md:min-w-[280px]">
        <div className="text-center mb-2 md:mb-3">
          <Skeleton className="h-5 w-32 mx-auto mb-2 bg-white/20" />
          <Skeleton className="h-3 w-24 mx-auto bg-white/10" />
        </div>
        
        <div className="grid grid-cols-2 gap-1.5 md:gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
              <Skeleton className="h-6 w-12 mx-auto mb-1 bg-white/20" />
              <Skeleton className="h-2 w-10 mx-auto bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Charts skeleton */}
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 max-w-3xl w-full">
      {[...Array(3)].map((_, i) => (
        <div key={i} className={`glass-panel rounded-xl md:rounded-2xl p-2.5 md:p-4 ${i === 2 ? 'md:col-span-2' : ''}`}>
          <Skeleton className="h-4 w-32 mb-3 bg-white/20" />
          <Skeleton className="h-32 md:h-44 w-full bg-white/10 rounded-lg" />
        </div>
      ))}
    </div>
  </div>
);

// Skeleton for overview section cards
export const OverviewCardSkeleton = ({ fullWidth = false }: { fullWidth?: boolean }) => (
  <Card className={`bg-white border border-gray-200 shadow-lg ${fullWidth ? 'col-span-full' : ''}`}>
    <CardContent className="p-4 md:p-6">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="w-14 h-14 md:w-16 md:h-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Skeleton for project detail chart
export const ChartSkeleton = ({ height = 300 }: { height?: number }) => (
  <div className="bg-white rounded-2xl p-4 md:p-6">
    <div className="flex justify-between items-center mb-4">
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-1">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="w-8 h-8 rounded-md" />
        ))}
      </div>
    </div>
    <Skeleton className="w-full rounded-lg" style={{ height }} />
  </div>
);

// Error state component
export const DashboardError = ({ 
  message = "Impossibile caricare i dati", 
  onRetry 
}: { 
  message?: string; 
  onRetry?: () => void 
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-800 mb-2">Errore di caricamento</h3>
    <p className="text-sm text-gray-600 mb-4">{message}</p>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="px-4 py-2 bg-fgb-teal text-white rounded-lg hover:bg-fgb-teal/90 transition-colors text-sm font-medium"
      >
        Riprova
      </button>
    )}
  </div>
);

// Inline loading indicator for real-time data
export const LiveDataIndicator = ({ isLoading, isError, lastUpdate }: { 
  isLoading?: boolean; 
  isError?: boolean;
  lastUpdate?: string;
}) => (
  <div className="flex items-center gap-2 text-xs">
    {isLoading && (
      <>
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-amber-600">Aggiornamento...</span>
      </>
    )}
    {isError && (
      <>
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-red-600">Errore connessione</span>
      </>
    )}
    {!isLoading && !isError && (
      <>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-gray-500">
          {lastUpdate ? `Aggiornato: ${lastUpdate}` : 'Live'}
        </span>
      </>
    )}
  </div>
);

// Full page loading skeleton for dashboard
export const DashboardLoadingSkeleton = () => (
  <div className="flex flex-col gap-4 p-4 md:p-6 animate-pulse">
    {/* Header skeleton */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    
    {/* Overall card skeleton */}
    <OverviewCardSkeleton fullWidth />
    
    {/* Module cards skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <OverviewCardSkeleton />
      <OverviewCardSkeleton />
      <OverviewCardSkeleton />
    </div>
  </div>
);
