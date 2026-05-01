import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Apple, Smartphone, Share2, PlusSquare, Download, Check, ArrowLeft } from "lucide-react";

/**
 * Public install landing page (`/install`).
 * Detects platform (iOS vs Android vs desktop) and provides the right
 * "Add to Home Screen" flow. Designed in the FGB glassmorphism style:
 * navy background, gold accent, Futura typography, frosted cards.
 */

type Platform = "ios" | "android" | "desktop";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
};

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

const Install = () => {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col text-foreground"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, hsl(188 100% 19% / 0.6), transparent 50%), radial-gradient(circle at 80% 100%, hsl(43 41% 57% / 0.15), transparent 50%), hsl(var(--background))",
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          style={{ minHeight: 48 }}
        >
          <ArrowLeft className="w-4 h-4" />
          Indietro
        </button>
        <span className="text-xs uppercase tracking-[0.25em] text-fgb-accent/80">
          FGB · Install
        </span>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full flex flex-col gap-6">
        {/* Hero */}
        <section className="text-center space-y-3 mb-2">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mx-auto"
            style={{
              background:
                "linear-gradient(135deg, hsl(188 100% 19%), hsl(200 100% 11%))",
              border: "1px solid hsl(43 41% 57% / 0.4)",
              boxShadow: "0 8px 32px hsl(43 41% 57% / 0.15)",
            }}
          >
            <img
              src="/pwa-192x192.png"
              alt="FGB"
              className="w-14 h-14 rounded-2xl"
              width={56}
              height={56}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Installa FGB Monitoring
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Aggiungi l'app alla schermata Home del tuo dispositivo per
            un'esperienza nativa, accesso rapido e funzionamento in modalità
            standalone.
          </p>
        </section>

        {/* Already installed */}
        {installed && (
          <div
            className="glass-card p-5 flex items-center gap-3"
            style={{ borderColor: "hsl(160 84% 39% / 0.3)" }}
          >
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">App già installata</p>
              <p className="text-xs text-muted-foreground">
                Stai utilizzando FGB Monitoring in modalità standalone.
              </p>
            </div>
          </div>
        )}

        {/* iOS instructions */}
        {!installed && platform === "ios" && (
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Apple className="w-5 h-5 text-fgb-accent" />
              <h2 className="text-base font-semibold">iPhone / iPad — Safari</h2>
            </div>
            <ol className="space-y-3 text-sm">
              <Step
                index={1}
                icon={<Share2 className="w-4 h-4" />}
                title="Tocca il pulsante Condividi"
                desc="In basso al centro nella barra di Safari."
              />
              <Step
                index={2}
                icon={<PlusSquare className="w-4 h-4" />}
                title="Aggiungi a Home"
                desc='Scorri e tocca "Aggiungi a Home" / "Add to Home Screen".'
              />
              <Step
                index={3}
                icon={<Check className="w-4 h-4" />}
                title="Conferma"
                desc={'Tocca "Aggiungi" in alto a destra. L\'icona FGB apparirà sulla Home.'}
              />
            </ol>
            <p className="text-xs text-muted-foreground italic">
              Nota: l'installazione su iOS funziona solo da Safari, non da
              Chrome o altri browser.
            </p>
          </section>
        )}

        {/* Android instructions */}
        {!installed && platform === "android" && (
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-fgb-accent" />
              <h2 className="text-base font-semibold">Android — Chrome</h2>
            </div>

            {deferredPrompt ? (
              <button
                onClick={handleNativeInstall}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium transition-transform active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(43 41% 57%), hsl(43 41% 47%))",
                  color: "hsl(200 100% 11%)",
                  boxShadow: "0 8px 24px hsl(43 41% 57% / 0.3)",
                  minHeight: 48,
                }}
              >
                <Download className="w-4 h-4" />
                Installa adesso
              </button>
            ) : (
              <ol className="space-y-3 text-sm">
                <Step
                  index={1}
                  icon={<Smartphone className="w-4 h-4" />}
                  title="Apri il menu del browser"
                  desc="Tocca i tre puntini in alto a destra in Chrome."
                />
                <Step
                  index={2}
                  icon={<Download className="w-4 h-4" />}
                  title='Scegli "Installa app"'
                  desc='In alternativa "Aggiungi a schermata Home".'
                />
                <Step
                  index={3}
                  icon={<Check className="w-4 h-4" />}
                  title="Conferma"
                  desc="L'icona FGB apparirà tra le tue app."
                />
              </ol>
            )}
          </section>
        )}

        {/* Desktop fallback */}
        {!installed && platform === "desktop" && (
          <section className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-fgb-accent" />
              <h2 className="text-base font-semibold">Desktop</h2>
            </div>
            {deferredPrompt ? (
              <button
                onClick={handleNativeInstall}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium transition-transform active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(43 41% 57%), hsl(43 41% 47%))",
                  color: "hsl(200 100% 11%)",
                  minHeight: 48,
                }}
              >
                <Download className="w-4 h-4" />
                Installa app
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Apri questa pagina dal tuo telefono per installare l'app.
                Su Chrome desktop puoi anche cliccare l'icona di installazione
                nella barra degli indirizzi.
              </p>
            )}
          </section>
        )}

        {/* Native app footer */}
        <section
          className="glass-card p-5 mt-2"
          style={{ borderColor: "hsl(43 41% 57% / 0.15)" }}
        >
          <p className="text-xs uppercase tracking-widest text-fgb-accent/80 mb-2">
            App Nativa
          </p>
          <p className="text-sm text-muted-foreground">
            È disponibile anche una versione nativa per App Store e Google
            Play. Contatta l'amministratore per ricevere il link di download.
          </p>
        </section>
      </main>
    </div>
  );
};

const Step = ({
  index,
  icon,
  title,
  desc,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <li className="flex items-start gap-3">
    <span
      className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0"
      style={{
        background: "hsl(43 41% 57% / 0.15)",
        color: "hsl(43 41% 67%)",
        border: "1px solid hsl(43 41% 57% / 0.3)",
      }}
    >
      {index}
    </span>
    <div className="flex-1">
      <p className="font-medium flex items-center gap-2">
        <span className="text-fgb-accent">{icon}</span>
        {title}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  </li>
);

export default Install;