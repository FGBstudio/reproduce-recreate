import { User } from "lucide-react";

interface HeaderProps {
  userName?: string;
}

const Header = ({ userName = "Maria Rossi" }: HeaderProps) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-5">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-fgb-light flex items-center justify-center border-2 border-fgb-accent shadow-lg">
          <span className="text-foreground font-bold text-lg">F</span>
        </div>
        <div>
          <span className="text-xl font-bold tracking-wider text-foreground">FGB</span>
          <span className="hidden md:inline text-xs text-muted-foreground ml-2 tracking-widest uppercase">
            IoT Command Center
          </span>
        </div>
      </div>

      {/* User Avatar */}
      <div className="flex items-center gap-3 glass-panel rounded-full px-4 py-2">
        <span className="text-sm font-medium text-foreground hidden md:block">{userName}</span>
        <div className="w-9 h-9 rounded-full bg-fgb-light flex items-center justify-center overflow-hidden border border-white/20">
          <User className="w-5 h-5 text-foreground" />
        </div>
      </div>
    </header>
  );
};

export default Header;
