import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import FloatingBentoPanel from "@/components/auth/FloatingBentoPanel";

const Auth = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, isPasswordRecovery } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isPasswordRecovery) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, authLoading, isPasswordRecovery, navigate]);

  useEffect(() => {
    if (isPasswordRecovery) {
      window.dispatchEvent(new CustomEvent("fgb:open-login"));
    }
  }, [isPasswordRecovery]);

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

  return (
    <div className="min-h-[100dvh] w-full">
      <FloatingBentoPanel />
    </div>
  );
};

export default Auth;
