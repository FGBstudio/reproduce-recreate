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
      <div className="w-full lg:w-[480px] flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={brandImg} alt="FGB" className="h-10 w-auto" />
            <span className="text-xl font-semibold text-foreground">FGB Studio</span>
          </div>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Globe className="w-4 h-4" />
            IT
          </button>
        </header>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 py-8">
          <div className="max-w-sm mx-auto w-full">
            {/* Welcome Text */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {mode === "login" ? "Bentornato" : "Benvenuto"}
              </h1>
              {mode === "login" && (
                <p className="text-muted-foreground text-sm">
                  Accedi al tuo account FGB Studio
                </p>
              )}
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                {successMessage}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm text-muted-foreground">
                    Nome e cognome
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <User className="w-5 h-5" />
                    </div>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Mario Rossi"
                      className="pl-11 h-12 bg-muted/50 border-muted-foreground/20 focus:border-primary"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">
                  Email
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Mail className="w-5 h-5" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@azienda.com"
                    className="pl-11 h-12 bg-muted/50 border-muted-foreground/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Lock className="w-5 h-5" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-12 bg-muted/50 border-muted-foreground/20 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
                      Conferma Password
                    </Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Lock className="w-5 h-5" />
                      </div>
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-11 pr-11 h-12 bg-muted/50 border-muted-foreground/20 focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                      Ho letto e accettato le{" "}
                      <a href="#" className="text-primary hover:underline">
                        Condizioni di utilizzo
                      </a>
                    </Label>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base gap-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
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
                <p className="text-sm text-muted-foreground">
                  Non hai un account?{" "}
                  <button
                    onClick={() => { setMode("signup"); setError(null); }}
                    className="text-primary hover:underline font-medium"
                  >
                    Registrati
                  </button>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Hai già un account?{" "}
                  <button
                    onClick={() => { setMode("login"); setError(null); }}
                    className="text-primary hover:underline font-medium"
                  >
                    Accedi
                  </button>
                </p>
              )}
            </div>

            {/* Help Link */}
            <div className="mt-8 text-center">
              <a href="mailto:support@fgb-studio.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Serve aiuto? Contattare l'assistenza
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="p-6 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by FGB Technology
          </p>
        </footer>
      </div>

      {/* Right Panel - Hero Image/Animation */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-background via-muted/30 to-primary/10">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          {/* Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px'
            }}
          />
          
          {/* Floating Orbs */}
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-fgb-accent/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          {/* Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Live Monitoring</span>
          </div>

          {/* Main Text */}
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground text-center mb-6 max-w-lg">
            Il futuro della gestione energetica.
          </h2>
          
          <p className="text-lg text-muted-foreground text-center max-w-md mb-12">
            Ottimizza le prestazioni, riduci gli sprechi e prendi decisioni basate sui dati con la nostra suite analitica.
          </p>

          {/* Feature Icons */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Analytics</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-fgb-accent/10 border border-fgb-accent/20 flex items-center justify-center">
                <Zap className="w-7 h-7 text-fgb-accent" />
              </div>
              <span className="text-xs text-muted-foreground">Energy</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Shield className="w-7 h-7 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground">Security</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
