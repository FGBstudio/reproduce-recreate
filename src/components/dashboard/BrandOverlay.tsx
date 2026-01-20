import { regions } from "@/lib/data";



interface RegionOverlayProps {

  currentRegion: string;

  visible?: boolean;

}



const RegionOverlay = ({ currentRegion, visible = true }: RegionOverlayProps) => {

  const region = regions[currentRegion];

  

  if (currentRegion === "GLOBAL" || !region?.kpi) return null;



  const aqColorClass = {

    EXCELLENT: "text-emerald-400",

    GOOD: "text-emerald-400",

    MODERATE: "text-yellow-400",

    POOR: "text-rose-400",

  }[region.kpi.aq] || "text-muted-foreground";



  return (

    <div 

      className={`fixed top-24 left-8 z-30 w-80 pointer-events-none transition-all duration-500 ${

        visible 

          ? "opacity-100 translate-x-0" 

          : "opacity-0 -translate-x-10"

      }`}

    >

      <div className="glass-panel p-6 rounded-2xl pointer-events-auto">

        <h2 className="text-3xl font-serif text-foreground mb-1">{region.name}</h2>

        <div className="text-xs text-fgb-accent uppercase tracking-widest mb-6">

          Regional Performance

        </div>



        {/* KPI Aggregations */}

        <div className="space-y-4">

          <div className="bg-white/5 p-4 rounded-xl border border-white/10">

            <div className="flex justify-between items-end mb-1">

              <span className="text-sm text-muted-foreground">Avg. Energy Intensity</span>

              <span className="text-xl font-bold text-foreground">

                {region.kpi.intensity} <span className="text-xs font-normal opacity-70">kWh/m²</span>

              </span>

            </div>

            <div className="w-full bg-muted h-1 rounded-full overflow-hidden">

              <div 

                className="bg-emerald-400 h-full transition-all duration-700"

                style={{ width: `${Math.min(region.kpi.intensity, 100)}%` }}

              />

            </div>

          </div>



          <div className="bg-white/5 p-4 rounded-xl border border-white/10">

            <div className="flex justify-between items-end mb-1">

              <span className="text-sm text-muted-foreground">Air Quality Score</span>

              <span className={`text-xl font-bold ${aqColorClass}`}>{region.kpi.aq}</span>

            </div>

            <div className="flex gap-1 mt-2">

              <span className={`h-2 flex-1 rounded-sm ${region.kpi.aq === "EXCELLENT" || region.kpi.aq === "GOOD" ? "bg-emerald-500" : "bg-emerald-500/30"}`} />

              <span className={`h-2 flex-1 rounded-sm ${region.kpi.aq === "EXCELLENT" ? "bg-emerald-500" : "bg-emerald-500/30"}`} />

              <span className="h-2 flex-1 rounded-sm bg-emerald-500/30" />

            </div>

          </div>



          <div className="grid grid-cols-2 gap-3 mt-4">

            <div className="text-center p-3 rounded-lg bg-white/5">

              <div className="text-2xl font-bold text-foreground">{region.kpi.online}</div>

              <div className="text-[10px] uppercase text-muted-foreground">Active Sites</div>

            </div>

            <div className="text-center p-3 rounded-lg bg-white/5">

              <div className={`text-2xl font-bold ${region.kpi.critical > 0 ? "text-rose-400" : "text-emerald-400"}`}>

                {region.kpi.critical}

              </div>

              <div className="text-[10px] uppercase text-muted-foreground">Critical Alerts</div>

            </div>

          </div>

        </div>



        <div className="mt-6 pt-4 border-t border-white/10 text-center">

          <p className="text-xs text-muted-foreground italic">

            Select a pin on the map to view project details.

          </p>

        </div>

      </div>

    </div>

  );

};



export default RegionOverlay;
