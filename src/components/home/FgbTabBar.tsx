/**
 * UX 2.0 preview — tab bar mobile persistente (Home · Map · Insights · Menu).
 * Sostituisce la navigazione "tutta dentro la mappa": la Home e' il punto
 * d'ingresso obbligatorio per ogni ruolo, la mappa diventa esplorazione.
 */
import { LayoutGrid, Map, Lightbulb, Menu } from "lucide-react";

export type HomeView = "home" | "map" | "insights";

interface Props {
  view: HomeView;
  onView: (v: HomeView) => void;
  onMenu: () => void;
}

const FgbTabBar = ({ view, onView, onMenu }: Props) => {
  const items: { key: HomeView | "menu"; label: string; icon: JSX.Element }[] = [
    { key: "home", label: "Home", icon: <LayoutGrid className="w-5 h-5" /> },
    { key: "map", label: "Map", icon: <Map className="w-5 h-5" /> },
    { key: "insights", label: "Insights", icon: <Lightbulb className="w-5 h-5" /> },
    { key: "menu", label: "Menu", icon: <Menu className="w-5 h-5" /> },
  ];
  return (
    <nav
      className="md:hidden fixed left-0 right-0 bottom-0 z-[46] flex items-stretch"
      style={{
        background: "rgba(8,20,24,.92)",
        WebkitBackdropFilter: "blur(18px)", backdropFilter: "blur(18px)",
        borderTop: "1px solid rgba(255,255,255,.10)",
        paddingBottom: "var(--sab, 0px)",
      }}
    >
      {items.map(it => {
        const active = it.key === view;
        return (
          <button
            key={it.key}
            onClick={() => (it.key === "menu" ? onMenu() : onView(it.key))}
            className="flex-1 flex flex-col items-center justify-center gap-0.5"
            style={{ minHeight: 58, color: active ? "#9fd5d9" : "rgba(255,255,255,.55)" }}
            aria-current={active ? "page" : undefined}
          >
            {it.icon}
            <span className="text-[10px] font-semibold tracking-wide">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default FgbTabBar;
