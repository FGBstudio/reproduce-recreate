import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DemoBadgeProps {
  className?: string;
}

export const DemoBadge = ({ className = '' }: DemoBadgeProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 border border-purple-300 rounded-full cursor-help ${className}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
          </span>
          <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Demo Data</span>
          <Info className="w-3 h-3 text-purple-500" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-sm">
          I dati visualizzati sono <strong>esemplificativi</strong> e non rappresentano valori reali. 
          Attiva il modulo per visualizzare i dati di telemetria effettivi.
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
