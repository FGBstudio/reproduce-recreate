import React, { useMemo, useRef, useState, useCallback } from "react";
import { ResponsiveContainer } from "recharts";
import { Maximize2, RotateCcw, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ZoomableChartProps = {
  /** A single Recharts chart element (LineChart, AreaChart, BarChart, ...) with a `data` prop. */
  children: React.ReactElement;
  height?: number | string;
  className?: string;
  /** Set false to render a plain ResponsiveContainer with no zoom UI. */
  enableZoom?: boolean;
  /** Optional title shown in the expand dialog. */
  title?: string;
};

type InnerProps = {
  children: React.ReactElement;
  enableZoom: boolean;
  onExpand?: () => void;
  showExpand?: boolean;
};

const ChartBody: React.FC<InnerProps> = ({ children, enableZoom, onExpand, showExpand }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const data = (children.props as any)?.data as any[] | undefined;
  const total = Array.isArray(data) ? data.length : 0;
  const start = range ? range[0] : 0;
  const end = range ? range[1] : Math.max(0, total - 1);

  const slicedChild = useMemo(() => {
    if (!enableZoom || !range || !Array.isArray(data) || total === 0) return children;
    const sliced = data.slice(start, end + 1);
    return React.cloneElement(children, { data: sliced });
  }, [children, range, data, start, end, enableZoom, total]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!enableZoom || !e.ctrlKey || total < 3 || !containerRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const curStart = range ? range[0] : 0;
      const curEnd = range ? range[1] : total - 1;
      const span = curEnd - curStart + 1;
      const center = curStart + ratio * span;
      const factor = e.deltaY < 0 ? 0.8 : 1.25;
      const newSpan = Math.max(2, Math.min(total, Math.round(span * factor)));
      let newStart = Math.round(center - ratio * newSpan);
      let newEnd = newStart + newSpan - 1;
      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > total - 1) {
        newStart -= newEnd - (total - 1);
        newEnd = total - 1;
      }
      newStart = Math.max(0, newStart);
      newEnd = Math.min(total - 1, newEnd);
      if (newStart === 0 && newEnd === total - 1) setRange(null);
      else setRange([newStart, newEnd]);
    },
    [enableZoom, total, range],
  );

  const reset = () => setRange(null);
  const isZoomed = range !== null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full group"
      onWheel={handleWheel}
      onDoubleClick={() => isZoomed && reset()}
    >
      <ResponsiveContainer width="100%" height="100%">
        {slicedChild}
      </ResponsiveContainer>

      {enableZoom && (
        <>
          <div className="absolute top-1 right-1 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            {isZoomed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="p-1 rounded bg-background/70 hover:bg-background border border-border/50 backdrop-blur-sm"
                title="Reset zoom"
              >
                <RotateCcw className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
            {showExpand && onExpand && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
                className="p-1 rounded bg-background/70 hover:bg-background border border-border/50 backdrop-blur-sm"
                title="Espandi"
              >
                <Maximize2 className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {isZoomed && (
            <div className="absolute bottom-1 left-1 z-10 px-1.5 py-0.5 rounded bg-background/70 backdrop-blur-sm border border-border/50 text-[10px] text-muted-foreground pointer-events-none">
              {start + 1}–{end + 1} / {total}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const ZoomableChart: React.FC<ZoomableChartProps> = ({
  children,
  height = "100%",
  className,
  enableZoom = true,
  title,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div style={{ width: "100%", height }} className={cn(className)}>
        <ChartBody
          enableZoom={enableZoom}
          onExpand={() => setExpanded(true)}
          showExpand={enableZoom}
        >
          {children}
        </ChartBody>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[88vh] p-4 sm:p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="text-sm font-medium text-foreground">
              {title || "Chart"}
            </h3>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Ctrl + scroll per zoom · doppio click per reset
            </span>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <ChartBody enableZoom={enableZoom}>{children}</ChartBody>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ZoomableChart;