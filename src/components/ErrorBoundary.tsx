import React from "react";

/**
 * Error boundary di ultima istanza. Nel WebView nativo (Capacitor) un throw
 * non gestito lascia uno schermo bianco permanente senza barra URL: l'unica
 * via d'uscita dell'utente sarebbe uccidere l'app. Qui si offre un reload.
 * Testi volutamente statici (inglese): se il crash è nel LanguageProvider,
 * t() non esiste più.
 */
interface State { hasError: boolean }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // console.error sopravvive allo strip di produzione (solo log/debug vengono rimossi)
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
        background: "#f6f6f5", color: "#3f4649", padding: 24, textAlign: "center",
        fontFamily: '"Futura","Century Gothic",system-ui,sans-serif',
      }}>
        <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Something went wrong</p>
        <p style={{ fontSize: 14, color: "#7c8285", margin: 0, maxWidth: 320 }}>
          An unexpected error occurred. Reload the app to continue.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: "12px 28px", minHeight: 44, borderRadius: 999,
            border: "none", background: "#016368", color: "#fff",
            fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
