import { useState, useRef, useEffect, useMemo } from "react";
import { Shield, Search, X, MapPin, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserAccountDropdown } from "./UserAccountDropdown";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import brandImg from "@/assets/brand-white.png";
import { Project } from "@/lib/data";
import { useAllProjects } from "@/hooks/useRealTimeData";

interface HeaderProps {
  userName?: string;
  onSearch?: (query: string) => void;
  onProjectSelect?: (project: Project) => void;
}

const Header = ({ userName = "Maria Rossi", onSearch, onProjectSelect }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { projects } = useAllProjects();

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return projects
      .filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.address.toLowerCase().includes(query)
      )
      .slice(0, 8); // Limit to 8 results
  }, [projects, searchQuery]);

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
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 md:px-8 py-3 md:py-5" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      {/* Logo */}
      <div className="flex items-center">
        <img
          src={brandImg}
          alt="FGB"
          className="h-12 md:h-16 w-auto"
        />
      </div>

      {/* Search Bar (centered, expands on click) */}
      <div ref={searchContainerRef} className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center ${isSearchOpen ? 'z-50' : 'z-10'}`}>
        {isSearchOpen ? (
          <div className="relative">
            <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Search className="w-4 h-4 text-muted-foreground" />
               <Input
                ref={searchInputRef}
                type="text"
                placeholder={t('header.search_placeholder')}
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
            
            {/* Search Results Dropdown */}
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
                          <p className="text-sm font-medium text-foreground truncate">
                            {project.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {project.address}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* No results message */}
            {searchQuery.trim() && filteredProjects.length === 0 && (
              <div className="absolute top-full mt-2 w-72 md:w-80 left-1/2 -translate-x-1/2 glass-panel rounded-lg shadow-lg border border-border/50 p-4 text-center animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-sm text-muted-foreground">
                  {t('header.no_results')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleSearchToggle}
            className="glass-panel rounded-full p-2 hover:bg-fgb-light/50 transition-colors"
            title={t('header.search_projects')}
          >
            <Search className="w-4 h-4 text-fgb-accent" />
          </button>
        )}
      </div>

      {/* User Avatar, Language & Admin */}
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={toggleLanguage}
          className="glass-panel rounded-full px-3 py-1.5 md:py-2 flex items-center gap-1.5 hover:bg-fgb-light/50 transition-colors"
          title="Switch language"
        >
          <Globe className="w-4 h-4 text-fgb-accent" />
          <span className="text-xs font-medium text-foreground">{language.toUpperCase()}</span>
        </button>
        <button
          onClick={handleAdminClick}
          className="glass-panel rounded-full px-3 py-1.5 md:py-2 flex items-center gap-2 hover:bg-fgb-light/50 transition-colors"
          title="Admin Console"
        >
          <Shield className="w-4 h-4 text-fgb-accent" />
          <span className="hidden sm:inline text-xs font-medium text-foreground">Admin</span>
        </button>
        <UserAccountDropdown />
      </div>
    </header>
  );
};

export default Header;
