import { useState } from 'react';
import { ChevronRight, ChevronDown, Building2, Tag, MapPin, FolderKanban, Zap, Wind, Droplet, Award, Search, Filter } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { ModuleType } from '@/lib/types/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const moduleIcons: Record<ModuleType, React.ReactNode> = {
  energy: <Zap className="w-3 h-3 text-amber-500" />,
  air: <Wind className="w-3 h-3 text-blue-500" />,
  water: <Droplet className="w-3 h-3 text-cyan-500" />,
};

interface TreeItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  level: number;
  children?: React.ReactNode;
  badges?: React.ReactNode;
  defaultOpen?: boolean;
}

const TreeItem = ({ icon, label, sublabel, level, children, badges, defaultOpen = false }: TreeItemProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  const paddingLeft = level * 20;

  return (
    <div>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            className={`flex items-center gap-2 py-2 px-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group`}
            style={{ paddingLeft: `${paddingLeft + 12}px` }}
          >
            {hasChildren ? (
              <span className="w-4 h-4 flex items-center justify-center text-slate-400">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            ) : (
              <span className="w-4 h-4" />
            )}
            <span className="w-5 h-5 flex items-center justify-center text-slate-500">
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-800 truncate block">{label}</span>
              {sublabel && <span className="text-xs text-slate-500">{sublabel}</span>}
            </div>
            {badges && <div className="flex items-center gap-1">{badges}</div>}
          </div>
        </CollapsibleTrigger>
        {hasChildren && (
          <CollapsibleContent>
            {children}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
};

export const HierarchyView = () => {
  const { holdings, brands, sites, projects, getBrandsByHolding, getSitesByBrand, getProjectsBySite } = useAdminData();
  const [searchTerm, setSearchTerm] = useState('');

  const filterHierarchy = () => {
    if (!searchTerm) return holdings;
    
    const term = searchTerm.toLowerCase();
    return holdings.filter(holding => {
      const holdingBrands = getBrandsByHolding(holding.id);
      const matchesBrand = holdingBrands.some(brand => {
        const brandSites = getSitesByBrand(brand.id);
        const matchesSite = brandSites.some(site => {
          const siteProjects = getProjectsBySite(site.id);
          const matchesProject = siteProjects.some(p => p.name.toLowerCase().includes(term));
          return site.name.toLowerCase().includes(term) || matchesProject;
        });
        return brand.name.toLowerCase().includes(term) || matchesSite;
      });
      return holding.name.toLowerCase().includes(term) || matchesBrand;
    });
  };

  const filteredHoldings = filterHierarchy();

  const getModuleBadges = (project: typeof projects[0]) => {
    return (
      <div className="flex gap-0.5">
        {(['energy', 'air', 'water'] as ModuleType[]).map(module => {
          const config = project.modules[module];
          const isActive = config.enabled;
          const isDemo = config.showDemo && !config.enabled;
          return (
            <span
              key={module}
              className={`w-5 h-5 rounded flex items-center justify-center ${
                isActive ? 'bg-green-100' : isDemo ? 'bg-purple-100' : 'bg-gray-100'
              }`}
              title={`${module}: ${isActive ? 'Attivo' : isDemo ? 'Demo' : 'Off'}`}
            >
              {moduleIcons[module]}
            </span>
          );
        })}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-600',
      pending: 'bg-amber-100 text-amber-700',
    };
    return (
      <Badge className={`text-[10px] ${colors[status as keyof typeof colors] || colors.inactive}`}>
        {status}
      </Badge>
    );
  };

  // Count stats
  const stats = {
    holdings: holdings.length,
    brands: brands.length,
    sites: sites.length,
    projects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Gerarchia Progetti
            </CardTitle>
            <CardDescription>
              Vista ad albero di Holdings → Brands → Sites → Projects
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cerca nella gerarchia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        {/* Quick stats */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">{stats.holdings}</span>
            <span className="text-xs text-slate-500">Holdings</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
            <Tag className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">{stats.brands}</span>
            <span className="text-xs text-slate-500">Brands</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium">{stats.sites}</span>
            <span className="text-xs text-slate-500">Sites</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
            <FolderKanban className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">{stats.activeProjects}</span>
            <span className="text-xs text-green-600">/ {stats.projects} Projects</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-1">
            {filteredHoldings.map(holding => {
              const holdingBrands = getBrandsByHolding(holding.id);
              return (
                <TreeItem
                  key={holding.id}
                  icon={<Building2 className="w-4 h-4" />}
                  label={holding.name}
                  sublabel={`${holdingBrands.length} brands`}
                  level={0}
                  defaultOpen={searchTerm.length > 0}
                >
                  {holdingBrands.map(brand => {
                    const brandSites = getSitesByBrand(brand.id);
                    return (
                      <TreeItem
                        key={brand.id}
                        icon={<Tag className="w-4 h-4" />}
                        label={brand.name}
                        sublabel={`${brandSites.length} sites`}
                        level={1}
                        defaultOpen={searchTerm.length > 0}
                      >
                        {brandSites.map(site => {
                          const siteProjects = getProjectsBySite(site.id);
                          return (
                            <TreeItem
                              key={site.id}
                              icon={<MapPin className="w-4 h-4" />}
                              label={site.name}
                              sublabel={`${site.city}, ${site.country}`}
                              level={2}
                              defaultOpen={searchTerm.length > 0}
                              badges={
                                <Badge variant="outline" className="text-[10px]">
                                  {site.region}
                                </Badge>
                              }
                            >
                              {siteProjects.map(project => (
                                <TreeItem
                                  key={project.id}
                                  icon={<FolderKanban className="w-4 h-4" />}
                                  label={project.name}
                                  level={3}
                                  badges={
                                    <div className="flex items-center gap-2">
                                      {getModuleBadges(project)}
                                      {getStatusBadge(project.status)}
                                      {project.certifications.length > 0 && (
                                        <span className="flex items-center gap-0.5 text-amber-600">
                                          <Award className="w-3 h-3" />
                                          <span className="text-[10px]">{project.certifications.length}</span>
                                        </span>
                                      )}
                                    </div>
                                  }
                                />
                              ))}
                              {siteProjects.length === 0 && (
                                <div 
                                  className="text-xs text-slate-400 py-2 italic"
                                  style={{ paddingLeft: '92px' }}
                                >
                                  Nessun progetto
                                </div>
                              )}
                            </TreeItem>
                          );
                        })}
                        {brandSites.length === 0 && (
                          <div 
                            className="text-xs text-slate-400 py-2 italic"
                            style={{ paddingLeft: '72px' }}
                          >
                            Nessun site
                          </div>
                        )}
                      </TreeItem>
                    );
                  })}
                  {holdingBrands.length === 0 && (
                    <div 
                      className="text-xs text-slate-400 py-2 italic"
                      style={{ paddingLeft: '52px' }}
                    >
                      Nessun brand
                    </div>
                  )}
                </TreeItem>
              );
            })}
            {filteredHoldings.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                {searchTerm ? 'Nessun risultato trovato' : 'Nessuna holding presente'}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
