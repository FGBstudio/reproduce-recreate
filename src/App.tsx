import { Toaster } from "@/components/ui/toaster";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminDataProvider } from "@/contexts/AdminDataContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { WrappedProvider } from "@/components/wrapped/WrappedContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
// Route secondarie caricate on-demand: riducono il bundle iniziale su mobile
const Admin = lazy(() => import("./pages/Admin"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <AdminDataProvider>
          <OnboardingProvider>
          <WrappedProvider>
          <CurrencyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <OnboardingTour />
            <HashRouter>
              <OfflineBanner />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public route - Auth page */}
                <Route path="/auth" element={<Auth />} />
                {/* Public route - PWA install landing */}
                <Route path="/install" element={<Install />} />
                
                {/* Protected routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute requireAdmin>
                    <Admin />
                  </ProtectedRoute>
                } />
                
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </HashRouter>
          </TooltipProvider>
          </CurrencyProvider>
          </WrappedProvider>
          </OnboardingProvider>
        </AdminDataProvider>
      </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
