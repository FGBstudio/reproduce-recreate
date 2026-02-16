import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Language = 'en' | 'it';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // Auth page
  'auth.welcome_back': { en: 'Welcome back', it: 'Bentornato' },
  'auth.welcome': { en: 'Welcome', it: 'Benvenuto' },
  'auth.login_subtitle': { en: 'Sign in to your FGB Studio account', it: 'Accedi al tuo account FGB Studio' },
  'auth.email': { en: 'Email', it: 'Email' },
  'auth.password': { en: 'Password', it: 'Password' },
  'auth.confirm_password': { en: 'Confirm Password', it: 'Conferma Password' },
  'auth.full_name': { en: 'Full name', it: 'Nome e cognome' },
  'auth.login': { en: 'Sign In', it: 'Accedi' },
  'auth.signup': { en: 'Sign Up for FGB Studio', it: 'Iscriviti a FGB Studio' },
  'auth.no_account': { en: "Don't have an account?", it: 'Non hai un account?' },
  'auth.has_account': { en: 'Already have an account?', it: 'Hai già un account?' },
  'auth.register': { en: 'Register', it: 'Registrati' },
  'auth.need_help': { en: 'Need help? Contact support', it: "Serve aiuto? Contattare l'assistenza" },
  'auth.terms_accept': { en: 'I have read and accepted the', it: 'Ho letto e accettato le' },
  'auth.terms_link': { en: 'Terms of Service', it: 'Condizioni di utilizzo' },
  'auth.email_password_required': { en: 'Email and password are required', it: 'Email e password sono obbligatori' },
  'auth.name_required': { en: 'Full name is required', it: 'Nome e cognome sono obbligatori' },
  'auth.passwords_mismatch': { en: 'Passwords do not match', it: 'Le password non corrispondono' },
  'auth.password_min': { en: 'Password must be at least 6 characters', it: 'La password deve essere di almeno 6 caratteri' },
  'auth.terms_required': { en: 'You must accept the terms of service', it: 'Devi accettare le condizioni di utilizzo' },
  'auth.invalid_credentials': { en: 'Invalid credentials. Check your email and password.', it: 'Credenziali non valide. Verifica email e password.' },
  'auth.already_registered': { en: 'This email is already registered', it: 'Questo indirizzo email è già registrato' },
  'auth.signup_success': { en: 'Registration complete! Check your email to confirm your account.', it: "Registrazione completata! Controlla la tua email per confermare l'account." },
  'auth.auth_error': { en: 'Authentication error', it: "Errore durante l'autenticazione" },
  'auth.hero_title': { en: 'The future of energy management.', it: 'Il futuro della gestione energetica.' },
  'auth.hero_subtitle': { en: 'Optimize performance, reduce waste, and make data-driven decisions with our analytics suite.', it: 'Ottimizza le prestazioni, riduci gli sprechi e prendi decisioni basate sui dati con la nostra suite analitica.' },

  // Loading
  'common.loading': { en: 'Loading...', it: 'Caricamento...' },

  // Header
  'header.search_placeholder': { en: 'Search projects, sites, brands...', it: 'Cerca progetti, siti, brand...' },
  'header.no_results': { en: 'No projects found', it: 'Nessun progetto trovato' },
  'header.search_projects': { en: 'Search projects', it: 'Cerca progetti' },

  // Overview
  'overview.active_alerts': { en: 'Active Alerts', it: 'Alert Attivi' },
  'overview.disabled': { en: 'Disabled', it: 'Disabilitato' },
  'overview.current_consumption': { en: 'Current Consumption', it: 'Consumo Attuale' },
  'overview.latest_readings': { en: 'Latest Readings', it: 'Ultime Rilevazioni' },
  'overview.stale_data': { en: 'Stale data (> 2 days)', it: 'Dati non aggiornati (> 2 giorni)' },
  'overview.humidity': { en: 'Humidity', it: 'Umidità' },

  // Energy
  'energy.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato' },
  'energy.efficiency': { en: 'Efficiency', it: 'Efficienza' },
  'energy.anomalies': { en: 'anomalies', it: 'anomalie' },
  'energy.attention': { en: '⚠ Attention', it: '⚠ Attenzione' },
  'energy.no_data_year': { en: 'No data available for', it: 'Nessun dato disponibile per il' },
  'energy.consumption_price': { en: 'Consumption ×', it: 'Consumo ×' },
  'energy.price_not_configured': { en: 'Energy price not configured', it: 'Prezzo energia non configurato' },
  'energy.heatmap_consumption': { en: 'Energy Consumption Heatmap', it: 'Heatmap Consumi Energetici' },

  // Air
  'air.pm25_fine': { en: 'PM2.5 - Fine Particulate', it: 'PM2.5 - Particolato Fine' },
  'air.pm10_coarse': { en: 'PM10 - Coarse Particulate', it: 'PM10 - Particolato Grossolano' },
  'air.co_title': { en: 'CO - Carbon Monoxide', it: 'CO - Monossido di Carbonio' },
  'air.o3_title': { en: 'O₃ - Ozone', it: 'O₃ - Ozono' },
  'air.co_o3_title': { en: 'Carbon Monoxide (CO) & Ozone (O₃)', it: 'Monossido di Carbonio (CO) & Ozono (O₃)' },
  'air.daily_trend': { en: 'Daily trend', it: 'Trend giornaliero' },
  'air.temp_humidity': { en: 'Temperature & Relative Humidity', it: 'Temperatura & Umidità Relativa' },
  'air.who_limit': { en: 'WHO Limit', it: 'Limite OMS' },
  'air.safety_limit': { en: 'Safety limit', it: 'Limite sicurezza' },
  'air.limit': { en: 'Limit', it: 'Limite' },
  'air.quality_excellent': { en: 'Excellent', it: 'Ottimo' },
  'air.quality_moderate': { en: 'Moderate', it: 'Moderato' },
  'air.quality_poor': { en: 'Poor', it: 'Scarso' },

  // Water
  'water.consumption': { en: 'Water Consumption', it: 'Consumo Idrico' },
  'water.current_consumption': { en: 'Current Consumption', it: 'Consumo Attuale' },
  'water.previous_year': { en: 'Previous Year', it: 'Anno Precedente' },
  'water.distribution': { en: 'Consumption Distribution', it: 'Distribuzione Consumo' },
  'water.total_consumption': { en: 'Total Consumption', it: 'Consumo Totale' },
  'water.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato' },
  'water.efficiency': { en: 'Efficiency', it: 'Efficienza' },
  'water.efficient_use': { en: 'efficient use', it: 'utilizzo efficiente' },
  'water.vs_last_month': { en: '↑ 5% vs last month', it: '↑ 5% vs mese scorso' },
  'water.vs_last_year': { en: '↓ 12% vs last year', it: '↓ 12% vs anno scorso' },
  'water.saved': { en: 'saved', it: 'risparmiati' },
  'water.leaks_detected': { en: 'Leaks Detected', it: 'Perdite Rilevate' },
  'water.zones_anomalies': { en: 'zones with anomalies', it: 'zone con anomalie' },
  'water.requires_attention': { en: '⚠ Requires attention', it: '⚠ Richiede attenzione' },
  'water.leak_detection': { en: 'Leak Detection', it: 'Rilevamento Perdite' },
  'water.critical_zones': { en: 'Critical zones monitoring', it: 'Monitoraggio zone critiche' },
  'water.no_anomaly': { en: 'No anomaly', it: 'Nessuna anomalia' },
  'water.detected': { en: 'Detected', it: 'Rilevato' },
  'water.leak_rate': { en: 'leak rate', it: 'tasso perdita' },
  'water.daily_trend': { en: 'Daily Consumption Trend', it: 'Trend Consumo Giornaliero' },
  'water.peaks_hourly': { en: 'Peaks and hourly consumption', it: 'Picchi e consumi orari' },
  'water.weekly_efficiency': { en: 'Weekly Efficiency', it: 'Efficienza Settimanale' },
  'water.usage_waste_ratio': { en: 'Usage/waste ratio', it: 'Rapporto utilizzo/spreco' },
  'water.waste': { en: 'Waste', it: 'Spreco' },
  'water.quality_params': { en: 'Water Quality Parameters', it: 'Parametri Qualità Acqua' },
  'water.quality_subtitle': { en: 'pH, Turbidity, Residual Chlorine', it: 'pH, Torbidità, Cloro residuo' },
  'water.ph_acidity': { en: 'pH - Acidity', it: 'pH - Acidità' },
  'water.current_value': { en: 'current value', it: 'valore attuale' },
  'water.optimal_range': { en: 'Optimal range', it: 'Range ottimale' },
  'water.optimal': { en: 'Optimal', it: 'Ottimale' },
  'water.acidic': { en: 'Acidic (6)', it: 'Acido (6)' },
  'water.neutral': { en: 'Neutral (7)', it: 'Neutro (7)' },
  'water.basic': { en: 'Basic (9)', it: 'Basico (9)' },
  'water.turbidity': { en: 'Turbidity', it: 'Torbidità' },
  'water.current_ntu': { en: 'NTU (current)', it: 'NTU (attuale)' },
  'water.excellent': { en: 'Excellent', it: 'Eccellente' },
  'water.residual_chlorine': { en: 'Residual Chlorine', it: 'Cloro Residuo' },
  'water.current_mgl': { en: 'mg/L (current)', it: 'mg/L (attuale)' },
  'water.ideal_range': { en: 'Ideal range', it: 'Range ideale' },
  'water.in_range': { en: 'In range', it: 'Nel range' },
  'water.temperature': { en: 'Water Temperature', it: 'Temperatura Acqua' },
  'water.current_temp': { en: '°C (current)', it: '°C (attuale)' },
  'water.comfort_range': { en: 'Comfort range', it: 'Range comfort' },
  'water.ideal': { en: 'Ideal', it: 'Ideale' },

  // Certification
  'cert.active_certs': { en: 'Active Certifications', it: 'Certificazioni Attive' },
  'cert.milestones_reached': { en: 'Milestones Reached', it: 'Milestones Raggiunte' },
  'cert.in_progress': { en: 'In Progress', it: 'In Corso' },
  'cert.next_audit': { en: 'Next Audit', it: 'Prossimo Audit' },
  'cert.certified_since': { en: 'Certified since 2023', it: 'Certificato dal 2023' },
  'cert.renewal': { en: 'Renewal: Dec 2025', it: 'Rinnovo: Dic 2025' },
  'cert.points_obtained': { en: 'Points obtained', it: 'Punti ottenuti' },
  'cert.points': { en: 'points', it: 'punti' },
  'cert.towards': { en: 'Progressing towards', it: 'In corso verso' },

  // Heatmap
  'heatmap.title': { en: 'Consumption Heatmap', it: 'Heatmap Consumi' },

  // Dashboard nav
  'nav.overview': { en: 'Overview', it: 'Panoramica' },
  'nav.energy': { en: 'Energy', it: 'Energia' },
  'nav.air': { en: 'Air', it: 'Aria' },
  'nav.water': { en: 'Water', it: 'Acqua' },
  'nav.certifications': { en: 'Certifications', it: 'Certificazioni' },

  // Modules
  'module.activate_to_view': { en: 'Activate the module to view data', it: 'Attiva il modulo per visualizzare i dati' },
  'module.data_available': { en: 'Telemetry data will be available after activation', it: 'I dati di telemetria saranno disponibili dopo l\'attivazione' },
  'module.demo_data_notice': { en: 'The displayed data is illustrative and does not represent real values. Activate the module to view actual telemetry data.', it: 'I dati visualizzati sono esemplificativi e non rappresentano valori reali. Attiva il modulo per visualizzare i dati di telemetria effettivi.' },

  // Admin
  'admin.search_hierarchy': { en: 'Search hierarchy...', it: 'Cerca nella gerarchia...' },
  'admin.no_project': { en: 'No project', it: 'Nessun progetto' },
  'admin.no_site': { en: 'No site', it: 'Nessun site' },
  'admin.no_brand': { en: 'No brand', it: 'Nessun brand' },
  'admin.no_result': { en: 'No result found', it: 'Nessun risultato trovato' },
  'admin.no_holding': { en: 'No holding present', it: 'Nessuna holding presente' },
  'admin.search_user': { en: 'Search user...', it: 'Cerca utente...' },

  // Diagnosis
  'diagnosis.generating': { en: 'Generating AI diagnosis...', it: 'Generazione diagnosi AI...' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('fgb-language');
    return (stored === 'it' ? 'it' : 'en') as Language;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('fgb-language', lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'it' : 'en');
  }, [language, setLanguage]);

  const t = useCallback((key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry['en'] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};
