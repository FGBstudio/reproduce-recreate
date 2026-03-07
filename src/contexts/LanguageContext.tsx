import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Language = 'en' | 'it' | 'fr' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // Auth page
  'auth.welcome_back': { en: 'Welcome back', it: 'Bentornato', fr: 'Bon retour', es: 'Bienvenido de nuevo' },
  'auth.welcome': { en: 'Welcome', it: 'Benvenuto', fr: 'Bienvenue', es: 'Bienvenido' },
  'auth.login_subtitle': { en: 'Sign in to your FGB Studio account', it: 'Accedi al tuo account FGB Studio', fr: 'Connectez-vous à votre compte FGB Studio', es: 'Inicia sesión en tu cuenta FGB Studio' },
  'auth.email': { en: 'Email', it: 'Email', fr: 'E-mail', es: 'Correo electrónico' },
  'auth.password': { en: 'Password', it: 'Password', fr: 'Mot de passe', es: 'Contraseña' },
  'auth.confirm_password': { en: 'Confirm Password', it: 'Conferma Password', fr: 'Confirmer le mot de passe', es: 'Confirmar contraseña' },
  'auth.full_name': { en: 'Full name', it: 'Nome e cognome', fr: 'Nom complet', es: 'Nombre completo' },
  'auth.login': { en: 'Sign In', it: 'Accedi', fr: 'Se connecter', es: 'Iniciar sesión' },
  'auth.signup': { en: 'Sign Up for FGB Studio', it: 'Iscriviti a FGB Studio', fr: 'Inscription à FGB Studio', es: 'Regístrate en FGB Studio' },
  'auth.no_account': { en: "Don't have an account?", it: 'Non hai un account?', fr: "Vous n'avez pas de compte ?", es: '¿No tienes una cuenta?' },
  'auth.has_account': { en: 'Already have an account?', it: 'Hai già un account?', fr: 'Vous avez déjà un compte ?', es: '¿Ya tienes una cuenta?' },
  'auth.register': { en: 'Register', it: 'Registrati', fr: "S'inscrire", es: 'Registrarse' },
  'auth.need_help': { en: 'Need help? Contact support', it: "Serve aiuto? Contattare l'assistenza", fr: "Besoin d'aide ? Contactez le support", es: '¿Necesitas ayuda? Contacta con soporte' },
  'auth.terms_accept': { en: 'I have read and accepted the', it: 'Ho letto e accettato le', fr: "J'ai lu et accepté les", es: 'He leído y acepto los' },
  'auth.terms_link': { en: 'Terms of Service', it: 'Condizioni di utilizzo', fr: "Conditions d'utilisation", es: 'Términos de servicio' },
  'auth.email_password_required': { en: 'Email and password are required', it: 'Email e password sono obbligatori', fr: 'E-mail et mot de passe requis', es: 'El correo y la contraseña son obligatorios' },
  'auth.name_required': { en: 'Full name is required', it: 'Nome e cognome sono obbligatori', fr: 'Le nom complet est requis', es: 'El nombre completo es obligatorio' },
  'auth.passwords_mismatch': { en: 'Passwords do not match', it: 'Le password non corrispondono', fr: 'Les mots de passe ne correspondent pas', es: 'Las contraseñas no coinciden' },
  'auth.password_min': { en: 'Password must be at least 6 characters', it: 'La password deve essere di almeno 6 caratteri', fr: 'Le mot de passe doit comporter au moins 6 caractères', es: 'La contraseña debe tener al menos 6 caracteres' },
  'auth.terms_required': { en: 'You must accept the terms of service', it: 'Devi accettare le condizioni di utilizzo', fr: "Vous devez accepter les conditions d'utilisation", es: 'Debes aceptar los términos de servicio' },
  'auth.invalid_credentials': { en: 'Invalid credentials. Check your email and password.', it: 'Credenziali non valide. Verifica email e password.', fr: 'Identifiants invalides. Vérifiez votre e-mail et mot de passe.', es: 'Credenciales inválidas. Verifica tu correo y contraseña.' },
  'auth.already_registered': { en: 'This email is already registered', it: 'Questo indirizzo email è già registrato', fr: 'Cet e-mail est déjà enregistré', es: 'Este correo ya está registrado' },
  'auth.signup_success': { en: 'Registration complete! Check your email to confirm your account.', it: "Registrazione completata! Controlla la tua email per confermare l'account.", fr: 'Inscription terminée ! Vérifiez votre e-mail pour confirmer votre compte.', es: '¡Registro completado! Revisa tu correo para confirmar tu cuenta.' },
  'auth.auth_error': { en: 'Authentication error', it: "Errore durante l'autenticazione", fr: "Erreur d'authentification", es: 'Error de autenticación' },
  'auth.hero_title': { en: 'The future of energy management.', it: 'Il futuro della gestione energetica.', fr: "L'avenir de la gestion énergétique.", es: 'El futuro de la gestión energética.' },
  'auth.hero_subtitle': { en: 'Optimize performance, reduce waste, and make data-driven decisions with our analytics suite.', it: 'Ottimizza le prestazioni, riduci gli sprechi e prendi decisioni basate sui dati con la nostra suite analitica.', fr: 'Optimisez les performances, réduisez le gaspillage et prenez des décisions basées sur les données grâce à notre suite analytique.', es: 'Optimiza el rendimiento, reduce el desperdicio y toma decisiones basadas en datos con nuestra suite analítica.' },

  // Loading
  'common.loading': { en: 'Loading...', it: 'Caricamento...', fr: 'Chargement...', es: 'Cargando...' },

  // Header
  'header.search_placeholder': { en: 'Search projects, sites, brands...', it: 'Cerca progetti, siti, brand...', fr: 'Rechercher projets, sites, marques...', es: 'Buscar proyectos, sitios, marcas...' },
  'header.no_results': { en: 'No projects found', it: 'Nessun progetto trovato', fr: 'Aucun projet trouvé', es: 'No se encontraron proyectos' },
  'header.search_projects': { en: 'Search projects', it: 'Cerca progetti', fr: 'Rechercher des projets', es: 'Buscar proyectos' },

  // Overview
  'overview.active_alerts': { en: 'Active Alerts', it: 'Alert Attivi', fr: 'Alertes actives', es: 'Alertas activas' },
  'overview.disabled': { en: 'Disabled', it: 'Disabilitato', fr: 'Désactivé', es: 'Desactivado' },
  'overview.current_consumption': { en: 'Current Consumption', it: 'Consumo Attuale', fr: 'Consommation actuelle', es: 'Consumo actual' },
  'overview.latest_readings': { en: 'Latest Readings', it: 'Ultime Rilevazioni', fr: 'Dernières mesures', es: 'Últimas lecturas' },
  'overview.stale_data': { en: 'Stale data (> 2 days)', it: 'Dati non aggiornati (> 2 giorni)', fr: 'Données obsolètes (> 2 jours)', es: 'Datos desactualizados (> 2 días)' },
  'overview.humidity': { en: 'Humidity', it: 'Umidità', fr: 'Humidité', es: 'Humedad' },

  // Energy
  'energy.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato', fr: 'Coût estimé', es: 'Costo estimado' },
  'energy.efficiency': { en: 'Efficiency', it: 'Efficienza', fr: 'Efficacité', es: 'Eficiencia' },
  'energy.anomalies': { en: 'anomalies', it: 'anomalie', fr: 'anomalies', es: 'anomalías' },
  'energy.attention': { en: '⚠ Attention', it: '⚠ Attenzione', fr: '⚠ Attention', es: '⚠ Atención' },
  'energy.no_data_year': { en: 'No data available for', it: 'Nessun dato disponibile per il', fr: 'Aucune donnée disponible pour', es: 'No hay datos disponibles para' },
  'energy.consumption_price': { en: 'Consumption ×', it: 'Consumo ×', fr: 'Consommation ×', es: 'Consumo ×' },
  'energy.price_not_configured': { en: 'Energy price not configured', it: 'Prezzo energia non configurato', fr: "Prix de l'énergie non configuré", es: 'Precio de energía no configurado' },
  'energy.heatmap_consumption': { en: 'Energy Consumption Heatmap', it: 'Heatmap Consumi Energetici', fr: 'Carte thermique de consommation énergétique', es: 'Mapa de calor de consumo energético' },

  // Air
  'air.pm25_fine': { en: 'PM2.5 - Fine Particulate', it: 'PM2.5 - Particolato Fine', fr: 'PM2.5 - Particules fines', es: 'PM2.5 - Partículas finas' },
  'air.pm10_coarse': { en: 'PM10 - Coarse Particulate', it: 'PM10 - Particolato Grossolano', fr: 'PM10 - Particules grossières', es: 'PM10 - Partículas gruesas' },
  'air.co_title': { en: 'CO - Carbon Monoxide', it: 'CO - Monossido di Carbonio', fr: 'CO - Monoxyde de carbone', es: 'CO - Monóxido de carbono' },
  'air.o3_title': { en: 'O₃ - Ozone', it: 'O₃ - Ozono', fr: 'O₃ - Ozone', es: 'O₃ - Ozono' },
  'air.co_o3_title': { en: 'Carbon Monoxide (CO) & Ozone (O₃)', it: 'Monossido di Carbonio (CO) & Ozono (O₃)', fr: 'Monoxyde de carbone (CO) & Ozone (O₃)', es: 'Monóxido de carbono (CO) y Ozono (O₃)' },
  'air.daily_trend': { en: 'Daily trend', it: 'Trend giornaliero', fr: 'Tendance journalière', es: 'Tendencia diaria' },
  'air.temp_humidity': { en: 'Temperature & Relative Humidity', it: 'Temperatura & Umidità Relativa', fr: 'Température & Humidité relative', es: 'Temperatura y Humedad relativa' },
  'air.who_limit': { en: 'WHO Limit', it: 'Limite OMS', fr: 'Limite OMS', es: 'Límite OMS' },
  'air.safety_limit': { en: 'Safety limit', it: 'Limite sicurezza', fr: 'Limite de sécurité', es: 'Límite de seguridad' },
  'air.limit': { en: 'Limit', it: 'Limite', fr: 'Limite', es: 'Límite' },
  'air.quality_excellent': { en: 'Excellent', it: 'Ottimo', fr: 'Excellent', es: 'Excelente' },
  'air.quality_moderate': { en: 'Moderate', it: 'Moderato', fr: 'Modéré', es: 'Moderado' },
  'air.quality_poor': { en: 'Poor', it: 'Scarso', fr: 'Mauvais', es: 'Deficiente' },

  // Water
  'water.consumption': { en: 'Water Consumption', it: 'Consumo Idrico', fr: "Consommation d'eau", es: 'Consumo de agua' },
  'water.current_consumption': { en: 'Current Consumption', it: 'Consumo Attuale', fr: 'Consommation actuelle', es: 'Consumo actual' },
  'water.previous_year': { en: 'Previous Year', it: 'Anno Precedente', fr: 'Année précédente', es: 'Año anterior' },
  'water.distribution': { en: 'Consumption Distribution', it: 'Distribuzione Consumo', fr: 'Répartition de la consommation', es: 'Distribución del consumo' },
  'water.total_consumption': { en: 'Total Consumption', it: 'Consumo Totale', fr: 'Consommation totale', es: 'Consumo total' },
  'water.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato', fr: 'Coût estimé', es: 'Costo estimado' },
  'water.efficiency': { en: 'Efficiency', it: 'Efficienza', fr: 'Efficacité', es: 'Eficiencia' },
  'water.efficient_use': { en: 'efficient use', it: 'utilizzo efficiente', fr: 'utilisation efficace', es: 'uso eficiente' },
  'water.vs_last_month': { en: '↑ 5% vs last month', it: '↑ 5% vs mese scorso', fr: '↑ 5% vs mois dernier', es: '↑ 5% vs mes anterior' },
  'water.vs_last_year': { en: '↓ 12% vs last year', it: '↓ 12% vs anno scorso', fr: '↓ 12% vs année dernière', es: '↓ 12% vs año anterior' },
  'water.saved': { en: 'saved', it: 'risparmiati', fr: 'économisés', es: 'ahorrados' },
  'water.leaks_detected': { en: 'Leaks Detected', it: 'Perdite Rilevate', fr: 'Fuites détectées', es: 'Fugas detectadas' },
  'water.zones_anomalies': { en: 'zones with anomalies', it: 'zone con anomalie', fr: 'zones avec anomalies', es: 'zonas con anomalías' },
  'water.requires_attention': { en: '⚠ Requires attention', it: '⚠ Richiede attenzione', fr: '⚠ Nécessite attention', es: '⚠ Requiere atención' },
  'water.leak_detection': { en: 'Leak Detection', it: 'Rilevamento Perdite', fr: 'Détection de fuites', es: 'Detección de fugas' },
  'water.critical_zones': { en: 'Critical zones monitoring', it: 'Monitoraggio zone critiche', fr: 'Surveillance des zones critiques', es: 'Monitoreo de zonas críticas' },
  'water.no_anomaly': { en: 'No anomaly', it: 'Nessuna anomalia', fr: 'Aucune anomalie', es: 'Sin anomalías' },
  'water.detected': { en: 'Detected', it: 'Rilevato', fr: 'Détecté', es: 'Detectado' },
  'water.leak_rate': { en: 'leak rate', it: 'tasso perdita', fr: 'taux de fuite', es: 'tasa de fuga' },
  'water.daily_trend': { en: 'Daily Consumption Trend', it: 'Trend Consumo Giornaliero', fr: 'Tendance de consommation journalière', es: 'Tendencia de consumo diario' },
  'water.peaks_hourly': { en: 'Peaks and hourly consumption', it: 'Picchi e consumi orari', fr: 'Pics et consommation horaire', es: 'Picos y consumo por hora' },
  'water.weekly_efficiency': { en: 'Weekly Efficiency', it: 'Efficienza Settimanale', fr: 'Efficacité hebdomadaire', es: 'Eficiencia semanal' },
  'water.usage_waste_ratio': { en: 'Usage/waste ratio', it: 'Rapporto utilizzo/spreco', fr: 'Ratio utilisation/gaspillage', es: 'Ratio uso/desperdicio' },
  'water.waste': { en: 'Waste', it: 'Spreco', fr: 'Gaspillage', es: 'Desperdicio' },
  'water.quality_params': { en: 'Water Quality Parameters', it: 'Parametri Qualità Acqua', fr: "Paramètres de qualité de l'eau", es: 'Parámetros de calidad del agua' },
  'water.quality_subtitle': { en: 'pH, Turbidity, Residual Chlorine', it: 'pH, Torbidità, Cloro residuo', fr: 'pH, Turbidité, Chlore résiduel', es: 'pH, Turbidez, Cloro residual' },
  'water.ph_acidity': { en: 'pH - Acidity', it: 'pH - Acidità', fr: 'pH - Acidité', es: 'pH - Acidez' },
  'water.current_value': { en: 'current value', it: 'valore attuale', fr: 'valeur actuelle', es: 'valor actual' },
  'water.optimal_range': { en: 'Optimal range', it: 'Range ottimale', fr: 'Plage optimale', es: 'Rango óptimo' },
  'water.optimal': { en: 'Optimal', it: 'Ottimale', fr: 'Optimal', es: 'Óptimo' },
  'water.acidic': { en: 'Acidic (6)', it: 'Acido (6)', fr: 'Acide (6)', es: 'Ácido (6)' },
  'water.neutral': { en: 'Neutral (7)', it: 'Neutro (7)', fr: 'Neutre (7)', es: 'Neutro (7)' },
  'water.basic': { en: 'Basic (9)', it: 'Basico (9)', fr: 'Basique (9)', es: 'Básico (9)' },
  'water.turbidity': { en: 'Turbidity', it: 'Torbidità', fr: 'Turbidité', es: 'Turbidez' },
  'water.current_ntu': { en: 'NTU (current)', it: 'NTU (attuale)', fr: 'NTU (actuel)', es: 'NTU (actual)' },
  'water.excellent': { en: 'Excellent', it: 'Eccellente', fr: 'Excellent', es: 'Excelente' },
  'water.residual_chlorine': { en: 'Residual Chlorine', it: 'Cloro Residuo', fr: 'Chlore résiduel', es: 'Cloro residual' },
  'water.current_mgl': { en: 'mg/L (current)', it: 'mg/L (attuale)', fr: 'mg/L (actuel)', es: 'mg/L (actual)' },
  'water.ideal_range': { en: 'Ideal range', it: 'Range ideale', fr: 'Plage idéale', es: 'Rango ideal' },
  'water.in_range': { en: 'In range', it: 'Nel range', fr: 'Dans la plage', es: 'Dentro del rango' },
  'water.temperature': { en: 'Water Temperature', it: 'Temperatura Acqua', fr: "Température de l'eau", es: 'Temperatura del agua' },
  'water.current_temp': { en: '°C (current)', it: '°C (attuale)', fr: '°C (actuel)', es: '°C (actual)' },
  'water.comfort_range': { en: 'Comfort range', it: 'Range comfort', fr: 'Plage de confort', es: 'Rango de confort' },
  'water.ideal': { en: 'Ideal', it: 'Ideale', fr: 'Idéal', es: 'Ideal' },

  // Certification
  'cert.active_certs': { en: 'Active Certifications', it: 'Certificazioni Attive', fr: 'Certifications actives', es: 'Certificaciones activas' },
  'cert.milestones_reached': { en: 'Milestones Reached', it: 'Milestones Raggiunte', fr: 'Jalons atteints', es: 'Hitos alcanzados' },
  'cert.in_progress': { en: 'In Progress', it: 'In Corso', fr: 'En cours', es: 'En curso' },
  'cert.next_audit': { en: 'Next Audit', it: 'Prossimo Audit', fr: 'Prochain audit', es: 'Próxima auditoría' },
  'cert.certified_since': { en: 'Certified since 2023', it: 'Certificato dal 2023', fr: 'Certifié depuis 2023', es: 'Certificado desde 2023' },
  'cert.renewal': { en: 'Renewal: Dec 2025', it: 'Rinnovo: Dic 2025', fr: 'Renouvellement : Déc 2025', es: 'Renovación: Dic 2025' },
  'cert.points_obtained': { en: 'Points obtained', it: 'Punti ottenuti', fr: 'Points obtenus', es: 'Puntos obtenidos' },
  'cert.points': { en: 'points', it: 'punti', fr: 'points', es: 'puntos' },
  'cert.towards': { en: 'Progressing towards', it: 'In corso verso', fr: 'En progression vers', es: 'Progresando hacia' },

  // Heatmap
  'heatmap.title': { en: 'Consumption Heatmap', it: 'Heatmap Consumi', fr: 'Carte thermique de consommation', es: 'Mapa de calor de consumo' },

  // Dashboard nav
  'nav.overview': { en: 'Overview', it: 'Panoramica', fr: 'Vue d\'ensemble', es: 'Vista general' },
  'nav.energy': { en: 'Energy', it: 'Energia', fr: 'Énergie', es: 'Energía' },
  'nav.air': { en: 'Air', it: 'Aria', fr: 'Air', es: 'Aire' },
  'nav.water': { en: 'Water', it: 'Acqua', fr: 'Eau', es: 'Agua' },
  'nav.certifications': { en: 'Certifications', it: 'Certificazioni', fr: 'Certifications', es: 'Certificaciones' },

  // Modules
  'module.activate_to_view': { en: 'Activate the module to view data', it: 'Attiva il modulo per visualizzare i dati', fr: 'Activez le module pour voir les données', es: 'Activa el módulo para ver los datos' },
  'module.data_available': { en: 'Telemetry data will be available after activation', it: 'I dati di telemetria saranno disponibili dopo l\'attivazione', fr: 'Les données de télémétrie seront disponibles après activation', es: 'Los datos de telemetría estarán disponibles tras la activación' },
  'module.demo_data_notice': { en: 'The displayed data is illustrative and does not represent real values. Activate the module to view actual telemetry data.', it: 'I dati visualizzati sono esemplificativi e non rappresentano valori reali. Attiva il modulo per visualizzare i dati di telemetria effettivi.', fr: 'Les données affichées sont illustratives et ne représentent pas des valeurs réelles. Activez le module pour voir les données de télémétrie réelles.', es: 'Los datos mostrados son ilustrativos y no representan valores reales. Activa el módulo para ver los datos de telemetría reales.' },

  // Brand/Holding Overlay
  'brand.brand_overview': { en: 'Client Overview', it: 'Client Overview', fr: 'Vue client', es: 'Vista del cliente' },
  'brand.holding_overview': { en: 'Group Overview', it: 'Group Overview', fr: 'Vue groupe', es: 'Vista del grupo' },
  'brand.data_available': { en: 'Data available', it: 'Dati disponibili', fr: 'Données disponibles', es: 'Datos disponibles' },
  'brand.no_data': { en: 'No data', it: 'Nessun dato', fr: 'Aucune donnée', es: 'Sin datos' },
  'brand.sites_online': { en: 'Sites Online', it: 'Siti Online', fr: 'Sites en ligne', es: 'Sitios en línea' },
  'brand.kwh_7d': { en: 'kWh (30d)', it: 'kWh (30gg)', fr: 'kWh (30j)', es: 'kWh (30d)' },
  'brand.active_alerts': { en: 'Active Alerts', it: 'Alert Attivi', fr: 'Alertes actives', es: 'Alertas activas' },
  'brand.hide_charts': { en: 'Hide Charts', it: 'Nascondi Grafici', fr: 'Masquer les graphiques', es: 'Ocultar gráficos' },
  'brand.show_charts': { en: 'Show Charts', it: 'Mostra Grafici', fr: 'Afficher les graphiques', es: 'Mostrar gráficos' },
  'brand.no_active_modules': { en: 'No sites with active modules and available data', it: 'Nessun sito con moduli attivi e dati disponibili', fr: 'Aucun site avec des modules actifs et des données disponibles', es: 'No hay sitios con módulos activos y datos disponibles' },
  'brand.energy_consumption': { en: 'Energy Consumption (kWh, 30d)', it: 'Energy Consumption (kWh, 30gg)', fr: 'Consommation énergétique (kWh, 30j)', es: 'Consumo energético (kWh, 30d)' },
  'brand.air_quality': { en: 'Air Quality (CO₂ ppm)', it: 'Air Quality (CO₂ ppm)', fr: "Qualité de l'air (CO₂ ppm)", es: 'Calidad del aire (CO₂ ppm)' },
  'brand.performance_comparison': { en: 'Performance Comparison', it: 'Confronto Prestazioni', fr: 'Comparaison des performances', es: 'Comparación de rendimiento' },
  'brand.consumption_breakdown': { en: 'Consumption Breakdown', it: 'Distribuzione Consumi', fr: 'Répartition de la consommation', es: 'Desglose de consumo' },

  // User Account Dropdown
  'account.company': { en: 'Company', it: 'Azienda', fr: 'Entreprise', es: 'Empresa' },
  'account.system_role': { en: 'System Role', it: 'Ruolo Sistema', fr: 'Rôle système', es: 'Rol del sistema' },
  'account.edit_profile': { en: 'Edit Profile', it: 'Modifica Profilo', fr: 'Modifier le profil', es: 'Editar perfil' },
  'account.logout': { en: 'Log out', it: 'Esci', fr: 'Déconnexion', es: 'Cerrar sesión' },
  'account.click_upload': { en: 'Click to upload an image', it: "Clicca per caricare un'immagine", fr: 'Cliquez pour télécharger une image', es: 'Haz clic para subir una imagen' },
  'account.first_name': { en: 'First Name', it: 'Nome', fr: 'Prénom', es: 'Nombre' },
  'account.last_name': { en: 'Last Name', it: 'Cognome', fr: 'Nom', es: 'Apellido' },
  'account.role': { en: 'Role', it: 'Ruolo', fr: 'Rôle', es: 'Rol' },
  'account.phone': { en: 'Phone', it: 'Telefono', fr: 'Téléphone', es: 'Teléfono' },
  'account.cancel': { en: 'Cancel', it: 'Annulla', fr: 'Annuler', es: 'Cancelar' },
  'account.save': { en: 'Save', it: 'Salva', fr: 'Enregistrer', es: 'Guardar' },
  'account.email_placeholder': { en: 'email@example.com', it: 'email@esempio.com', fr: 'email@exemple.com', es: 'correo@ejemplo.com' },
  'account.first_name_placeholder': { en: 'First name', it: 'Nome', fr: 'Prénom', es: 'Nombre' },
  'account.last_name_placeholder': { en: 'Last name', it: 'Cognome', fr: 'Nom', es: 'Apellido' },
  'account.company_placeholder': { en: 'Company name', it: 'Nome azienda', fr: "Nom de l'entreprise", es: 'Nombre de la empresa' },
  'account.role_placeholder': { en: 'e.g. Energy Manager', it: 'Es. Energy Manager', fr: 'Ex. Energy Manager', es: 'Ej. Energy Manager' },

  // Admin
  'admin.search_hierarchy': { en: 'Search hierarchy...', it: 'Cerca nella gerarchia...', fr: 'Rechercher dans la hiérarchie...', es: 'Buscar en la jerarquía...' },
  'admin.no_project': { en: 'No project', it: 'Nessun progetto', fr: 'Aucun projet', es: 'Ningún proyecto' },
  'admin.no_site': { en: 'No site', it: 'Nessun site', fr: 'Aucun site', es: 'Ningún sitio' },
  'admin.no_brand': { en: 'No brand', it: 'Nessun brand', fr: 'Aucune marque', es: 'Ninguna marca' },
  'admin.no_result': { en: 'No result found', it: 'Nessun risultato trovato', fr: 'Aucun résultat trouvé', es: 'No se encontraron resultados' },
  'admin.no_holding': { en: 'No holding present', it: 'Nessuna holding presente', fr: 'Aucun groupe présent', es: 'Ningún grupo presente' },
  'admin.search_user': { en: 'Search user...', it: 'Cerca utente...', fr: 'Rechercher un utilisateur...', es: 'Buscar usuario...' },

  // Diagnosis
  'diagnosis.generating': { en: 'Generating AI diagnosis...', it: 'Generazione diagnosi AI...', fr: 'Génération du diagnostic IA...', es: 'Generando diagnóstico IA...' },

  // Overview cards
  'overview.overall_performance': { en: 'OVERALL PERFORMANCE', it: 'PERFORMANCE GENERALE', fr: 'PERFORMANCE GLOBALE', es: 'RENDIMIENTO GENERAL' },
  'overview.energy_performance': { en: 'ENERGY PERFORMANCE', it: 'PERFORMANCE ENERGETICA', fr: 'PERFORMANCE ÉNERGÉTIQUE', es: 'RENDIMIENTO ENERGÉTICO' },
  'overview.indoor_air_quality': { en: 'INDOOR AIR QUALITY', it: 'QUALITÀ ARIA INTERNA', fr: "QUALITÉ DE L'AIR INTÉRIEUR", es: 'CALIDAD DEL AIRE INTERIOR' },
  'overview.water_consumption_title': { en: 'WATER CONSUMPTION', it: 'CONSUMO IDRICO', fr: "CONSOMMATION D'EAU", es: 'CONSUMO DE AGUA' },
  'overview.monitored_params': { en: 'Monitored Parameters', it: 'Parametri Monitorati', fr: 'Paramètres surveillés', es: 'Parámetros monitoreados' },
  'overview.efficiency': { en: 'Efficiency', it: 'Efficienza', fr: 'Efficacité', es: 'Eficiencia' },
  'overview.active_leaks': { en: 'Active Leaks', it: 'Perdite Attive', fr: 'Fuites actives', es: 'Fugas activas' },
  'overview.l_day': { en: 'L/day', it: 'L/giorno', fr: 'L/jour', es: 'L/día' },
  'overview.vs_baseline': { en: 'vs baseline', it: 'vs baseline', fr: 'vs référence', es: 'vs referencia' },
  'overview.vs_last_period': { en: 'vs last period', it: 'vs periodo prec.', fr: 'vs période préc.', es: 'vs período ant.' },
  'overview.score': { en: 'Score', it: 'Punteggio', fr: 'Score', es: 'Puntuación' },

  // ProjectDetail
  'pd.back_to_region': { en: 'Back to Region', it: 'Torna alla Regione', fr: 'Retour à la région', es: 'Volver a la región' },
  'pd.change_bg': { en: 'Change Background', it: 'Cambia Sfondo', fr: "Changer l'arrière-plan", es: 'Cambiar fondo' },
  'pd.export_pdf': { en: 'Export PDF', it: 'Esporta PDF', fr: 'Exporter PDF', es: 'Exportar PDF' },
  'pd.project_settings': { en: 'Project Settings', it: 'Impostazioni Progetto', fr: 'Paramètres du projet', es: 'Configuración del proyecto' },
  'pd.energy_over_time': { en: 'Energy consumption over time', it: 'Consumo energetico nel tempo', fr: "Consommation d'énergie dans le temps", es: 'Consumo energético en el tiempo' },
  'pd.daily_energy_kwh': { en: 'Daily Energy (kWh)', it: 'Energia Giornaliera (kWh)', fr: 'Énergie journalière (kWh)', es: 'Energía diaria (kWh)' },
  'pd.avg_power_kw': { en: 'Average Power (kW)', it: 'Potenza Media (kW)', fr: 'Puissance moyenne (kW)', es: 'Potencia media (kW)' },
  'pd.categories': { en: 'Categories', it: 'Categorie', fr: 'Catégories', es: 'Categorías' },
  'pd.devices': { en: 'Devices', it: 'Dispositivi', fr: 'Appareils', es: 'Dispositivos' },
  'pd.energy_breakdown': { en: 'Energy consumption breakdown', it: 'Distribuzione consumi energetici', fr: 'Répartition de la consommation énergétique', es: 'Desglose de consumo energético' },
  'pd.total_kwh': { en: 'Total kWh', it: 'kWh Totali', fr: 'kWh totaux', es: 'kWh totales' },
  'pd.energy_density': { en: 'Energy Density', it: 'Densità Energetica', fr: 'Densité énergétique', es: 'Densidad energética' },
  'pd.in_selected_period': { en: 'in the selected period', it: 'nel periodo selezionato', fr: 'dans la période sélectionnée', es: 'en el período seleccionado' },
  'pd.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato', fr: 'Coût estimé', es: 'Costo estimado' },
  'pd.consumption_price': { en: 'Consumption', it: 'Consumo', fr: 'Consommation', es: 'Consumo' },
  'pd.price_not_configured': { en: 'Energy price not configured', it: 'Prezzo energia non configurato', fr: "Prix de l'énergie non configuré", es: 'Precio de energía no configurado' },
  'pd.rating': { en: 'rating', it: 'valutazione', fr: 'évaluation', es: 'calificación' },
  'pd.anomalies': { en: 'anomalies', it: 'anomalie', fr: 'anomalies', es: 'anomalías' },
  'pd.attention': { en: '⚠ Attention', it: '⚠ Attenzione', fr: '⚠ Attention', es: '⚠ Atención' },
  'pd.site_alerts': { en: 'Site Alerts', it: 'Alert Sito', fr: 'Alertes du site', es: 'Alertas del sitio' },
  'pd.open_now': { en: 'Open now', it: 'Aperti ora', fr: 'Ouverts maintenant', es: 'Abiertos ahora' },
  'pd.opened_last_7_days': { en: 'Opened in last 7 days', it: 'Aperti negli ultimi 7 giorni', fr: 'Ouverts ces 7 derniers jours', es: 'Abiertos en los últimos 7 días' },
  'pd.heatmap': { en: 'Energy Consumption Heatmap', it: 'Heatmap Consumi Energetici', fr: 'Carte thermique de consommation énergétique', es: 'Mapa de calor de consumo energético' },
  'pd.actual_vs_average': { en: 'Actual vs Average', it: 'Effettivo vs Media', fr: 'Réel vs Moyenne', es: 'Real vs Promedio' },
  'pd.power_consumption': { en: 'Power Consumption', it: 'Consumo Potenza', fr: 'Consommation de puissance', es: 'Consumo de potencia' },
  'pd.realtime_kw': { en: 'Real-time (kW)', it: 'Tempo reale (kW)', fr: 'Temps réel (kW)', es: 'Tiempo real (kW)' },
  'pd.devices_consumption': { en: 'Devices Consumption', it: 'Consumi per Dispositivo', fr: 'Consommation par appareil', es: 'Consumo por dispositivo' },
  'pd.breakdown_by': { en: 'Breakdown by', it: 'Suddivisione per', fr: 'Répartition par', es: 'Desglose por' },
  'pd.category': { en: 'Category', it: 'Categoria', fr: 'Catégorie', es: 'Categoría' },
  'pd.device': { en: 'Device', it: 'Dispositivo', fr: 'Appareil', es: 'Dispositivo' },
  'pd.carbon_footprint': { en: 'Carbon Footprint Analysis', it: 'Analisi Impronta CO₂', fr: 'Analyse empreinte carbone', es: 'Análisis de huella de carbono' },
  'pd.monthly_comparison': { en: 'Monthly Comparison (Year vs Year)', it: 'Confronto Mensile (Anno vs Anno)', fr: 'Comparaison mensuelle (Année vs Année)', es: 'Comparación mensual (Año vs Año)' },
  'pd.weekly_breakdown': { en: 'Weekly Breakdown (Month vs Month)', it: 'Suddivisione Settimanale (Mese vs Mese)', fr: 'Répartition hebdomadaire (Mois vs Mois)', es: 'Desglose semanal (Mes vs Mes)' },
  'pd.daily_profile': { en: 'Daily Profile (Week vs Week)', it: 'Profilo Giornaliero (Settimana vs Settimana)', fr: 'Profil journalier (Semaine vs Semaine)', es: 'Perfil diario (Semana vs Semana)' },
  'pd.hourly_emissions': { en: 'Hourly Emissions', it: 'Emissioni Orarie', fr: 'Émissions horaires', es: 'Emisiones por hora' },
  'pd.energy_trend': { en: 'Energy Trend', it: 'Trend Energetico', fr: 'Tendance énergétique', es: 'Tendencia energética' },
  'pd.cumulative_kwh': { en: 'Cumulative kWh by category', it: 'kWh cumulativi per categoria', fr: 'kWh cumulés par catégorie', es: 'kWh acumulados por categoría' },
  'pd.energy_vs_outdoor': { en: 'Energy vs Outdoor', it: 'Energia vs Esterno', fr: 'Énergie vs Extérieur', es: 'Energía vs Exterior' },
  'pd.energy_periods': { en: 'Energy Periods', it: 'Periodi Energetici', fr: 'Périodes énergétiques', es: 'Períodos energéticos' },
  'pd.no_data_year': { en: 'No data available for', it: 'Nessun dato disponibile per il', fr: 'Aucune donnée disponible pour', es: 'No hay datos disponibles para' },

  // Air dashboard
  'pd.co2_trend': { en: 'CO₂ Trend', it: 'Trend CO₂', fr: 'Tendance CO₂', es: 'Tendencia CO₂' },
  'pd.tvoc_trend': { en: 'TVOC Trend', it: 'Trend TVOC', fr: 'Tendance TVOC', es: 'Tendencia TVOC' },
  'pd.temp_humidity': { en: 'Temperature & Relative Humidity', it: 'Temperatura & Umidità Relativa', fr: 'Température & Humidité relative', es: 'Temperatura y Humedad relativa' },
  'pd.pm25_fine': { en: 'PM2.5 - Fine Particulate', it: 'PM2.5 - Particolato Fine', fr: 'PM2.5 - Particules fines', es: 'PM2.5 - Partículas finas' },
  'pd.pm10_coarse': { en: 'PM10 - Coarse Particulate', it: 'PM10 - Particolato Grossolano', fr: 'PM10 - Particules grossières', es: 'PM10 - Partículas gruesas' },
  'pd.co_o3_title': { en: 'Carbon Monoxide (CO) & Ozone (O₃)', it: 'Monossido di Carbonio (CO) & Ozono (O₃)', fr: 'Monoxyde de carbone (CO) & Ozone (O₃)', es: 'Monóxido de carbono (CO) y Ozono (O₃)' },
  'pd.who_limit': { en: 'WHO Limit', it: 'Limite OMS', fr: 'Limite OMS', es: 'Límite OMS' },
  'pd.safety_limit': { en: 'Safety limit', it: 'Limite sicurezza', fr: 'Limite de sécurité', es: 'Límite de seguridad' },
  'pd.limit': { en: 'Limit', it: 'Limite', fr: 'Limite', es: 'Límite' },
  'pd.quality_excellent': { en: 'Excellent', it: 'Ottimo', fr: 'Excellent', es: 'Excelente' },
  'pd.quality_moderate': { en: 'Moderate', it: 'Moderato', fr: 'Modéré', es: 'Moderado' },
  'pd.quality_poor': { en: 'Poor', it: 'Scarso', fr: 'Mauvais', es: 'Deficiente' },
  'pd.indoor': { en: 'Indoor', it: 'Indoor', fr: 'Intérieur', es: 'Interior' },
  'pd.outdoor': { en: 'Outdoor', it: 'Outdoor', fr: 'Extérieur', es: 'Exterior' },
  'pd.daily_trend': { en: 'Daily trend', it: 'Trend giornaliero', fr: 'Tendance journalière', es: 'Tendencia diaria' },

  // Water dashboard
  'pd.water_consumption': { en: 'Water Consumption', it: 'Consumo Idrico', fr: "Consommation d'eau", es: 'Consumo de agua' },
  'pd.current_year': { en: 'Current Year', it: 'Anno Corrente', fr: 'Année en cours', es: 'Año actual' },
  'pd.previous_year': { en: 'Previous Year', it: 'Anno Precedente', fr: 'Année précédente', es: 'Año anterior' },
  'pd.total_consumption': { en: 'Total Consumption', it: 'Consumo Totale', fr: 'Consommation totale', es: 'Consumo total' },
  'pd.leak_detection': { en: 'Leak Detection', it: 'Rilevamento Perdite', fr: 'Détection de fuites', es: 'Detección de fugas' },
  'pd.critical_zones': { en: 'Critical zones monitoring', it: 'Monitoraggio zone critiche', fr: 'Surveillance des zones critiques', es: 'Monitoreo de zonas críticas' },
  'pd.no_anomaly': { en: 'No anomaly', it: 'Nessuna anomalia', fr: 'Aucune anomalie', es: 'Sin anomalías' },
  'pd.detected': { en: 'Detected', it: 'Rilevato', fr: 'Détecté', es: 'Detectado' },
  'pd.leak_rate': { en: 'leak rate', it: 'tasso perdita', fr: 'taux de fuite', es: 'tasa de fuga' },
  'pd.daily_consumption_trend': { en: 'Daily Consumption Trend', it: 'Trend Consumo Giornaliero', fr: 'Tendance de consommation journalière', es: 'Tendencia de consumo diario' },
  'pd.peaks_hourly': { en: 'Peaks and hourly consumption', it: 'Picchi e consumi orari', fr: 'Pics et consommation horaire', es: 'Picos y consumo por hora' },
  'pd.weekly_efficiency': { en: 'Weekly Efficiency', it: 'Efficienza Settimanale', fr: 'Efficacité hebdomadaire', es: 'Eficiencia semanal' },
  'pd.usage_waste_ratio': { en: 'Usage/waste ratio', it: 'Rapporto utilizzo/spreco', fr: 'Ratio utilisation/gaspillage', es: 'Ratio uso/desperdicio' },
  'pd.water_quality': { en: 'Water Quality Parameters', it: 'Parametri Qualità Acqua', fr: "Paramètres de qualité de l'eau", es: 'Parámetros de calidad del agua' },
  'pd.ph_subtitle': { en: 'pH, Turbidity, Residual Chlorine', it: 'pH, Torbidità, Cloro residuo', fr: 'pH, Turbidité, Chlore résiduel', es: 'pH, Turbidez, Cloro residual' },
  'pd.ph_acidity': { en: 'pH - Acidity', it: 'pH - Acidità', fr: 'pH - Acidité', es: 'pH - Acidez' },
  'pd.current_value': { en: 'current value', it: 'valore attuale', fr: 'valeur actuelle', es: 'valor actual' },
  'pd.optimal_range': { en: 'Optimal range', it: 'Range ottimale', fr: 'Plage optimale', es: 'Rango óptimo' },
  'pd.optimal': { en: 'Optimal', it: 'Ottimale', fr: 'Optimal', es: 'Óptimo' },
  'pd.acidic': { en: 'Acidic (6)', it: 'Acido (6)', fr: 'Acide (6)', es: 'Ácido (6)' },
  'pd.neutral': { en: 'Neutral (7)', it: 'Neutro (7)', fr: 'Neutre (7)', es: 'Neutro (7)' },
  'pd.basic': { en: 'Basic (9)', it: 'Basico (9)', fr: 'Basique (9)', es: 'Básico (9)' },
  'pd.turbidity': { en: 'Turbidity', it: 'Torbidità', fr: 'Turbidité', es: 'Turbidez' },
  'pd.ntu_current': { en: 'NTU (current)', it: 'NTU (attuale)', fr: 'NTU (actuel)', es: 'NTU (actual)' },
  'pd.excellent': { en: 'Excellent', it: 'Eccellente', fr: 'Excellent', es: 'Excelente' },
  'pd.residual_chlorine': { en: 'Residual Chlorine', it: 'Cloro Residuo', fr: 'Chlore résiduel', es: 'Cloro residual' },
  'pd.mgl_current': { en: 'mg/L (current)', it: 'mg/L (attuale)', fr: 'mg/L (actuel)', es: 'mg/L (actual)' },
  'pd.ideal_range': { en: 'Ideal range', it: 'Range ideale', fr: 'Plage idéale', es: 'Rango ideal' },
  'pd.in_range': { en: 'In range', it: 'Nel range', fr: 'Dans la plage', es: 'Dentro del rango' },
  'pd.water_temperature': { en: 'Water Temperature', it: 'Temperatura Acqua', fr: "Température de l'eau", es: 'Temperatura del agua' },
  'pd.c_current': { en: '°C (current)', it: '°C (attuale)', fr: '°C (actuel)', es: '°C (actual)' },
  'pd.comfort_range': { en: 'Comfort range', it: 'Range comfort', fr: 'Plage de confort', es: 'Rango de confort' },
  'pd.ideal': { en: 'Ideal', it: 'Ideale', fr: 'Idéal', es: 'Ideal' },

  // Heatmap legend
  'pd.hm_excellent': { en: 'Excellent', it: 'Ottimo', fr: 'Excellent', es: 'Excelente' },
  'pd.hm_good': { en: 'Good', it: 'Buono', fr: 'Bon', es: 'Bueno' },
  'pd.hm_moderate': { en: 'Moderate', it: 'Moderato', fr: 'Modéré', es: 'Moderado' },
  'pd.hm_high': { en: 'High', it: 'Elevato', fr: 'Élevé', es: 'Elevado' },
  'pd.hm_critical': { en: 'Critical', it: 'Critico', fr: 'Critique', es: 'Crítico' },

  // Site Alerts widget
  'pd.site_alerts.critical': { en: 'Critical', it: 'Critici', fr: 'Critiques', es: 'Críticos' },
  'pd.site_alerts.medium': { en: 'Medium', it: 'Medi', fr: 'Moyens', es: 'Medios' },
  'pd.site_alerts.low': { en: 'Low', it: 'Bassi', fr: 'Faibles', es: 'Bajos' },
  'pd.site_alerts.all_clear': { en: 'All clear', it: 'Tutto OK', fr: 'Tout est OK', es: 'Todo OK' },
  'pd.site_alerts.back': { en: 'Back', it: 'Indietro', fr: 'Retour', es: 'Volver' },
  'pd.site_alerts.no_alerts': { en: 'No alerts in this category', it: 'Nessun alert in questa categoria', fr: 'Aucune alerte dans cette catégorie', es: 'No hay alertas en esta categoría' },
  'pd.site_alerts.device_offline': { en: 'Offline', it: 'Offline', fr: 'Hors ligne', es: 'Sin conexión' },
  'pd.site_alerts.device_offline_msg': { en: 'No data for > 24h', it: 'Nessun dato da > 24h', fr: 'Pas de données depuis > 24h', es: 'Sin datos desde hace > 24h' },
  'pd.site_alerts.site_stale': { en: 'Site offline (> 24h)', it: 'Sito offline (> 24h)', fr: 'Site hors ligne (> 24h)', es: 'Sitio sin conexión (> 24h)' },
  'pd.site_alerts.site_stale_msg': { en: 'No telemetry received from any device for over 24 hours', it: 'Nessuna telemetria ricevuta da alcun dispositivo per oltre 24 ore', fr: "Aucune télémétrie reçue d'aucun appareil depuis plus de 24 heures", es: 'No se ha recibido telemetría de ningún dispositivo en más de 24 horas' },
  'pd.site_alerts.timestamp': { en: 'Timestamp', it: 'Timestamp', fr: 'Horodatage', es: 'Marca de tiempo' },
  'pd.site_alerts.metric': { en: 'Metric', it: 'Metrica', fr: 'Métrique', es: 'Métrica' },
  'pd.site_alerts.device': { en: 'Device', it: 'Dispositivo', fr: 'Appareil', es: 'Dispositivo' },
  'pd.site_alerts.description': { en: 'Description', it: 'Descrizione', fr: 'Description', es: 'Descripción' },
  'pd.site_alerts.last_seen': { en: 'Last seen', it: 'Ultimo dato', fr: 'Dernière activité', es: 'Última actividad' },

  // Certification
  'pd.points_obtained': { en: 'Points obtained', it: 'Punti ottenuti', fr: 'Points obtenus', es: 'Puntos obtenidos' },
  'pd.certified_since': { en: 'Certified since 2023', it: 'Certificato dal 2023', fr: 'Certifié depuis 2023', es: 'Certificado desde 2023' },
  'pd.renewal': { en: 'Renewal: Dec 2025', it: 'Rinnovo: Dic 2025', fr: 'Renouvellement : Déc 2025', es: 'Renovación: Dic 2025' },

  // Loading resources
  'pd.loading_resources': { en: 'Loading resources...', it: 'Caricamento Risorse...', fr: 'Chargement des ressources...', es: 'Cargando recursos...' },

  // No data
  'pd.no_data': { en: 'No data available', it: 'Nessun dato disponibile', fr: 'Aucune donnée disponible', es: 'No hay datos disponibles' },
  'pd.no_realtime_data': { en: 'No real-time data', it: 'Nessun dato in tempo reale', fr: 'Aucune donnée en temps réel', es: 'Sin datos en tiempo real' },

  // Time period selector
  'time.today': { en: 'Today', it: 'Oggi', fr: "Aujourd'hui", es: 'Hoy' },
  'time.week': { en: 'Week', it: 'Settimana', fr: 'Semaine', es: 'Semana' },
  'time.month': { en: 'Month', it: 'Mese', fr: 'Mois', es: 'Mes' },
  'time.year': { en: 'Year', it: 'Anno', fr: 'Année', es: 'Año' },
  'time.custom': { en: 'Custom', it: 'Personalizzato', fr: 'Personnalisé', es: 'Personalizado' },
  'time.custom_ellipsis': { en: 'Custom...', it: 'Personalizzato...', fr: 'Personnalisé...', es: 'Personalizado...' },
  'time.select_date_range': { en: 'Select date range', it: 'Seleziona intervallo date', fr: 'Sélectionner une plage de dates', es: 'Seleccionar rango de fechas' },
  'time.cancel': { en: 'Cancel', it: 'Annulla', fr: 'Annuler', es: 'Cancelar' },
  'time.apply': { en: 'Apply', it: 'Applica', fr: 'Appliquer', es: 'Aplicar' },
  'time.dates': { en: 'Dates', it: 'Date', fr: 'Dates', es: 'Fechas' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('fgb-language');
    if (stored === 'it' || stored === 'fr' || stored === 'es') return stored as Language;
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('fgb-language', lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    const order: Language[] = ['en', 'it', 'fr', 'es'];
    const idx = order.indexOf(language);
    setLanguage(order[(idx + 1) % order.length]);
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
