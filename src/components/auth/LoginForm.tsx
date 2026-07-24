import React, { useState, useEffect } from "react";
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
  Building2, Briefcase, MessageSquare,
} from "lucide-react";

type Mode = "login" | "request" | "update_password";
type Theme = "light" | "dark";

const ACCENT = "#006367";

export interface LoginFormProps {
  initialMode?: Mode;
  theme?: Theme;
  onSuccess?: () => void;
  compact?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ initialMode = "login", theme = "light", onSuccess }) => {
  const navigate = useNavigate();
  const { login, isPasswordRecovery, updatePassword } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isPasswordRecovery) setMode("update_password");
  }, [isPasswordRecovery]);

  useEffect(() => {
    const handler = () => {
      setMode("request");
      setError(null);
      setSuccessMessage(null);
    };
    window.addEventListener("fgb:create-account", handler);
    return () => window.removeEventListener("fgb:create-account", handler);
  }, []);

  const isDark = theme === "dark";
  const textPrimary = isDark ? "text-white" : "text-[#1d1d1f]";
  const textMuted = isDark ? "text-white/70" : "text-[#86868b]";
  const inputBase = isDark
    ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white focus:ring-white/20 focus:bg-white/20"
    : "bg-black/[0.04] border-black/[0.08] text-[#1d1d1f] placeholder:text-black/30 focus:border-[#006367] focus:ring-[#006367]/20 focus:bg-white";
  const inputCls = `pl-11 h-12 transition-all text-[14px] ${inputBase}`;
  const inputClsNoPad = `h-12 transition-all text-[14px] ${inputBase}`;
  const iconCls = isDark ? "text-white/60" : "text-black/40";
  const btnCls = isDark
    ? "w-full min-h-[44px] h-12 bg-white hover:bg-white/90 text-[#006367] font-bold text-[15px] gap-2 shadow-lg transition-all active:scale-[0.98]"
    : "w-full min-h-[44px] h-12 text-white font-bold text-[15px] gap-2 shadow-lg transition-all active:scale-[0.98]";
  const btnStyle = isDark ? undefined : { background: ACCENT };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccessMessage(null);
    if (!email || !password) { setError(t("auth.email_password_required")); return; }
    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) { setError("Supabase non configurato."); return; }
      const { error: loginError } = await login(email, password);
      if (loginError) {
        setError(loginError.message.includes("Invalid login credentials")
          ? t("auth.invalid_credentials")
          : loginError.message);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err.message || t("auth.auth_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccessMessage(null);
    if (newPassword !== confirmPassword) { setError(t("auth.passwords_do_not_match") || "Le password non coincidono."); return; }
    if (newPassword.length < 6) { setError("La password deve contenere almeno 6 caratteri."); return; }
    setIsSubmitting(true);
    try {
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) throw updateError;
      setSuccessMessage("Password aggiornata. Reindirizzamento...");
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err: any) {
      setError(err.message || "Errore aggiornamento password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccessMessage(null);
    if (!firstName.trim()) { setError(t("auth.first_name_required")); return; }
    if (!lastName.trim()) { setError(t("auth.last_name_required")); return; }
    if (!email.trim()) { setError(t("auth.email_required")); return; }
    if (!company.trim()) { setError(t("auth.company_required")); return; }
    if (!termsAccepted) { setError(t("auth.terms_required")); return; }

    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) { setSuccessMessage(t("auth.request_sent")); return; }
      const { error: insertError } = await supabase
        .from("access_requests")
        .insert({
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          company: company.trim(),
          job_title: jobTitle.trim() || null,
          message: requestMessage.trim() || null,
        });
      if (insertError) {
        setError(t("auth.request_error"));
      } else {
        setSuccessMessage(t("auth.request_sent"));
        setFirstName(""); setLastName(""); setEmail(""); setCompany("");
        setJobTitle(""); setRequestMessage(""); setTermsAccepted(false);
      }
    } catch (err: any) {
      setError(err.message || t("auth.request_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full ${textPrimary}`}>
      <div className="mb-5">
        <h2 className="text-[22px] font-semibold tracking-tight">
          {mode === "login" ? t("auth.welcome_back") : mode === "update_password" ? "Reimposta Password" : t("auth.request_access")}
        </h2>
        <p className={`text-[13px] mt-1 ${textMuted}`}>
          {mode === "login" ? t("auth.login_subtitle") : mode === "update_password" ? "Imposta la tua nuova password." : t("auth.request_subtitle")}
        </p>
      </div>

      {error && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${isDark ? "bg-white/10 border border-white/20 text-white" : "bg-red-50 border border-red-200 text-red-700"}`}>{error}</div>
      )}
      {successMessage && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${isDark ? "bg-emerald-500/20 border border-emerald-400/30 text-emerald-50" : "bg-emerald-50 border border-emerald-200 text-emerald-800"}`}>{successMessage}</div>
      )}

      {mode === "update_password" ? (
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div className="space-y-2">
            <Label className={`text-sm ${textMuted}`}>Nuova Password</Label>
            <div className="relative">
              <Lock className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
              <Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pr-11`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${iconCls}`}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className={`text-sm ${textMuted}`}>Conferma Password</Label>
            <div className="relative">
              <Lock className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
              <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className={btnCls} style={btnStyle}>
            {isSubmitting ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : "Salva nuova password"}
          </Button>
        </form>
      ) : mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label className={`text-sm ${textMuted}`}>{t("auth.email")}</Label>
            <div className="relative">
              <Mail className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={inputCls} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className={`text-sm ${textMuted}`}>{t("auth.password")}</Label>
            <div className="relative">
              <Lock className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
              <Input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`${inputCls} pr-11`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${iconCls}`}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className={btnCls} style={btnStyle}>
            {isSubmitting ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (<>{t("auth.login")}<ArrowRight className="w-5 h-5" /></>)}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRequest} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={`text-sm ${textMuted}`}>{t("auth.first_name")} *</Label>
              <div className="relative">
                <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Mario" className={`pl-10 ${inputClsNoPad}`} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={`text-sm ${textMuted}`}>{t("auth.last_name")} *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Rossi" className={inputClsNoPad} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={`text-sm ${textMuted}`}>{t("auth.email")} *</Label>
            <div className="relative">
              <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={`pl-10 ${inputClsNoPad}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={`text-sm ${textMuted}`}>{t("auth.company")} *</Label>
              <div className="relative">
                <Building2 className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
                <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" className={`pl-10 ${inputClsNoPad}`} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={`text-sm ${textMuted}`}>{t("auth.job_title")}</Label>
              <div className="relative">
                <Briefcase className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${iconCls}`} />
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Energy Manager" className={`pl-10 ${inputClsNoPad}`} />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={`text-sm ${textMuted}`}>{t("auth.request_message")}</Label>
            <div className="relative">
              <MessageSquare className={`w-4 h-4 absolute left-3 top-3 ${iconCls}`} />
              <Textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder={t("auth.request_message_placeholder")} rows={3} className={`pl-10 resize-none ${inputBase}`} />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c as boolean)} className={isDark ? "mt-0.5 border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#006367]" : "mt-0.5"} />
            <Label htmlFor="terms" className={`text-sm cursor-pointer ${textMuted}`}>
              {t("auth.terms_accept")} <a href="#" className={isDark ? "underline text-white" : "underline"} style={isDark ? undefined : { color: ACCENT }}>{t("auth.terms_link")}</a>
            </Label>
          </div>
          <Button type="submit" disabled={isSubmitting} className={btnCls} style={btnStyle}>
            {isSubmitting ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (<>{t("auth.submit_request")}<ArrowRight className="w-5 h-5" /></>)}
          </Button>
        </form>
      )}

      <div className="mt-5 text-center">
        {mode === "login" ? (
          <p className={`text-sm ${textMuted}`}>
            {t("auth.no_account")}{" "}
            <button type="button" onClick={() => { setMode("request"); setError(null); setSuccessMessage(null); }} className="font-semibold underline" style={{ color: isDark ? "#fff" : ACCENT }}>
              {t("auth.request_access")}
            </button>
          </p>
        ) : mode === "request" ? (
          <button type="button" onClick={() => { setMode("login"); setError(null); setSuccessMessage(null); }} className={`inline-flex items-center gap-1.5 text-sm ${textMuted}`}>
            <ArrowLeft className="w-4 h-4" /> {t("auth.back_to_login")}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default LoginForm;