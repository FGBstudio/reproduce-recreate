import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, Lock, Mail, Eye, EyeOff, ArrowRight,
  Globe, Zap, BarChart3, Shield
} from "lucide-react";
import brandImg from "@/assets/brand-white.png";

type AuthMode = "login" | "signup";

const Auth = () => {
  const navigate = useNavigate();
  const { login, signup, mockLogin, isAuthenticated, isLoading: authLoading } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  
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

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError(t('auth.email_password_required'));
      return;
    }

    if (mode === "signup") {
      if (!displayName) { setError(t('auth.name_required')); return; }
      if (password !== confirmPassword) { setError(t('auth.passwords_mismatch')); return; }
      if (password.length < 6) { setError(t('auth.password_min')); return; }
      if (!termsAccepted) { setError(t('auth.terms_required')); return; }
    }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        mockLogin(email, "viewer");
        navigate("/", { replace: true });
        return;
      }

      if (mode === "login") {
        const { error: loginError } = await login(email, password);
        if (loginError) {
          setError(loginError.message.includes("Invalid login credentials")
            ? t('auth.invalid_credentials')
            : loginError.message);
        }
      } else {
        const { error: signupError } = await signup(email, password, { display_name: displayName });
        if (signupError) {
          setError(signupError.message.includes("already registered")
            ? t('auth.already_registered')
            : signupError.message);
        } else {
          setSuccessMessage(t('auth.signup_success'));
          setMode("login");
        }
      }
    } catch (err: any) {
      setError(err.message || t('auth.auth_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Auth Form */}
      <div className="w-full lg:w-[480px] flex flex-col min-h-screen bg-[#006367] text-white">
        <header className="p-6 flex items-center justify-between">
          <div className="flex items-center ml-28">
            <img src={brandImg} alt="FGB" className="h-20 w-auto" />
          </div>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <Globe className="w-4 h-4" />
            {language.toUpperCase()}
          </button>
        </header>

        <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 py-8">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                {mode === "login" ? t('auth.welcome_back') : t('auth.welcome')}
              </h1>
              {mode === "login" && (
                <p className="text-white/70 text-sm">{t('auth.login_subtitle')}</p>
              )}
            </div>

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

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm text-white/80">{t('auth.full_name')}</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><User className="w-5 h-5" /></div>
                    <Input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Mario Rossi"
                      className="pl-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-white/80">{t('auth.email')}</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Mail className="w-5 h-5" /></div>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="pl-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-white/80">{t('auth.password')}</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Lock className="w-5 h-5" /></div>
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm text-white/80">{t('auth.confirm_password')}</Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Lock className="w-5 h-5" /></div>
                      <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-11 pr-11 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors">
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                      className="mt-0.5 border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#911141]" />
                    <Label htmlFor="terms" className="text-sm text-white/80 cursor-pointer">
                      {t('auth.terms_accept')}{" "}
                      <a href="#" className="text-white hover:underline font-semibold">{t('auth.terms_link')}</a>
                    </Label>
                  </div>
                </>
              )}

              <Button type="submit" disabled={isSubmitting}
                className="w-full h-12 bg-white hover:bg-white/90 text-[#911141] font-bold text-base gap-2 shadow-lg transition-all active:scale-[0.98]">
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-[#911141] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === "login" ? t('auth.login') : t('auth.signup')}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              {mode === "login" ? (
                <p className="text-sm text-white/70">
                  {t('auth.no_account')}{" "}
                  <button onClick={() => { setMode("signup"); setError(null); }}
                    className="text-white hover:underline font-semibold hover:text-white/90">{t('auth.register')}</button>
                </p>
              ) : (
                <p className="text-sm text-white/70">
                  {t('auth.has_account')}{" "}
                  <button onClick={() => { setMode("login"); setError(null); }}
                    className="text-white hover:underline font-semibold hover:text-white/90">{t('auth.login')}</button>
                </p>
              )}
            </div>

            <div className="mt-8 text-center">
              <a href="mailto:support@fgb-studio.com" className="text-sm text-white/50 hover:text-white transition-colors">
                {t('auth.need_help')}
              </a>
            </div>
          </div>
        </div>

        <footer className="p-6 text-center">
          <p className="text-xs text-white/30">Powered by FGB Monitoring</p>
        </footer>
      </div>

      {/* Right Panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#006367]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "url('/white.png')",
            backgroundSize: '80px',
            backgroundRepeat: 'repeat',
            backgroundPosition: '0 0'
          }} />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8 backdrop-blur-sm">
            <Zap className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">Live Monitoring</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold text-white text-center mb-6 max-w-lg">
            {t('auth.hero_title')}
          </h2>
          
          <p className="text-lg text-white/80 text-center max-w-md mb-12">
            {t('auth.hero_subtitle')}
          </p>

          <div className="flex items-center gap-6">
            {[{ icon: BarChart3, label: 'Analytics' }, { icon: Zap, label: 'Energy' }, { icon: Shield, label: 'Security' }].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
