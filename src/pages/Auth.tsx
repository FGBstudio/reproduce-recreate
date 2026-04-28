import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  User, Lock, Mail, Eye, EyeOff, ArrowRight, ArrowLeft,
  Building2, Briefcase, MessageSquare
} from "lucide-react";
import brandImg from "@/assets/brand-white.png";
import FloatingBentoPanel from "@/components/auth/FloatingBentoPanel";

type AuthMode = "login" | "request" | "update_password";

const Auth = () => {
  const navigate = useNavigate();
  // RADAR: Estratte le nuove variabili dal context
  const { login, isAuthenticated, isLoading: authLoading, isPasswordRecovery, updatePassword } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Update Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Request form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // INTERCETTAZIONE: Forza la UI in modalità aggiornamento se il context segnala il recovery
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode("update_password");
    }
  }, [isPasswordRecovery]);

  // DEVIAZIONE DI ROTTA: Se l'utente è loggato, ma NON è in fase di recupero password, mandalo alla dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading && !isPasswordRecovery && mode !== "update_password") {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, authLoading, isPasswordRecovery, mode, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError(t('auth.email_password_required'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        setError('Supabase non configurato. Impossibile autenticarsi.');
        return;
      }

      const { error: loginError } = await login(email, password);
      if (loginError) {
        setError(loginError.message.includes("Invalid login credentials")
          ? t('auth.invalid_credentials')
          : loginError.message);
      }
    } catch (err: any) {
      setError(err.message || t('auth.auth_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwords_do_not_match') || "Le password non coincidono.");
      return;
    }
    if (newPassword.length < 6) {
      setError("La password deve contenere almeno 6 caratteri.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) throw updateError;

      setSuccessMessage("Password aggiornata con successo! Reindirizzamento in corso...");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Errore durante l'aggiornamento della password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!firstName.trim()) { setError(t('auth.first_name_required')); return; }
    if (!lastName.trim()) { setError(t('auth.last_name_required')); return; }
    if (!email.trim()) { setError(t('auth.email_required')); return; }
    if (!company.trim()) { setError(t('auth.company_required')); return; }
    if (!termsAccepted) { setError(t('auth.terms_required')); return; }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        setSuccessMessage(t('auth.request_sent'));
        return;
      }

      const { error: insertError } = await supabase
        .from('access_requests')
        .insert({
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          company: company.trim(),
          job_title: jobTitle.trim() || null,
          message: requestMessage.trim() || null,
        });

      if (insertError) {
        console.error('Error submitting request:', insertError);
        setError(t('auth.request_error'));
      } else {
        setSuccessMessage(t('auth.request_sent'));
        setFirstName(""); setLastName(""); setEmail(""); setCompany("");
        setJobTitle(""); setRequestMessage(""); setTermsAccepted(false);
      }
    } catch (err: any) {
      setError(err.message || t('auth.request_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const inputClass = "pl-11 h-[clamp(2.5rem,4vh,3rem)] bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all text-[clamp(0.8rem,1.1vw,0.9375rem)]";
  const inputClassNoPad = "h-[clamp(2.5rem,4vh,3rem)] bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all text-[clamp(0.8rem,1.1vw,0.9375rem)]";

  return (
    <div className="min-h-[100dvh] bg-background flex">
      {/* Left Panel - Auth Form */}
      <div className="w-full lg:w-[clamp(360px,35vw,520px)] flex flex-col min-h-[100dvh] bg-[#006367] text-white shrink-0">
        <header className="flex-shrink-0 pt-[max(1.25rem,env(safe-area-inset-top))] pb-1 flex items-center justify-center lg:justify-start lg:pl-[clamp(1rem,2vw,1.5rem)]">
          <img src={brandImg} alt="FGB" className="h-[clamp(2.5rem,5vw,5rem)] w-auto" />
        </header>

        <div className="flex-1 flex flex-col justify-center px-[clamp(1.25rem,4vw,3rem)] py-[clamp(0.5rem,2vh,2rem)] overflow-y-auto">
          <div className="max-w-[420px] mx-auto w-full">
            <div className="mb-[clamp(0.75rem,2vh,1.5rem)]">
              <h1 className="text-[clamp(1.25rem,2.5vw,1.875rem)] font-bold text-white mb-1">
                {mode === "login" ? t('auth.welcome_back') : mode === "update_password" ? "Reimposta Password" : t('auth.request_access')}
              </h1>
              <p className="text-white/70 text-[clamp(0.75rem,1.2vw,0.875rem)]">
                {mode === "login" ? t('auth.login_subtitle') : mode === "update_password" ? "Inserisci la tua nuova password di accesso." : t('auth.request_subtitle')}
              </p>
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

            {mode === "update_password" ? (
              <form onSubmit={handleUpdatePassword} className="space-y-[clamp(0.75rem,1.5vh,1.25rem)]">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm text-white/80">Nuova Password</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Lock className="w-5 h-5" /></div>
                    <Input id="newPassword" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pr-11`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm text-white/80">Conferma Password</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Lock className="w-5 h-5" /></div>
                    <Input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pr-11`} />
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting}
                  className="w-full min-h-[44px] h-[clamp(2.5rem,4vh,3rem)] bg-white hover:bg-white/90 text-[#911141] font-bold text-[clamp(0.8rem,1.1vw,1rem)] gap-2 shadow-lg transition-all active:scale-[0.98] mt-4">
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-[#911141] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Salva nuova password"
                  )}
                </Button>
              </form>
            ) : mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-[clamp(0.75rem,1.5vh,1.25rem)]">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-white/80">{t('auth.email')}</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Mail className="w-5 h-5" /></div>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className={inputClass} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-white/80">{t('auth.password')}</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Lock className="w-5 h-5" /></div>
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pr-11`} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting}
                  className="w-full min-h-[44px] h-[clamp(2.5rem,4vh,3rem)] bg-white hover:bg-white/90 text-[#911141] font-bold text-[clamp(0.8rem,1.1vw,1rem)] gap-2 shadow-lg transition-all active:scale-[0.98]">
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-[#911141] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {t('auth.login')}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRequestAccess} className="space-y-[clamp(0.5rem,1.2vh,1rem)]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-sm text-white/80">{t('auth.first_name')} *</Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><User className="w-4 h-4" /></div>
                      <Input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Mario"
                        className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-sm text-white/80">{t('auth.last_name')} *</Label>
                    <Input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      placeholder="Rossi"
                      className={inputClassNoPad} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reqEmail" className="text-sm text-white/80">{t('auth.email')} *</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Mail className="w-4 h-4" /></div>
                    <Input id="reqEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="text-sm text-white/80">{t('auth.company')} *</Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Building2 className="w-4 h-4" /></div>
                      <Input id="company" type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                        placeholder="Acme Corp"
                        className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="jobTitle" className="text-sm text-white/80">{t('auth.job_title')}</Label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"><Briefcase className="w-4 h-4" /></div>
                      <Input id="jobTitle" type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Energy Manager"
                        className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-sm text-white/80">{t('auth.request_message')}</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-3 text-white/60"><MessageSquare className="w-4 h-4" /></div>
                    <Textarea id="message" value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder={t('auth.request_message_placeholder')}
                      rows={3}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20 transition-all resize-none" />
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

                <Button type="submit" disabled={isSubmitting}
                  className="w-full min-h-[44px] h-[clamp(2.5rem,4vh,3rem)] bg-white hover:bg-white/90 text-[#911141] font-bold text-[clamp(0.8rem,1.1vw,1rem)] gap-2 shadow-lg transition-all active:scale-[0.98]">
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-[#911141] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {t('auth.submit_request')}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </form>
            )}

            <div className="mt-[clamp(0.75rem,1.5vh,1.5rem)] text-center">
              {mode === "login" ? (
                <p className="text-sm text-white/70">
                  {t('auth.no_account')}{" "}
                  <button onClick={() => { setMode("request"); setError(null); setSuccessMessage(null); }}
                    className="text-white hover:underline font-semibold hover:text-white/90">{t('auth.request_access')}</button>
                </p>
              ) : mode === "request" ? (
                <button onClick={() => { setMode("login"); setError(null); setSuccessMessage(null); }}
                  className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mx-auto min-h-[44px]">
                  <ArrowLeft className="w-4 h-4" />
                  {t('auth.back_to_login')}
                </button>
              ) : null}
            </div>

            <div className="mt-[clamp(1rem,2vh,2rem)] text-center">
              <a href="mailto:support@fgb-studio.com" className="text-sm text-white/50 hover:text-white transition-colors">
                {t('auth.need_help')}
              </a>
            </div>
          </div>
        </div>

        <footer className="p-[clamp(0.75rem,1.5vh,1.5rem)] pb-[max(1rem,env(safe-area-inset-bottom))] text-center shrink-0">
          <p className="text-[clamp(0.625rem,0.8vw,0.75rem)] text-white/30">Powered by FGB Monitoring</p>
        </footer>
      </div>

      {/* Right Panel - Floating Bento (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 min-w-0">
        <FloatingBentoPanel />
      </div>
    </div>
  );
};

export default Auth;
