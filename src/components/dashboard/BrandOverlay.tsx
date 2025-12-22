import { Brand, Holding, getBrandById, getHoldingById, projects, getBrandsByHolding } from "@/lib/data";

interface BrandOverlayProps {
  selectedBrand: string | null;
  selectedHolding: string | null;
  visible?: boolean;
}

const BrandOverlay = ({ selectedBrand, selectedHolding, visible = true }: BrandOverlayProps) => {
  // Get brand or holding info
  const brand = selectedBrand ? getBrandById(selectedBrand) : null;
  const holding = selectedHolding ? getHoldingById(selectedHolding) : null;
  
  // Calculate stats
  const getStats = () => {
    let filteredProjects = projects;
    
    if (selectedBrand) {
      filteredProjects = projects.filter(p => p.brandId === selectedBrand);
    } else if (selectedHolding) {
      const holdingBrands = getBrandsByHolding(selectedHolding);
      filteredProjects = projects.filter(p => holdingBrands.some(b => b.id === p.brandId));
    }
    
    const totalEnergy = filteredProjects.reduce((sum, p) => sum + p.data.total, 0);
    const avgTemp = filteredProjects.length 
      ? (filteredProjects.reduce((sum, p) => sum + p.data.temp, 0) / filteredProjects.length).toFixed(1)
      : 0;
    const totalAlerts = filteredProjects.reduce((sum, p) => sum + p.data.alerts, 0);
    const avgCo2 = filteredProjects.length 
      ? Math.round(filteredProjects.reduce((sum, p) => sum + p.data.co2, 0) / filteredProjects.length)
      : 0;
    
    return {
      projectCount: filteredProjects.length,
      totalEnergy,
      avgTemp,
      totalAlerts,
      avgCo2
    };
  };
  
  const stats = getStats();
  const displayEntity = brand || holding;
  
  if (!displayEntity || !visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-20">
      <div className="flex flex-col items-center gap-8 animate-fade-in">
        {/* Brand/Holding Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/10 blur-3xl rounded-full scale-150" />
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
            <img 
              src={displayEntity.logo} 
              alt={displayEntity.name}
              className="h-20 md:h-28 w-auto object-contain filter brightness-0 invert opacity-90"
            />
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="glass-panel rounded-2xl p-6 min-w-[320px]">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-foreground">{displayEntity.name}</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {brand ? 'Brand Overview' : 'Holding Overview'}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-foreground">{stats.projectCount}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Stores</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-foreground">{stats.totalEnergy}</div>
              <div className="text-[10px] uppercase text-muted-foreground">kWh Total</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-2xl font-bold text-foreground">{stats.avgCo2}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Avg CO₂ ppm</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/5 border border-white/10">
              <div className={`text-2xl font-bold ${stats.totalAlerts > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {stats.totalAlerts}
              </div>
              <div className="text-[10px] uppercase text-muted-foreground">Alerts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandOverlay;