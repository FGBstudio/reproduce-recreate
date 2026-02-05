import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Check,
  Globe,
  Zap,
  BarChart3,
  Shield
} from "lucide-react";
import brandImg from "@/assets/brand-white.png";

type AuthMode = "login" | "signup";

const Auth = () => {
  const navigate = useNavigate();
  const { login, signup, mockLogin, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!email || !password) {
      setError("Email e password sono obbligatori");
      return;
    }

    if (mode === "signup") {
      if (!displayName) {
        setError("Nome e cognome sono obbligatori");
        return;
      }
      if (password !== confirmPassword) {
        setError("Le password non corrispondono");
        return;
      }
      if (password.length < 6) {
        setError("La password deve essere di almeno 6 caratteri");
        return;
      }
      if (!termsAccepted) {
        setError("Devi accettare le condizioni di utilizzo");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured) {
        // Mock mode - auto login
        mockLogin(email, "viewer");
        navigate("/", { replace: true });
        return;
      }

      if (mode === "login") {
        const { error: loginError } = await login(email, password);
        if (loginError) {
          if (loginError.message.includes("Invalid login credentials")) {
            setError("Credenziali non valide. Verifica email e password.");
          } else {
            setError(loginError.message);
          }
        }
      } else {
        const { error: signupError } = await signup(email, password, { 
          display_name: displayName 
        });
        if (signupError) {
          if (signupError.message.includes("already registered")) {
            setError("Questo indirizzo email è già registrato");
          } else {
            setError(signupError.message);
          }
        } else {
          setSuccessMessage("Registrazione completata! Controlla la tua email per confermare l'account.");
          setMode("login");
        }
      }
    } catch (err: any) {
      setError(err.message || "Errore durante l'autenticazione");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading spinner during initial auth check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Auth Form */}
      <div className="w-full lg:w-[480px] flex flex-col min-h-screen bg-[#006367] text-white">
        {/* Header */}
        <header className="p-6 flex items-center justify-between">
          <div className="flex items-center ml-25">
            <img 
              src={brandImg} 
              alt="FGB" 
              className="h-20 w-auto" 
            />
          </div>
          <button className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors">
            <Globe className="w-4 h-4" />
            IT
          </button>
        </header>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 py-8">
          <div className="max-w-sm mx-auto w-full">
            {/* Welcome Text */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                {mode === "login" ? "Bentornato" : "Benvenuto"}
              </h1>
              {mode === "login" && (
                <p className="text-white/70 text-sm">
                  Accedi al tuo account FGB Studio
                </p>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm backdrop-blur-sm">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-100 text-sm backdrop-blur-sm">
                {successMessage}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm text-white/80">
                    Nome e cognome
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                      <User className="w-5 h-5" />
                    </div>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Mario Rossi"
                      className="pl-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-white/80">
                  Email
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                    <Mail className="w-5 h-5" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@azienda.com"
                    className="pl-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-white/80">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                    <Lock className="w-5 h-5" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm text-white/80">
                      Conferma Password
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                        <Lock className="w-5 h-5" />
                      </div>
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-11 pr-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                      className="mt-0.5 border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#911141]"
                    />
                    <Label htmlFor="terms" className="text-sm text-white/80 cursor-pointer">
                      Ho letto e accettato le{" "}
                      <a href="#" className="text-white hover:underline font-semibold">
                        Condizioni di utilizzo
                      </a>
                    </Label>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-white hover:bg-white/90 text-[#911141] font-bold text-base gap-2 shadow-lg transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-[#911141] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === "login" ? "Accedi" : "Iscriviti a FGB Studio"}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Toggle Mode */}
            <div className="mt-6 text-center">
              {mode === "login" ? (
                <p className="text-sm text-white/70">
                  Non hai un account?{" "}
                  <button
                    onClick={() => { setMode("signup"); setError(null); }}
                    className="text-white hover:underline font-semibold hover:text-white/90"
                  >
                    Registrati
                  </button>
                </p>
              ) : (
                <p className="text-sm text-white/70">
                  Hai già un account?{" "}
                  <button
                    onClick={() => { setMode("login"); setError(null); }}
                    className="text-white hover:underline font-semibold hover:text-white/90"
                  >
                    Accedi
                  </button>
                </p>
              )}
            </div>

            {/* Help Link */}
            <div className="mt-8 text-center">
              <a href="mailto:support@fgb-studio.com" className="text-sm text-white/50 hover:text-white transition-colors">
                Serve aiuto? Contattare l'assistenza
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-6 text-center">
          <p className="text-xs text-white/30">
            Powered by FGB Monitoring
          </p>
        </footer>
      </div>

      {/* Right Panel - Hero Image/Animation */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#006367]">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          
          {/* --- MODIFICA QUI: Pattern Logo --- */}
          <div 
            className="absolute inset-0 opacity-10" 
            style={{
              backgroundImage: "url('/white.png')", // Pesca direttamente da /public/white.png
              backgroundSize: '80px', // Dimensione del logo nel pattern (modifica a piacere)
              backgroundRepeat: 'repeat',
              backgroundPosition: '0 0'
            }}
          />
          
          {/* Floating Orbs (Opzionale: puoi lasciarli per dare profondità o rimuoverli) */}
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          {/* Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8 backdrop-blur-sm">
            <Zap className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">Live Monitoring</span>
          </div>

          {/* Main Text */}
          <h2 className="text-4xl lg:text-5xl font-bold text-white text-center mb-6 max-w-lg">
            Il futuro della gestione energetica.
          </h2>
          
          <p className="text-lg text-white/80 text-center max-w-md mb-12">
            Ottimizza le prestazioni, riduci gli sprechi e prendi decisioni basate sui dati con la nostra suite analitica.
          </p>

          {/* Feature Icons */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs text-white/70">Analytics</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs text-white/70">Energy</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <span className="text-xs text-white/70">Security</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
