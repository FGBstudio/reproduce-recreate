/**
 * UX 2.0 preview — tab bar mobile (Home · Map · Insights · Menu).
 * v2: vetro come il resto del cromo dashboard, indicatore oro che SCORRE
 * sotto la voce attiva (niente scatti), haptic sul cambio tab come la
 * RegionNav. L'attivo e' oro --fgb-accent, coerente con l'accento del cromo.
 */
import { LayoutGrid, Map, Lightbulb, Menu } from "lucide-react";
import { hapticLight } from "@/lib/native";

export type HomeView = "home" | "map" | "insights";

interface Props {
  view: HomeView;
  onView: (v: HomeView) => void;
  onMenu: () => void;
}

const ITEMS: { key: HomeView | "menu"; label: string; Icon: typeof Map }[] = [
  { key: "home", label: "Home", Icon: LayoutGrid },
  { key: "map", label: "Map", Icon: Map },
  { key: "insights", label: "Insights", Icon: Lightbulb },
  { key: "menu", label: "Menu", Icon: Menu },
];

const FgbTabBar = ({ view, onView, onMenu }: Props) => {
  const activeIdx = ITEMS.findIndex(i => i.key === view);
  return (
    <nav
      className="md:hidden fixed left-0 right-0 bottom-0 z-[46]"
      style={{
        background: "linear-gradient(180deg, rgba(8,18,22,.78), rgba(8,18,22,.92))",
        WebkitBackdropFilter: "blur(20px) saturate(140%)", backdropFilter: "blur(20px) saturate(140%)",
        borderTop: "1px solid rgba(255,255,255,.10)",
        boxShadow: "0 -1px 0 rgba(255,255,255,.06) inset, 0 -18px 40px rgba(0,0,0,.35)",
        paddingBottom: "var(--sab, 0px)",
      }}
    >
      {/* indicatore oro che scorre sotto la voce attiva */}
      <span
        aria-hidden
        className="absolute top-0 h-[2px] rounded-full"
        style={{
          width: "15%",
          left: `${(activeIdx >= 0 ? activeIdx : 0) * 25 + 5}%`,
          background: "#9fd5d9",
          boxShadow: "0 0 12px rgba(0,145,147,.6)",
          transition: "left .35s cubic-bezier(.2,.8,.2,1)",
          opacity: activeIdx >= 0 ? 1 : 0,
        }}
      />
      <div className="flex items-stretch">
        {ITEMS.map(({ key, label, Icon }) => {
          const active = key === view;
          return (
            <button
              key={key}
              onClick={() => { hapticLight(); key === "menu" ? onMenu() : onView(key); }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-300"
              style={{ minHeight: 58, color: active ? "#9fd5d9" : "rgba(255,255,255,.55)" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-5 h-5 transition-transform duration-300" style={{ transform: active ? "translateY(-1px) scale(1.08)" : "none" }} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default FgbTabBar;
