import { useState } from "react";
import { X, Globe, Building2, Tag, Shield, LogOut, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllHoldings, useAllBrands } from "@/hooks/useRealTimeData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo } from "react";

interface MobileBurgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  selectedHolding: string | null;
  selectedBrand: string | null;
  onHoldingChange?: (holdingId: string | null) => void;
  onBrandChange?: (brandId: string | null) => void;
  canChangeHolding?: boolean;
  canChangeBrand?: boolean;
}

const MobileBurgerMenu = ({
  isOpen,
  onClose,
  selectedHolding,
  selectedBrand,
  onHoldingChange,
  onBrandChange,
  canChangeHolding = true,
  canChangeBrand = true,
}: MobileBurgerMenuProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { holdings } = useAllHoldings();
  const { brands } = useAllBrands();

  const availableBrands = useMemo(() => {
    if (!selectedHolding) return brands;
    return brands.filter(b => b.holdingId === selectedHolding);
  }, [selectedHolding, brands]);

  const handleAdminClick = () => {
    onClose();
    navigate('/admin');
  };

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/auth');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Off-canvas panel - slides from left */}
      <div
        className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col md:hidden transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "rgba(10, 15, 25, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingLeft: "max(0px, env(safe-area-inset-left))",
        }}
      >
        {/* Header — X button has 48px touch target */}
        <div className="flex items-center justify-between px-5 pb-5 border-b border-white/8">
          <span className="text-sm font-semibold text-foreground uppercase tracking-widest opacity-60">Menu</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            style={{ minWidth: 48, minHeight: 48 }}
            aria-label="Chiudi menu"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Language */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Lingua / Language</p>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/8"
            >
              <Globe className="w-4 h-4 text-fgb-accent" />
              <span className="text-sm text-foreground flex-1 text-left">
                {language === 'it' ? 'Italiano' : 'English'}
              </span>
              <span className="text-xs text-muted-foreground bg-white/10 px-2 py-0.5 rounded-full font-medium">
                {language === 'it' ? 'EN →' : 'IT →'}
              </span>
            </button>
          </div>

          {/* Global Filters */}
          {(canChangeHolding || canChangeBrand) && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Filtri Globali</p>
              <div className="space-y-2">
                {canChangeHolding && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Select
                      value={selectedHolding || "all"}
                      onValueChange={(val) => {
                        onHoldingChange?.(val === "all" ? null : val);
                        onBrandChange?.(null);
                      }}
                    >
                      <SelectTrigger className="flex-1 h-7 border-0 bg-transparent text-sm focus:ring-0 px-0 text-foreground">
                        <SelectValue placeholder="Tutti gli Holdings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti gli Holdings</SelectItem>
                        {holdings.map(h => (
                          <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {canChangeBrand && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                    <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Select
                      value={selectedBrand || "all"}
                      onValueChange={(val) => onBrandChange?.(val === "all" ? null : val)}
                    >
                      <SelectTrigger className="flex-1 h-7 border-0 bg-transparent text-sm focus:ring-0 px-0 text-foreground">
                        <SelectValue placeholder="Tutti i Brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti i Brand</SelectItem>
                        {availableBrands.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User settings */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Impostazioni Utente</p>
            <div className="space-y-2">
              {user && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/8">
                  <p className="text-xs text-muted-foreground">Accesso come</p>
                  <p className="text-sm text-foreground font-medium truncate">{user.email}</p>
                </div>
              )}
              <button
                onClick={handleAdminClick}
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/8"
              >
                <Shield className="w-4 h-4 text-fgb-accent" />
                <span className="text-sm text-foreground flex-1 text-left">Admin Panel</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Logout at bottom — safe-area bottom padding */}
        <div
          className="px-5 pt-4 border-t border-white/8"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-destructive/20 transition-colors border border-destructive/20 group"
            style={{ minHeight: 48 }}
          >
            <LogOut className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileBurgerMenu;
