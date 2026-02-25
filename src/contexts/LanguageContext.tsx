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

  // Brand/Holding Overlay
  'brand.brand_overview': { en: 'Client Overview', it: 'Client Overview' },
  'brand.holding_overview': { en: 'Group Overview', it: 'Group Overview' },
  'brand.data_available': { en: 'Data available', it: 'Dati disponibili' },
  'brand.no_data': { en: 'No data', it: 'Nessun dato' },
  'brand.sites_online': { en: 'Sites Online', it: 'Siti Online' },
  'brand.kwh_7d': { en: 'kWh (7d)', it: 'kWh (7gg)' },
  'brand.active_alerts': { en: 'Active Alerts', it: 'Alert Attivi' },
  'brand.hide_charts': { en: 'Hide Charts', it: 'Nascondi Grafici' },
  'brand.show_charts': { en: 'Show Charts', it: 'Mostra Grafici' },
  'brand.no_active_modules': { en: 'No sites with active modules and available data', it: 'Nessun sito con moduli attivi e dati disponibili' },
  'brand.energy_consumption': { en: 'Energy Consumption (kWh, 7d)', it: 'Energy Consumption (kWh, 7gg)' },
  'brand.air_quality': { en: 'Air Quality (CO₂ ppm)', it: 'Air Quality (CO₂ ppm)' },
  'brand.performance_comparison': { en: 'Performance Comparison', it: 'Confronto Prestazioni' },
  'brand.consumption_breakdown': { en: 'Consumption Breakdown', it: 'Distribuzione Consumi' },

  // User Account Dropdown
  'account.company': { en: 'Company', it: 'Azienda' },
  'account.system_role': { en: 'System Role', it: 'Ruolo Sistema' },
  'account.edit_profile': { en: 'Edit Profile', it: 'Modifica Profilo' },
  'account.logout': { en: 'Log out', it: 'Esci' },
  'account.click_upload': { en: 'Click to upload an image', it: "Clicca per caricare un'immagine" },
  'account.first_name': { en: 'First Name', it: 'Nome' },
  'account.last_name': { en: 'Last Name', it: 'Cognome' },
  'account.role': { en: 'Role', it: 'Ruolo' },
  'account.phone': { en: 'Phone', it: 'Telefono' },
  'account.cancel': { en: 'Cancel', it: 'Annulla' },
  'account.save': { en: 'Save', it: 'Salva' },
  'account.email_placeholder': { en: 'email@example.com', it: 'email@esempio.com' },
  'account.first_name_placeholder': { en: 'First name', it: 'Nome' },
  'account.last_name_placeholder': { en: 'Last name', it: 'Cognome' },
  'account.company_placeholder': { en: 'Company name', it: 'Nome azienda' },
  'account.role_placeholder': { en: 'e.g. Energy Manager', it: 'Es. Energy Manager' },

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

  // Overview cards
  'overview.overall_performance': { en: 'OVERALL PERFORMANCE', it: 'PERFORMANCE GENERALE' },
  'overview.energy_performance': { en: 'ENERGY PERFORMANCE', it: 'PERFORMANCE ENERGETICA' },
  'overview.indoor_air_quality': { en: 'INDOOR AIR QUALITY', it: 'QUALITÀ ARIA INTERNA' },
  'overview.water_consumption_title': { en: 'WATER CONSUMPTION', it: 'CONSUMO IDRICO' },
  'overview.monitored_params': { en: 'Monitored Parameters', it: 'Parametri Monitorati' },
  'overview.efficiency': { en: 'Efficiency', it: 'Efficienza' },
  'overview.active_leaks': { en: 'Active Leaks', it: 'Perdite Attive' },
  'overview.l_day': { en: 'L/day', it: 'L/giorno' },
  'overview.vs_baseline': { en: 'vs baseline', it: 'vs baseline' },
  'overview.vs_last_period': { en: 'vs last period', it: 'vs periodo prec.' },
  'overview.score': { en: 'Score', it: 'Punteggio' },

  // ProjectDetail
  'pd.back_to_region': { en: 'Back to Region', it: 'Torna alla Regione' },
  'pd.change_bg': { en: 'Change Background', it: 'Cambia Sfondo' },
  'pd.export_pdf': { en: 'Export PDF', it: 'Esporta PDF' },
  'pd.project_settings': { en: 'Project Settings', it: 'Impostazioni Progetto' },
  'pd.energy_over_time': { en: 'Energy consumption over time', it: 'Consumo energetico nel tempo' },
  'pd.daily_energy_kwh': { en: 'Daily Energy (kWh)', it: 'Energia Giornaliera (kWh)' },
  'pd.avg_power_kw': { en: 'Average Power (kW)', it: 'Potenza Media (kW)' },
  'pd.categories': { en: 'Categories', it: 'Categorie' },
  'pd.devices': { en: 'Devices', it: 'Dispositivi' },
  'pd.energy_breakdown': { en: 'Energy consumption breakdown', it: 'Distribuzione consumi energetici' },
  'pd.total_kwh': { en: 'Total kWh', it: 'kWh Totali' },
  'pd.energy_density': { en: 'Energy Density', it: 'Densità Energetica' },
  'pd.in_selected_period': { en: 'in the selected period', it: 'nel periodo selezionato' },
  'pd.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato' },
  'pd.consumption_price': { en: 'Consumption', it: 'Consumo' },
  'pd.price_not_configured': { en: 'Energy price not configured', it: 'Prezzo energia non configurato' },
  'pd.rating': { en: 'rating', it: 'valutazione' },
  'pd.anomalies': { en: 'anomalies', it: 'anomalie' },
  'pd.attention': { en: '⚠ Attention', it: '⚠ Attenzione' },
  'pd.site_alerts': { en: 'Site Alerts', it: 'Alert Sito' },
  'pd.open_now': { en: 'Open now', it: 'Aperti ora' },
  'pd.opened_last_7_days': { en: 'Opened in last 7 days', it: 'Aperti negli ultimi 7 giorni' },
  'pd.heatmap': { en: 'Energy Consumption Heatmap', it: 'Heatmap Consumi Energetici' },
  'pd.actual_vs_average': { en: 'Actual vs Average', it: 'Effettivo vs Media' },
  'pd.power_consumption': { en: 'Power Consumption', it: 'Consumo Potenza' },
  'pd.realtime_kw': { en: 'Real-time (kW)', it: 'Tempo reale (kW)' },
  'pd.devices_consumption': { en: 'Devices Consumption', it: 'Consumi per Dispositivo' },
  'pd.breakdown_by': { en: 'Breakdown by', it: 'Suddivisione per' },
  'pd.category': { en: 'Category', it: 'Categoria' },
  'pd.device': { en: 'Device', it: 'Dispositivo' },
  'pd.carbon_footprint': { en: 'Carbon Footprint Analysis', it: 'Analisi Impronta CO₂' },
  'pd.monthly_comparison': { en: 'Monthly Comparison (Year vs Year)', it: 'Confronto Mensile (Anno vs Anno)' },
  'pd.weekly_breakdown': { en: 'Weekly Breakdown (Month vs Month)', it: 'Suddivisione Settimanale (Mese vs Mese)' },
  'pd.daily_profile': { en: 'Daily Profile (Week vs Week)', it: 'Profilo Giornaliero (Settimana vs Settimana)' },
  'pd.hourly_emissions': { en: 'Hourly Emissions', it: 'Emissioni Orarie' },
  'pd.energy_trend': { en: 'Energy Trend', it: 'Trend Energetico' },
  'pd.cumulative_kwh': { en: 'Cumulative kWh by category', it: 'kWh cumulativi per categoria' },
  'pd.energy_vs_outdoor': { en: 'Energy vs Outdoor', it: 'Energia vs Esterno' },
  'pd.energy_periods': { en: 'Energy Periods', it: 'Periodi Energetici' },
  'pd.no_data_year': { en: 'No data available for', it: 'Nessun dato disponibile per il' },

  // Air dashboard
  'pd.co2_trend': { en: 'CO₂ Trend', it: 'Trend CO₂' },
  'pd.tvoc_trend': { en: 'TVOC Trend', it: 'Trend TVOC' },
  'pd.temp_humidity': { en: 'Temperature & Relative Humidity', it: 'Temperatura & Umidità Relativa' },
  'pd.pm25_fine': { en: 'PM2.5 - Fine Particulate', it: 'PM2.5 - Particolato Fine' },
  'pd.pm10_coarse': { en: 'PM10 - Coarse Particulate', it: 'PM10 - Particolato Grossolano' },
  'pd.co_o3_title': { en: 'Carbon Monoxide (CO) & Ozone (O₃)', it: 'Monossido di Carbonio (CO) & Ozono (O₃)' },
  'pd.who_limit': { en: 'WHO Limit', it: 'Limite OMS' },
  'pd.safety_limit': { en: 'Safety limit', it: 'Limite sicurezza' },
  'pd.limit': { en: 'Limit', it: 'Limite' },
  'pd.quality_excellent': { en: 'Excellent', it: 'Ottimo' },
  'pd.quality_moderate': { en: 'Moderate', it: 'Moderato' },
  'pd.quality_poor': { en: 'Poor', it: 'Scarso' },
  'pd.indoor': { en: 'Indoor', it: 'Indoor' },
  'pd.outdoor': { en: 'Outdoor', it: 'Outdoor' },
  'pd.daily_trend': { en: 'Daily trend', it: 'Trend giornaliero' },

  // Water dashboard
  'pd.water_consumption': { en: 'Water Consumption', it: 'Consumo Idrico' },
  'pd.current_year': { en: 'Current Year', it: 'Anno Corrente' },
  'pd.previous_year': { en: 'Previous Year', it: 'Anno Precedente' },
  'pd.total_consumption': { en: 'Total Consumption', it: 'Consumo Totale' },
  'pd.leak_detection': { en: 'Leak Detection', it: 'Rilevamento Perdite' },
  'pd.critical_zones': { en: 'Critical zones monitoring', it: 'Monitoraggio zone critiche' },
  'pd.no_anomaly': { en: 'No anomaly', it: 'Nessuna anomalia' },
  'pd.detected': { en: 'Detected', it: 'Rilevato' },
  'pd.leak_rate': { en: 'leak rate', it: 'tasso perdita' },
  'pd.daily_consumption_trend': { en: 'Daily Consumption Trend', it: 'Trend Consumo Giornaliero' },
  'pd.peaks_hourly': { en: 'Peaks and hourly consumption', it: 'Picchi e consumi orari' },
  'pd.weekly_efficiency': { en: 'Weekly Efficiency', it: 'Efficienza Settimanale' },
  'pd.usage_waste_ratio': { en: 'Usage/waste ratio', it: 'Rapporto utilizzo/spreco' },
  'pd.water_quality': { en: 'Water Quality Parameters', it: 'Parametri Qualità Acqua' },
  'pd.ph_subtitle': { en: 'pH, Turbidity, Residual Chlorine', it: 'pH, Torbidità, Cloro residuo' },
  'pd.ph_acidity': { en: 'pH - Acidity', it: 'pH - Acidità' },
  'pd.current_value': { en: 'current value', it: 'valore attuale' },
  'pd.optimal_range': { en: 'Optimal range', it: 'Range ottimale' },
  'pd.optimal': { en: 'Optimal', it: 'Ottimale' },
  'pd.acidic': { en: 'Acidic (6)', it: 'Acido (6)' },
  'pd.neutral': { en: 'Neutral (7)', it: 'Neutro (7)' },
  'pd.basic': { en: 'Basic (9)', it: 'Basico (9)' },
  'pd.turbidity': { en: 'Turbidity', it: 'Torbidità' },
  'pd.ntu_current': { en: 'NTU (current)', it: 'NTU (attuale)' },
  'pd.excellent': { en: 'Excellent', it: 'Eccellente' },
  'pd.residual_chlorine': { en: 'Residual Chlorine', it: 'Cloro Residuo' },
  'pd.mgl_current': { en: 'mg/L (current)', it: 'mg/L (attuale)' },
  'pd.ideal_range': { en: 'Ideal range', it: 'Range ideale' },
  'pd.in_range': { en: 'In range', it: 'Nel range' },
  'pd.water_temperature': { en: 'Water Temperature', it: 'Temperatura Acqua' },
  'pd.c_current': { en: '°C (current)', it: '°C (attuale)' },
  'pd.comfort_range': { en: 'Comfort range', it: 'Range comfort' },
  'pd.ideal': { en: 'Ideal', it: 'Ideale' },

  // Heatmap legend
  'pd.hm_excellent': { en: 'Excellent', it: 'Ottimo' },
  'pd.hm_good': { en: 'Good', it: 'Buono' },
  'pd.hm_moderate': { en: 'Moderate', it: 'Moderato' },
  'pd.hm_high': { en: 'High', it: 'Elevato' },
  'pd.hm_critical': { en: 'Critical', it: 'Critico' },

  // Certification
  'pd.points_obtained': { en: 'Points obtained', it: 'Punti ottenuti' },
  'pd.certified_since': { en: 'Certified since 2023', it: 'Certificato dal 2023' },
  'pd.renewal': { en: 'Renewal: Dec 2025', it: 'Rinnovo: Dic 2025' },

  // Loading resources
  'pd.loading_resources': { en: 'Loading resources...', it: 'Caricamento Risorse...' },

  // No data
  'pd.no_data': { en: 'No data available', it: 'Nessun dato disponibile' },
  'pd.no_realtime_data': { en: 'No real-time data', it: 'Nessun dato in tempo reale' },

  // Time period selector
  'time.today': { en: 'Today', it: 'Oggi' },
  'time.week': { en: 'Week', it: 'Settimana' },
  'time.month': { en: 'Month', it: 'Mese' },
  'time.year': { en: 'Year', it: 'Anno' },
  'time.custom': { en: 'Custom', it: 'Personalizzato' },
  'time.custom_ellipsis': { en: 'Custom...', it: 'Personalizzato...' },
  'time.select_date_range': { en: 'Select date range', it: 'Seleziona intervallo date' },
  'time.cancel': { en: 'Cancel', it: 'Annulla' },
  'time.apply': { en: 'Apply', it: 'Applica' },
  'time.dates': { en: 'Dates', it: 'Date' },
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
