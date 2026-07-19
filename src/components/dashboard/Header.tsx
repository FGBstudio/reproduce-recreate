import { useState, useRef, useEffect, useMemo } from "react";
import { Shield, Search, X, MapPin, Globe, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserAccountDropdown } from "./UserAccountDropdown";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import brandImg from "@/assets/brand-white.png";
import { Project } from "@/lib/data";
import { useAllProjects } from "@/hooks/useRealTimeData";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserScope } from "@/hooks/useUserScope";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useWrapped } from "@/components/wrapped/WrappedContext";
import { Sparkles } from "lucide-react";

interface HeaderProps {
  userName?: string;
  onSearch?: (query: string) => void;
  onProjectSelect?: (project: Project) => void;
  onBurgerOpen?: () => void;
  selectedHolding?: string | null;
  selectedBrand?: string | null;
}

const Header = ({ userName = "Maria Rossi", onSearch, onProjectSelect, onBurgerOpen, selectedHolding = null, selectedBrand = null }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, login, isAdmin } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const isMobile = useIsMobile();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { projects } = useAllProjects();
  const { clientRole, holdingId, brandId, siteId } = useUserScope();
  const { brands, sites, holdings } = useAdminData();
  const { open: openWrapped } = useWrapped();

  // Determine the wrapped scope based on the user's role
  const launchWrapped = () => {
    if (clientRole === 'STORE_USER' && siteId) {
      const s = sites.find(x => x.id === siteId);
      if (s) {
        openWrapped({ kind: 'site', siteId: s.id, siteName: s.name, areaM2: s.area_m2 ?? s.areaSqm ?? null });
        return;
      }
    }
    if (clientRole === 'ADMIN_BRAND' && brandId) {
      const b = brands.find(x => x.id === brandId);
      const brandSites = sites.filter(s => s.brandId === brandId).map(s => ({
        id: s.id, name: s.name, region: s.region, brandName: b?.name ?? null,
        areaM2: s.area_m2 ?? s.areaSqm ?? null,
      }));
      if (brandSites.length) {
        openWrapped({ kind: 'aggregate', label: b?.name ?? 'Brand', sites: brandSites });
        return;
      }
    }
    if (clientRole === 'ADMIN_HOLDING' && holdingId) {
      const h = holdings.find(x => x.id === holdingId);
      const allowedBrandIds = new Set(brands.filter(b => b.holdingId === holdingId).map(b => b.id));
      const hSites = sites.filter(s => allowedBrandIds.has(s.brandId)).map(s => ({
        id: s.id, name: s.name, region: s.region,
        brandName: brands.find(b => b.id === s.brandId)?.name ?? null,
        areaM2: s.area_m2 ?? s.areaSqm ?? null,
      }));
      if (hSites.length) {
        openWrapped({ kind: 'aggregate', label: h?.name ?? 'Holding', sites: hSites });
        return;
      }
    }
    // FGB Admin / User → global
    const all = sites.map(s => ({
      id: s.id, name: s.name, region: s.region,
      brandName: brands.find(b => b.id === s.brandId)?.name ?? null,
      areaM2: s.area_m2 ?? s.areaSqm ?? null,
    }));
    openWrapped({ kind: 'admin-global', label: 'FGB Global', sites: all });
  };

  // Restrict the searchable project list to what this user can actually access
  const scopedProjects = useMemo(() => {
    const base = (() => {
      switch (clientRole) {
      case 'ADMIN_HOLDING': {
        if (!holdingId) return [];
        const allowedBrandIds = new Set(
          brands.filter(b => b.holdingId === holdingId).map(b => b.id)
        );
        return projects.filter(p => p.brandId && allowedBrandIds.has(p.brandId));
      }
      case 'ADMIN_BRAND':
        return brandId ? projects.filter(p => p.brandId === brandId) : [];
      case 'STORE_USER':
        return siteId ? projects.filter(p => p.siteId === siteId) : [];
      default:
        return projects;
      }
    })();

    // Further filter by the currently selected holding / brand on the map
    let filtered = base;
    if (selectedHolding) {
      const allowedBrandIds = new Set(
        brands.filter(b => b.holdingId === selectedHolding).map(b => b.id)
      );
      filtered = filtered.filter(p => p.brandId && allowedBrandIds.has(p.brandId));
    }
    if (selectedBrand) {
      filtered = filtered.filter(p => p.brandId === selectedBrand);
    }
    return filtered;
  }, [projects, clientRole, holdingId, brandId, siteId, brands, selectedHolding, selectedBrand]);

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return scopedProjects
      .filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.address.toLowerCase().includes(query)
      )
      .slice(0, 8); // Limit to 8 results
  }, [scopedProjects, searchQuery]);

  const handleAdminClick = () => {
    if (!user) {
      login('admin@fgb.com', 'admin');
    }
    navigate('/admin');
  };

  const handleSearchToggle = () => {
    setIsSearchOpen(!isSearchOpen);
    if (!isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      onSearch?.("");
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    onSearch?.("");
    searchInputRef.current?.focus();
  };

  const handleProjectClick = (project: Project) => {
    onProjectSelect?.(project);
    setIsSearchOpen(false);
    setSearchQuery("");
    onSearch?.("");
  };

  // Close search on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery("");
        onSearch?.("");
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery("");
          onSearch?.("");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchOpen, onSearch]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "0.75rem",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* ── MOBILE LAYOUT ── */}
      {isMobile ? (
        <>
          {/* Left: Burger — 48×48 touch target */}
          <button
            onClick={onBurgerOpen}
            className="glass-panel rounded-full p-3 min-w-[44px] min-h-[44px] hover:bg-fgb-light/50 transition-colors active:scale-95 flex items-center justify-center"
            aria-label="Menu"
            style={{ minWidth: 48, minHeight: 48 }}
          >
            <Menu className="w-5 h-5 text-fgb-accent" />
          </button>

          {/* Center: Search */}
          <div
            ref={searchContainerRef}
            className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center ${
              isSearchOpen ? "z-50" : "z-10"
            }`}
          >
            {isSearchOpen ? (
              <div className="relative">
                <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t("header.search_placeholder")}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="border-0 bg-transparent h-6 w-44 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 text-sm"
                  />
                  <button
                    onClick={handleClearSearch}
                    className="p-0.5 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {filteredProjects.length > 0 && (
                  <div className="absolute top-full mt-2 w-72 left-1/2 -translate-x-1/2 glass-panel rounded-lg shadow-lg border border-transparent overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <ScrollArea className="max-h-64">
                      <div className="py-1">
                        {filteredProjects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => handleProjectClick(project)}
                            className="w-full px-3 py-2 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{project.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {searchQuery.trim() && filteredProjects.length === 0 && (
                  <div className="absolute top-full mt-2 w-72 left-1/2 -translate-x-1/2 glass-panel rounded-lg shadow-lg border border-border/50 p-4 text-center animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-sm text-muted-foreground">{t("header.no_results")}</p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleSearchToggle}
                className="glass-panel rounded-full p-3 min-w-[44px] min-h-[44px] hover:bg-fgb-light/50 transition-colors active:scale-95 flex items-center justify-center"
                title={t("header.search_projects")}
                style={{ minWidth: 48, minHeight: 48 }}
              >
                <Search className="w-5 h-5 text-fgb-accent" />
              </button>
            )}
          </div>

          {/* Right: Logo */}
          <img src={brandImg} alt="FGB" className="h-10 w-auto" />
        </>
      ) : (
        /* ── DESKTOP LAYOUT (unchanged) ── */
        <>
          {/* Logo */}
          <div className="flex items-center">
            <img src={brandImg} alt="FGB" className="h-12 md:h-16 w-auto" />
          </div>

          {/* Search Bar (centered) */}
          <div
            ref={searchContainerRef}
            className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center ${
              isSearchOpen ? "z-50" : "z-10"
            }`}
          >
            {isSearchOpen ? (
              <div className="relative">
                <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder={t("header.search_placeholder")}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="border-0 bg-transparent h-6 w-48 md:w-64 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 text-sm"
                  />
                  <button
                    onClick={handleClearSearch}
                    className="p-0.5 hover:bg-muted rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {filteredProjects.length > 0 && (
                  <div className="absolute top-full mt-2 w-72 md:w-80 left-1/2 -translate-x-1/2 glass-panel rounded-lg shadow-lg border border-transparent overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <ScrollArea className="max-h-64">
                      <div className="py-1">
                        {filteredProjects.map((project) => (
                          <button
                            key={project.id}
                            onClick={() => handleProjectClick(project)}
                            className="w-full px-3 py-2 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{project.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {searchQuery.trim() && filteredProjects.length === 0 && (
                  <div className="absolute top-full mt-2 w-72 md:w-80 left-1/2 -translate-x-1/2 glass-panel rounded-lg shadow-lg border border-border/50 p-4 text-center animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-sm text-muted-foreground">{t("header.no_results")}</p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleSearchToggle}
                className="glass-panel rounded-full p-2 hover:bg-fgb-light/50 transition-colors"
                title={t("header.search_projects")}
                data-tour="header-search"
              >
                <Search className="w-4 h-4 text-fgb-accent" />
              </button>
            )}
          </div>

          {/* User Avatar, Language & Admin */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={launchWrapped}
              className="glass-panel rounded-full px-3 py-2 flex items-center gap-1.5 hover:bg-fgb-light/50 transition-colors"
              title="FGB Weekly Wrapped"
            >
              <Sparkles className="w-4 h-4 text-fgb-accent" />
              <span className="text-xs font-medium text-foreground hidden md:inline">Wrapped</span>
            </button>
            {/*
            <button
              onClick={toggleLanguage}
              className="glass-panel rounded-full px-3 py-1.5 md:py-2 flex items-center gap-1.5 hover:bg-fgb-light/50 transition-colors"
              title="Switch language"
            >
              <Globe className="w-4 h-4 text-fgb-accent" />
              <span className="text-xs font-medium text-foreground">{language.toUpperCase()}</span>
            </button>
            */}
            <UserAccountDropdown />
          </div>
        </>
      )}
    </header>
  );
};

export default Header;

