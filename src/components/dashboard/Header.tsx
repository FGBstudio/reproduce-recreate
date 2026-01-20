import { Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserAccountDropdown } from "./UserAccountDropdown";
import brandImg from "@/assets/brand-white.png";


interface HeaderProps {
  userName?: string;
}

const Header = ({ userName = "Maria Rossi" }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const handleAdminClick = () => {
    if (!user) {
      login('admin@fgb.com', 'admin');
    }
    navigate('/admin');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 md:px-8 py-3 md:py-5">
      {/* Logo */}
      <div className="flex items-center">
        <img
          src={brandImg}
          alt="FGB"
          className="h-8 md:h-10 w-auto"
        />
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
