import { useState, useRef, useEffect } from "react";
import { Shield, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserAccountDropdown } from "./UserAccountDropdown";
import { Input } from "@/components/ui/input";
import brandImg from "@/assets/brand-white.png";

interface HeaderProps {
  userName?: string;
  onSearch?: (query: string) => void;
}

const Header = ({ userName = "Maria Rossi", onSearch }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Close search on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery("");
        onSearch?.("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, onSearch]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 md:px-8 py-3 md:py-5">
      {/* Logo */}
      <div className="flex items-center">
        <img
          src={brandImg}
          alt="FGB"
          className="h-12 md:h-16 w-auto"
        />
      </div>

      {/* Search Bar (centered, expands on click) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
        {isSearchOpen ? (
          <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Cerca progetti, siti, brand..."
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
        ) : (
          <button
            onClick={handleSearchToggle}
            className="glass-panel rounded-full p-2 hover:bg-fgb-light/50 transition-colors"
            title="Cerca progetti"
          >
            <Search className="w-4 h-4 text-fgb-accent" />
          </button>
        )}
      </div>

      {/* User Avatar & Admin */}
      <div className="flex items-center gap-2 md:gap-3">
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
