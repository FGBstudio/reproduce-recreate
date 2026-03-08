import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Language = 'en' | 'it' | 'fr' | 'es' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // Auth page
  'auth.welcome_back': { en: 'Welcome back', it: 'Bentornato', fr: 'Bon retour', es: 'Bienvenido de nuevo', zh: '欢迎回来' },
  'auth.welcome': { en: 'Welcome', it: 'Benvenuto', fr: 'Bienvenue', es: 'Bienvenido', zh: '欢迎' },
  'auth.login_subtitle': { en: 'Sign in to your FGB Studio account', it: 'Accedi al tuo account FGB Studio', fr: 'Connectez-vous à votre compte FGB Studio', es: 'Inicia sesión en tu cuenta FGB Studio', zh: '登录您的 FGB Studio 账户' },
  'auth.email': { en: 'Email', it: 'Email', fr: 'E-mail', es: 'Correo electrónico', zh: '电子邮件' },
  'auth.password': { en: 'Password', it: 'Password', fr: 'Mot de passe', es: 'Contraseña', zh: '密码' },
  'auth.confirm_password': { en: 'Confirm Password', it: 'Conferma Password', fr: 'Confirmer le mot de passe', es: 'Confirmar contraseña', zh: '确认密码' },
  'auth.full_name': { en: 'Full name', it: 'Nome e cognome', fr: 'Nom complet', es: 'Nombre completo', zh: '全名' },
  'auth.login': { en: 'Sign In', it: 'Accedi', fr: 'Se connecter', es: 'Iniciar sesión', zh: '登录' },
  'auth.signup': { en: 'Sign Up for FGB Studio', it: 'Iscriviti a FGB Studio', fr: 'Inscription à FGB Studio', es: 'Regístrate en FGB Studio', zh: '注册 FGB Studio' },
  'auth.no_account': { en: "Don't have an account?", it: 'Non hai un account?', fr: "Vous n'avez pas de compte ?", es: '¿No tienes una cuenta?', zh: '没有账户？' },
  'auth.has_account': { en: 'Already have an account?', it: 'Hai già un account?', fr: 'Vous avez déjà un compte ?', es: '¿Ya tienes una cuenta?', zh: '已有账户？' },
  'auth.register': { en: 'Register', it: 'Registrati', fr: "S'inscrire", es: 'Registrarse', zh: '注册' },
  'auth.need_help': { en: 'Need help? Contact support', it: "Serve aiuto? Contattare l'assistenza", fr: "Besoin d'aide ? Contactez le support", es: '¿Necesitas ayuda? Contacta con soporte', zh: '需要帮助？联系客服' },
  'auth.terms_accept': { en: 'I have read and accepted the', it: 'Ho letto e accettato le', fr: "J'ai lu et accepté les", es: 'He leído y acepto los', zh: '我已阅读并接受' },
  'auth.terms_link': { en: 'Terms of Service', it: 'Condizioni di utilizzo', fr: "Conditions d'utilisation", es: 'Términos de servicio', zh: '服务条款' },
  'auth.email_password_required': { en: 'Email and password are required', it: 'Email e password sono obbligatori', fr: 'E-mail et mot de passe requis', es: 'El correo y la contraseña son obligatorios', zh: '请填写电子邮件和密码' },
  'auth.name_required': { en: 'Full name is required', it: 'Nome e cognome sono obbligatori', fr: 'Le nom complet est requis', es: 'El nombre completo es obligatorio', zh: '请填写全名' },
  'auth.passwords_mismatch': { en: 'Passwords do not match', it: 'Le password non corrispondono', fr: 'Les mots de passe ne correspondent pas', es: 'Las contraseñas no coinciden', zh: '密码不一致' },
  'auth.password_min': { en: 'Password must be at least 6 characters', it: 'La password deve essere di almeno 6 caratteri', fr: 'Le mot de passe doit comporter au moins 6 caractères', es: 'La contraseña debe tener al menos 6 caracteres', zh: '密码至少需要6个字符' },
  'auth.terms_required': { en: 'You must accept the terms of service', it: 'Devi accettare le condizioni di utilizzo', fr: "Vous devez accepter les conditions d'utilisation", es: 'Debes aceptar los términos de servicio', zh: '请接受服务条款' },
  'auth.invalid_credentials': { en: 'Invalid credentials. Check your email and password.', it: 'Credenziali non valide. Verifica email e password.', fr: 'Identifiants invalides. Vérifiez votre e-mail et mot de passe.', es: 'Credenciales inválidas. Verifica tu correo y contraseña.', zh: '凭据无效，请检查电子邮件和密码。' },
  'auth.already_registered': { en: 'This email is already registered', it: 'Questo indirizzo email è già registrato', fr: 'Cet e-mail est déjà enregistré', es: 'Este correo ya está registrado', zh: '此电子邮件已注册' },
  'auth.signup_success': { en: 'Registration complete! Check your email to confirm your account.', it: "Registrazione completata! Controlla la tua email per confermare l'account.", fr: 'Inscription terminée ! Vérifiez votre e-mail pour confirmer votre compte.', es: '¡Registro completado! Revisa tu correo para confirmar tu cuenta.', zh: '注册成功！请检查您的电子邮件以确认账户。' },
  'auth.auth_error': { en: 'Authentication error', it: "Errore durante l'autenticazione", fr: "Erreur d'authentification", es: 'Error de autenticación', zh: '认证错误' },
  'auth.hero_title': { en: 'The future of energy management.', it: 'Il futuro della gestione energetica.', fr: "L'avenir de la gestion énergétique.", es: 'El futuro de la gestión energética.', zh: '能源管理的未来。' },
  'auth.hero_subtitle': { en: 'Optimize performance, reduce waste, and make data-driven decisions with our analytics suite.', it: 'Ottimizza le prestazioni, riduci gli sprechi e prendi decisioni basate sui dati con la nostra suite analitica.', fr: 'Optimisez les performances, réduisez le gaspillage et prenez des décisions basées sur les données grâce à notre suite analytique.', es: 'Optimiza el rendimiento, reduce el desperdicio y toma decisiones basadas en datos con nuestra suite analítica.', zh: '通过我们的分析平台优化性能、减少浪费、实现数据驱动决策。' },

  // Loading
  'common.loading': { en: 'Loading...', it: 'Caricamento...', fr: 'Chargement...', es: 'Cargando...', zh: '加载中...' },

  // Header
  'header.search_placeholder': { en: 'Search projects, sites, brands...', it: 'Cerca progetti, siti, brand...', fr: 'Rechercher projets, sites, marques...', es: 'Buscar proyectos, sitios, marcas...', zh: '搜索项目、站点、品牌...' },
  'header.no_results': { en: 'No projects found', it: 'Nessun progetto trovato', fr: 'Aucun projet trouvé', es: 'No se encontraron proyectos', zh: '未找到项目' },
  'header.search_projects': { en: 'Search projects', it: 'Cerca progetti', fr: 'Rechercher des projets', es: 'Buscar proyectos', zh: '搜索项目' },

  // Overview
  'overview.active_alerts': { en: 'Active Alerts', it: 'Alert Attivi', fr: 'Alertes actives', es: 'Alertas activas', zh: '活跃警报' },
  'overview.disabled': { en: 'Disabled', it: 'Disabilitato', fr: 'Désactivé', es: 'Desactivado', zh: '已禁用' },
  'overview.current_consumption': { en: 'Current Consumption', it: 'Consumo Attuale', fr: 'Consommation actuelle', es: 'Consumo actual', zh: '当前消耗' },
  'overview.latest_readings': { en: 'Latest Readings', it: 'Ultime Rilevazioni', fr: 'Dernières mesures', es: 'Últimas lecturas', zh: '最新读数' },
  'overview.stale_data': { en: 'Stale data (> 2 days)', it: 'Dati non aggiornati (> 2 giorni)', fr: 'Données obsolètes (> 2 jours)', es: 'Datos desactualizados (> 2 días)', zh: '数据过期（> 2天）' },
  'overview.humidity': { en: 'Humidity', it: 'Umidità', fr: 'Humidité', es: 'Humedad', zh: '湿度' },

  // Energy
  'energy.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato', fr: 'Coût estimé', es: 'Costo estimado', zh: '预估费用' },
  'energy.efficiency': { en: 'Efficiency', it: 'Efficienza', fr: 'Efficacité', es: 'Eficiencia', zh: '能效' },
  'energy.anomalies': { en: 'anomalies', it: 'anomalie', fr: 'anomalies', es: 'anomalías', zh: '异常' },
  'energy.attention': { en: '⚠ Attention', it: '⚠ Attenzione', fr: '⚠ Attention', es: '⚠ Atención', zh: '⚠ 注意' },
  'energy.no_data_year': { en: 'No data available for', it: 'Nessun dato disponibile per il', fr: 'Aucune donnée disponible pour', es: 'No hay datos disponibles para', zh: '无可用数据：' },
  'energy.consumption_price': { en: 'Consumption ×', it: 'Consumo ×', fr: 'Consommation ×', es: 'Consumo ×', zh: '消耗 ×' },
  'energy.price_not_configured': { en: 'Energy price not configured', it: 'Prezzo energia non configurato', fr: "Prix de l'énergie non configuré", es: 'Precio de energía no configurado', zh: '未配置能源价格' },
  'energy.heatmap_consumption': { en: 'Energy Consumption Heatmap', it: 'Heatmap Consumi Energetici', fr: 'Carte thermique de consommation énergétique', es: 'Mapa de calor de consumo energético', zh: '能耗热力图' },

  // Air
  'air.pm25_fine': { en: 'PM2.5 - Fine Particulate', it: 'PM2.5 - Particolato Fine', fr: 'PM2.5 - Particules fines', es: 'PM2.5 - Partículas finas', zh: 'PM2.5 - 细颗粒物' },
  'air.pm10_coarse': { en: 'PM10 - Coarse Particulate', it: 'PM10 - Particolato Grossolano', fr: 'PM10 - Particules grossières', es: 'PM10 - Partículas gruesas', zh: 'PM10 - 粗颗粒物' },
  'air.co_title': { en: 'CO - Carbon Monoxide', it: 'CO - Monossido di Carbonio', fr: 'CO - Monoxyde de carbone', es: 'CO - Monóxido de carbono', zh: 'CO - 一氧化碳' },
  'air.o3_title': { en: 'O₃ - Ozone', it: 'O₃ - Ozono', fr: 'O₃ - Ozone', es: 'O₃ - Ozono', zh: 'O₃ - 臭氧' },
  'air.co_o3_title': { en: 'Carbon Monoxide (CO) & Ozone (O₃)', it: 'Monossido di Carbonio (CO) & Ozono (O₃)', fr: 'Monoxyde de carbone (CO) & Ozone (O₃)', es: 'Monóxido de carbono (CO) y Ozono (O₃)', zh: '一氧化碳 (CO) 与 臭氧 (O₃)' },
  'air.daily_trend': { en: 'Daily trend', it: 'Trend giornaliero', fr: 'Tendance journalière', es: 'Tendencia diaria', zh: '每日趋势' },
  'air.temp_humidity': { en: 'Temperature & Relative Humidity', it: 'Temperatura & Umidità Relativa', fr: 'Température & Humidité relative', es: 'Temperatura y Humedad relativa', zh: '温度与相对湿度' },
  'air.who_limit': { en: 'WHO Limit', it: 'Limite OMS', fr: 'Limite OMS', es: 'Límite OMS', zh: 'WHO 限值' },
  'air.safety_limit': { en: 'Safety limit', it: 'Limite sicurezza', fr: 'Limite de sécurité', es: 'Límite de seguridad', zh: '安全限值' },
  'air.limit': { en: 'Limit', it: 'Limite', fr: 'Limite', es: 'Límite', zh: '限值' },
  'air.quality_excellent': { en: 'Excellent', it: 'Ottimo', fr: 'Excellent', es: 'Excelente', zh: '优秀' },
  'air.quality_moderate': { en: 'Moderate', it: 'Moderato', fr: 'Modéré', es: 'Moderado', zh: '中等' },
  'air.quality_poor': { en: 'Poor', it: 'Scarso', fr: 'Mauvais', es: 'Deficiente', zh: '较差' },

  // Water
  'water.consumption': { en: 'Water Consumption', it: 'Consumo Idrico', fr: "Consommation d'eau", es: 'Consumo de agua', zh: '用水量' },
  'water.current_consumption': { en: 'Current Consumption', it: 'Consumo Attuale', fr: 'Consommation actuelle', es: 'Consumo actual', zh: '当前消耗' },
  'water.previous_year': { en: 'Previous Year', it: 'Anno Precedente', fr: 'Année précédente', es: 'Año anterior', zh: '上一年度' },
  'water.distribution': { en: 'Consumption Distribution', it: 'Distribuzione Consumo', fr: 'Répartition de la consommation', es: 'Distribución del consumo', zh: '消耗分布' },
  'water.total_consumption': { en: 'Total Consumption', it: 'Consumo Totale', fr: 'Consommation totale', es: 'Consumo total', zh: '总消耗' },
  'water.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato', fr: 'Coût estimé', es: 'Costo estimado', zh: '预估费用' },
  'water.efficiency': { en: 'Efficiency', it: 'Efficienza', fr: 'Efficacité', es: 'Eficiencia', zh: '效率' },
  'water.efficient_use': { en: 'efficient use', it: 'utilizzo efficiente', fr: 'utilisation efficace', es: 'uso eficiente', zh: '高效使用' },
  'water.vs_last_month': { en: '↑ 5% vs last month', it: '↑ 5% vs mese scorso', fr: '↑ 5% vs mois dernier', es: '↑ 5% vs mes anterior', zh: '↑ 5% 较上月' },
  'water.vs_last_year': { en: '↓ 12% vs last year', it: '↓ 12% vs anno scorso', fr: '↓ 12% vs année dernière', es: '↓ 12% vs año anterior', zh: '↓ 12% 较去年' },
  'water.saved': { en: 'saved', it: 'risparmiati', fr: 'économisés', es: 'ahorrados', zh: '节省' },
  'water.leaks_detected': { en: 'Leaks Detected', it: 'Perdite Rilevate', fr: 'Fuites détectées', es: 'Fugas detectadas', zh: '检测到漏水' },
  'water.zones_anomalies': { en: 'zones with anomalies', it: 'zone con anomalie', fr: 'zones avec anomalies', es: 'zonas con anomalías', zh: '异常区域' },
  'water.requires_attention': { en: '⚠ Requires attention', it: '⚠ Richiede attenzione', fr: '⚠ Nécessite attention', es: '⚠ Requiere atención', zh: '⚠ 需要关注' },
  'water.leak_detection': { en: 'Leak Detection', it: 'Rilevamento Perdite', fr: 'Détection de fuites', es: 'Detección de fugas', zh: '漏水检测' },
  'water.critical_zones': { en: 'Critical zones monitoring', it: 'Monitoraggio zone critiche', fr: 'Surveillance des zones critiques', es: 'Monitoreo de zonas críticas', zh: '关键区域监控' },
  'water.no_anomaly': { en: 'No anomaly', it: 'Nessuna anomalia', fr: 'Aucune anomalie', es: 'Sin anomalías', zh: '无异常' },
  'water.detected': { en: 'Detected', it: 'Rilevato', fr: 'Détecté', es: 'Detectado', zh: '已检测' },
  'water.leak_rate': { en: 'leak rate', it: 'tasso perdita', fr: 'taux de fuite', es: 'tasa de fuga', zh: '泄漏率' },
  'water.daily_trend': { en: 'Daily Consumption Trend', it: 'Trend Consumo Giornaliero', fr: 'Tendance de consommation journalière', es: 'Tendencia de consumo diario', zh: '每日消耗趋势' },
  'water.peaks_hourly': { en: 'Peaks and hourly consumption', it: 'Picchi e consumi orari', fr: 'Pics et consommation horaire', es: 'Picos y consumo por hora', zh: '峰值与每小时消耗' },
  'water.weekly_efficiency': { en: 'Weekly Efficiency', it: 'Efficienza Settimanale', fr: 'Efficacité hebdomadaire', es: 'Eficiencia semanal', zh: '每周效率' },
  'water.usage_waste_ratio': { en: 'Usage/waste ratio', it: 'Rapporto utilizzo/spreco', fr: 'Ratio utilisation/gaspillage', es: 'Ratio uso/desperdicio', zh: '使用/浪费比率' },
  'water.waste': { en: 'Waste', it: 'Spreco', fr: 'Gaspillage', es: 'Desperdicio', zh: '浪费' },
  'water.quality_params': { en: 'Water Quality Parameters', it: 'Parametri Qualità Acqua', fr: "Paramètres de qualité de l'eau", es: 'Parámetros de calidad del agua', zh: '水质参数' },
  'water.quality_subtitle': { en: 'pH, Turbidity, Residual Chlorine', it: 'pH, Torbidità, Cloro residuo', fr: 'pH, Turbidité, Chlore résiduel', es: 'pH, Turbidez, Cloro residual', zh: 'pH、浊度、余氯' },
  'water.ph_acidity': { en: 'pH - Acidity', it: 'pH - Acidità', fr: 'pH - Acidité', es: 'pH - Acidez', zh: 'pH - 酸度' },
  'water.current_value': { en: 'current value', it: 'valore attuale', fr: 'valeur actuelle', es: 'valor actual', zh: '当前值' },
  'water.optimal_range': { en: 'Optimal range', it: 'Range ottimale', fr: 'Plage optimale', es: 'Rango óptimo', zh: '最佳范围' },
  'water.optimal': { en: 'Optimal', it: 'Ottimale', fr: 'Optimal', es: 'Óptimo', zh: '最佳' },
  'water.acidic': { en: 'Acidic (6)', it: 'Acido (6)', fr: 'Acide (6)', es: 'Ácido (6)', zh: '酸性 (6)' },
  'water.neutral': { en: 'Neutral (7)', it: 'Neutro (7)', fr: 'Neutre (7)', es: 'Neutro (7)', zh: '中性 (7)' },
  'water.basic': { en: 'Basic (9)', it: 'Basico (9)', fr: 'Basique (9)', es: 'Básico (9)', zh: '碱性 (9)' },
  'water.turbidity': { en: 'Turbidity', it: 'Torbidità', fr: 'Turbidité', es: 'Turbidez', zh: '浊度' },
  'water.current_ntu': { en: 'NTU (current)', it: 'NTU (attuale)', fr: 'NTU (actuel)', es: 'NTU (actual)', zh: 'NTU（当前）' },
  'water.excellent': { en: 'Excellent', it: 'Eccellente', fr: 'Excellent', es: 'Excelente', zh: '优秀' },
  'water.residual_chlorine': { en: 'Residual Chlorine', it: 'Cloro Residuo', fr: 'Chlore résiduel', es: 'Cloro residual', zh: '余氯' },
  'water.current_mgl': { en: 'mg/L (current)', it: 'mg/L (attuale)', fr: 'mg/L (actuel)', es: 'mg/L (actual)', zh: 'mg/L（当前）' },
  'water.ideal_range': { en: 'Ideal range', it: 'Range ideale', fr: 'Plage idéale', es: 'Rango ideal', zh: '理想范围' },
  'water.in_range': { en: 'In range', it: 'Nel range', fr: 'Dans la plage', es: 'Dentro del rango', zh: '在范围内' },
  'water.temperature': { en: 'Water Temperature', it: 'Temperatura Acqua', fr: "Température de l'eau", es: 'Temperatura del agua', zh: '水温' },
  'water.current_temp': { en: '°C (current)', it: '°C (attuale)', fr: '°C (actuel)', es: '°C (actual)', zh: '°C（当前）' },
  'water.comfort_range': { en: 'Comfort range', it: 'Range comfort', fr: 'Plage de confort', es: 'Rango de confort', zh: '舒适范围' },
  'water.ideal': { en: 'Ideal', it: 'Ideale', fr: 'Idéal', es: 'Ideal', zh: '理想' },

  // Certification
  'cert.active_certs': { en: 'Active Certifications', it: 'Certificazioni Attive', fr: 'Certifications actives', es: 'Certificaciones activas', zh: '有效认证' },
  'cert.milestones_reached': { en: 'Milestones Reached', it: 'Milestones Raggiunte', fr: 'Jalons atteints', es: 'Hitos alcanzados', zh: '已达里程碑' },
  'cert.in_progress': { en: 'In Progress', it: 'In Corso', fr: 'En cours', es: 'En curso', zh: '进行中' },
  'cert.next_audit': { en: 'Next Audit', it: 'Prossimo Audit', fr: 'Prochain audit', es: 'Próxima auditoría', zh: '下次审计' },
  'cert.certified_since': { en: 'Certified since 2023', it: 'Certificato dal 2023', fr: 'Certifié depuis 2023', es: 'Certificado desde 2023', zh: '自2023年起认证' },
  'cert.renewal': { en: 'Renewal: Dec 2025', it: 'Rinnovo: Dic 2025', fr: 'Renouvellement : Déc 2025', es: 'Renovación: Dic 2025', zh: '续期：2025年12月' },
  'cert.points_obtained': { en: 'Points obtained', it: 'Punti ottenuti', fr: 'Points obtenus', es: 'Puntos obtenidos', zh: '获得分数' },
  'cert.points': { en: 'points', it: 'punti', fr: 'points', es: 'puntos', zh: '分' },
  'cert.towards': { en: 'Progressing towards', it: 'In corso verso', fr: 'En progression vers', es: 'Progresando hacia', zh: '正在推进' },

  // Heatmap
  'heatmap.title': { en: 'Consumption Heatmap', it: 'Heatmap Consumi', fr: 'Carte thermique de consommation', es: 'Mapa de calor de consumo', zh: '消耗热力图' },

  // Dashboard nav
  'nav.overview': { en: 'Overview', it: 'Panoramica', fr: 'Vue d\'ensemble', es: 'Vista general', zh: '概览' },
  'nav.energy': { en: 'Energy', it: 'Energia', fr: 'Énergie', es: 'Energía', zh: '能源' },
  'nav.air': { en: 'Air', it: 'Aria', fr: 'Air', es: 'Aire', zh: '空气' },
  'nav.water': { en: 'Water', it: 'Acqua', fr: 'Eau', es: 'Agua', zh: '水' },
  'nav.certifications': { en: 'Certifications', it: 'Certificazioni', fr: 'Certifications', es: 'Certificaciones', zh: '认证' },

  // Modules
  'module.activate_to_view': { en: 'Activate the module to view data', it: 'Attiva il modulo per visualizzare i dati', fr: 'Activez le module pour voir les données', es: 'Activa el módulo para ver los datos', zh: '激活模块以查看数据' },
  'module.data_available': { en: 'Telemetry data will be available after activation', it: 'I dati di telemetria saranno disponibili dopo l\'attivazione', fr: 'Les données de télémétrie seront disponibles après activation', es: 'Los datos de telemetría estarán disponibles tras la activación', zh: '激活后可查看遥测数据' },
  'module.demo_data_notice': { en: 'The displayed data is illustrative and does not represent real values. Activate the module to view actual telemetry data.', it: 'I dati visualizzati sono esemplificativi e non rappresentano valori reali. Attiva il modulo per visualizzare i dati di telemetria effettivi.', fr: 'Les données affichées sont illustratives et ne représentent pas des valeurs réelles. Activez le module pour voir les données de télémétrie réelles.', es: 'Los datos mostrados son ilustrativos y no representan valores reales. Activa el módulo para ver los datos de telemetría reales.', zh: '显示的数据仅为示例，不代表真实值。激活模块以查看实际遥测数据。' },

  // Brand/Holding Overlay
  'brand.brand_overview': { en: 'Client Overview', it: 'Client Overview', fr: 'Vue client', es: 'Vista del cliente', zh: '客户概览' },
  'brand.holding_overview': { en: 'Group Overview', it: 'Group Overview', fr: 'Vue groupe', es: 'Vista del grupo', zh: '集团概览' },
  'brand.data_available': { en: 'Data available', it: 'Dati disponibili', fr: 'Données disponibles', es: 'Datos disponibles', zh: '数据可用' },
  'brand.no_data': { en: 'No data', it: 'Nessun dato', fr: 'Aucune donnée', es: 'Sin datos', zh: '无数据' },
  'brand.sites_online': { en: 'Sites Online', it: 'Siti Online', fr: 'Sites en ligne', es: 'Sitios en línea', zh: '在线站点' },
  'brand.kwh_7d': { en: 'kWh (30d)', it: 'kWh (30gg)', fr: 'kWh (30j)', es: 'kWh (30d)', zh: 'kWh（30天）' },
  'brand.active_alerts': { en: 'Active Alerts', it: 'Alert Attivi', fr: 'Alertes actives', es: 'Alertas activas', zh: '活跃警报' },
  'brand.hide_charts': { en: 'Hide Charts', it: 'Nascondi Grafici', fr: 'Masquer les graphiques', es: 'Ocultar gráficos', zh: '隐藏图表' },
  'brand.show_charts': { en: 'Show Charts', it: 'Mostra Grafici', fr: 'Afficher les graphiques', es: 'Mostrar gráficos', zh: '显示图表' },
  'brand.no_active_modules': { en: 'No sites with active modules and available data', it: 'Nessun sito con moduli attivi e dati disponibili', fr: 'Aucun site avec des modules actifs et des données disponibles', es: 'No hay sitios con módulos activos y datos disponibles', zh: '没有具有活跃模块和可用数据的站点' },
  'brand.energy_consumption': { en: 'Energy Consumption (kWh, 30d)', it: 'Energy Consumption (kWh, 30gg)', fr: 'Consommation énergétique (kWh, 30j)', es: 'Consumo energético (kWh, 30d)', zh: '能耗 (kWh, 30天)' },
  'brand.air_quality': { en: 'Air Quality (CO₂ ppm)', it: 'Air Quality (CO₂ ppm)', fr: "Qualité de l'air (CO₂ ppm)", es: 'Calidad del aire (CO₂ ppm)', zh: '空气质量 (CO₂ ppm)' },
  'brand.performance_comparison': { en: 'Performance Comparison', it: 'Confronto Prestazioni', fr: 'Comparaison des performances', es: 'Comparación de rendimiento', zh: '性能对比' },
  'brand.consumption_breakdown': { en: 'Consumption Breakdown', it: 'Distribuzione Consumi', fr: 'Répartition de la consommation', es: 'Desglose de consumo', zh: '消耗明细' },

  // User Account Dropdown
  'account.company': { en: 'Company', it: 'Azienda', fr: 'Entreprise', es: 'Empresa', zh: '公司' },
  'account.system_role': { en: 'System Role', it: 'Ruolo Sistema', fr: 'Rôle système', es: 'Rol del sistema', zh: '系统角色' },
  'account.edit_profile': { en: 'Edit Profile', it: 'Modifica Profilo', fr: 'Modifier le profil', es: 'Editar perfil', zh: '编辑资料' },
  'account.logout': { en: 'Log out', it: 'Esci', fr: 'Déconnexion', es: 'Cerrar sesión', zh: '退出登录' },
  'account.click_upload': { en: 'Click to upload an image', it: "Clicca per caricare un'immagine", fr: 'Cliquez pour télécharger une image', es: 'Haz clic para subir una imagen', zh: '点击上传图片' },
  'account.first_name': { en: 'First Name', it: 'Nome', fr: 'Prénom', es: 'Nombre', zh: '名' },
  'account.last_name': { en: 'Last Name', it: 'Cognome', fr: 'Nom', es: 'Apellido', zh: '姓' },
  'account.role': { en: 'Role', it: 'Ruolo', fr: 'Rôle', es: 'Rol', zh: '角色' },
  'account.phone': { en: 'Phone', it: 'Telefono', fr: 'Téléphone', es: 'Teléfono', zh: '电话' },
  'account.cancel': { en: 'Cancel', it: 'Annulla', fr: 'Annuler', es: 'Cancelar', zh: '取消' },
  'account.save': { en: 'Save', it: 'Salva', fr: 'Enregistrer', es: 'Guardar', zh: '保存' },
  'account.email_placeholder': { en: 'email@example.com', it: 'email@esempio.com', fr: 'email@exemple.com', es: 'correo@ejemplo.com', zh: 'email@example.com' },
  'account.first_name_placeholder': { en: 'First name', it: 'Nome', fr: 'Prénom', es: 'Nombre', zh: '名' },
  'account.last_name_placeholder': { en: 'Last name', it: 'Cognome', fr: 'Nom', es: 'Apellido', zh: '姓' },
  'account.company_placeholder': { en: 'Company name', it: 'Nome azienda', fr: "Nom de l'entreprise", es: 'Nombre de la empresa', zh: '公司名称' },
  'account.role_placeholder': { en: 'e.g. Energy Manager', it: 'Es. Energy Manager', fr: 'Ex. Energy Manager', es: 'Ej. Energy Manager', zh: '例如 能源经理' },

  // Admin
  'admin.search_hierarchy': { en: 'Search hierarchy...', it: 'Cerca nella gerarchia...', fr: 'Rechercher dans la hiérarchie...', es: 'Buscar en la jerarquía...', zh: '搜索层级...' },
  'admin.no_project': { en: 'No project', it: 'Nessun progetto', fr: 'Aucun projet', es: 'Ningún proyecto', zh: '无项目' },
  'admin.no_site': { en: 'No site', it: 'Nessun site', fr: 'Aucun site', es: 'Ningún sitio', zh: '无站点' },
  'admin.no_brand': { en: 'No brand', it: 'Nessun brand', fr: 'Aucune marque', es: 'Ninguna marca', zh: '无品牌' },
  'admin.no_result': { en: 'No result found', it: 'Nessun risultato trovato', fr: 'Aucun résultat trouvé', es: 'No se encontraron resultados', zh: '未找到结果' },
  'admin.no_holding': { en: 'No holding present', it: 'Nessuna holding presente', fr: 'Aucun groupe présent', es: 'Ningún grupo presente', zh: '无集团' },
  'admin.search_user': { en: 'Search user...', it: 'Cerca utente...', fr: 'Rechercher un utilisateur...', es: 'Buscar usuario...', zh: '搜索用户...' },

  // Diagnosis
  'diagnosis.generating': { en: 'Generating AI diagnosis...', it: 'Generazione diagnosi AI...', fr: 'Génération du diagnostic IA...', es: 'Generando diagnóstico IA...', zh: '正在生成 AI 诊断...' },

  // Overview cards
  'overview.overall_performance': { en: 'OVERALL PERFORMANCE', it: 'PERFORMANCE GENERALE', fr: 'PERFORMANCE GLOBALE', es: 'RENDIMIENTO GENERAL', zh: '整体性能' },
  'overview.energy_performance': { en: 'ENERGY PERFORMANCE', it: 'PERFORMANCE ENERGETICA', fr: 'PERFORMANCE ÉNERGÉTIQUE', es: 'RENDIMIENTO ENERGÉTICO', zh: '能源性能' },
  'overview.indoor_air_quality': { en: 'INDOOR AIR QUALITY', it: 'QUALITÀ ARIA INTERNA', fr: "QUALITÉ DE L'AIR INTÉRIEUR", es: 'CALIDAD DEL AIRE INTERIOR', zh: '室内空气质量' },
  'overview.water_consumption_title': { en: 'WATER CONSUMPTION', it: 'CONSUMO IDRICO', fr: "CONSOMMATION D'EAU", es: 'CONSUMO DE AGUA', zh: '用水量' },
  'overview.monitored_params': { en: 'Monitored Parameters', it: 'Parametri Monitorati', fr: 'Paramètres surveillés', es: 'Parámetros monitoreados', zh: '监控参数' },
  'overview.efficiency': { en: 'Efficiency', it: 'Efficienza', fr: 'Efficacité', es: 'Eficiencia', zh: '效率' },
  'overview.active_leaks': { en: 'Active Leaks', it: 'Perdite Attive', fr: 'Fuites actives', es: 'Fugas activas', zh: '活跃漏水' },
  'overview.l_day': { en: 'L/day', it: 'L/giorno', fr: 'L/jour', es: 'L/día', zh: '升/天' },
  'overview.vs_baseline': { en: 'vs baseline', it: 'vs baseline', fr: 'vs référence', es: 'vs referencia', zh: '较基线' },
  'overview.vs_last_period': { en: 'vs last period', it: 'vs periodo prec.', fr: 'vs période préc.', es: 'vs período ant.', zh: '较上期' },
  'overview.score': { en: 'Score', it: 'Punteggio', fr: 'Score', es: 'Puntuación', zh: '评分' },

  // ProjectDetail
  'pd.back_to_region': { en: 'Back to Region', it: 'Torna alla Regione', fr: 'Retour à la région', es: 'Volver a la región', zh: '返回区域' },
  'pd.change_bg': { en: 'Change Background', it: 'Cambia Sfondo', fr: "Changer l'arrière-plan", es: 'Cambiar fondo', zh: '更换背景' },
  'pd.export_pdf': { en: 'Export PDF', it: 'Esporta PDF', fr: 'Exporter PDF', es: 'Exportar PDF', zh: '导出 PDF' },
  'pd.project_settings': { en: 'Project Settings', it: 'Impostazioni Progetto', fr: 'Paramètres du projet', es: 'Configuración del proyecto', zh: '项目设置' },
  'pd.energy_over_time': { en: 'Energy consumption over time', it: 'Consumo energetico nel tempo', fr: "Consommation d'énergie dans le temps", es: 'Consumo energético en el tiempo', zh: '能耗趋势' },
  'pd.daily_energy_kwh': { en: 'Daily Energy (kWh)', it: 'Energia Giornaliera (kWh)', fr: 'Énergie journalière (kWh)', es: 'Energía diaria (kWh)', zh: '每日能耗 (kWh)' },
  'pd.avg_power_kw': { en: 'Average Power (kW)', it: 'Potenza Media (kW)', fr: 'Puissance moyenne (kW)', es: 'Potencia media (kW)', zh: '平均功率 (kW)' },
  'pd.categories': { en: 'Categories', it: 'Categorie', fr: 'Catégories', es: 'Categorías', zh: '类别' },
  'pd.devices': { en: 'Devices', it: 'Dispositivi', fr: 'Appareils', es: 'Dispositivos', zh: '设备' },
  'pd.energy_breakdown': { en: 'Energy consumption breakdown', it: 'Distribuzione consumi energetici', fr: 'Répartition de la consommation énergétique', es: 'Desglose de consumo energético', zh: '能耗分类明细' },
  'pd.total_kwh': { en: 'Total kWh', it: 'kWh Totali', fr: 'kWh totaux', es: 'kWh totales', zh: '总 kWh' },
  'pd.energy_density': { en: 'Energy Density', it: 'Densità Energetica', fr: 'Densité énergétique', es: 'Densidad energética', zh: '能量密度' },
  'pd.in_selected_period': { en: 'in the selected period', it: 'nel periodo selezionato', fr: 'dans la période sélectionnée', es: 'en el período seleccionado', zh: '所选期间内' },
  'pd.estimated_cost': { en: 'Estimated Cost', it: 'Costo Stimato', fr: 'Coût estimé', es: 'Costo estimado', zh: '预估费用' },
  'pd.consumption_price': { en: 'Consumption', it: 'Consumo', fr: 'Consommation', es: 'Consumo', zh: '消耗' },
  'pd.price_not_configured': { en: 'Energy price not configured', it: 'Prezzo energia non configurato', fr: "Prix de l'énergie non configuré", es: 'Precio de energía no configurado', zh: '未配置能源价格' },
  'pd.rating': { en: 'rating', it: 'valutazione', fr: 'évaluation', es: 'calificación', zh: '评级' },
  'pd.anomalies': { en: 'anomalies', it: 'anomalie', fr: 'anomalies', es: 'anomalías', zh: '异常' },
  'pd.attention': { en: '⚠ Attention', it: '⚠ Attenzione', fr: '⚠ Attention', es: '⚠ Atención', zh: '⚠ 注意' },
  'pd.site_alerts': { en: 'Site Alerts', it: 'Alert Sito', fr: 'Alertes du site', es: 'Alertas del sitio', zh: '站点警报' },
  'pd.open_now': { en: 'Open now', it: 'Aperti ora', fr: 'Ouverts maintenant', es: 'Abiertos ahora', zh: '当前未解决' },
  'pd.opened_last_7_days': { en: 'Opened in last 7 days', it: 'Aperti negli ultimi 7 giorni', fr: 'Ouverts ces 7 derniers jours', es: 'Abiertos en los últimos 7 días', zh: '最近7天打开' },
  'pd.heatmap': { en: 'Energy Consumption Heatmap', it: 'Heatmap Consumi Energetici', fr: 'Carte thermique de consommation énergétique', es: 'Mapa de calor de consumo energético', zh: '能耗热力图' },
  'pd.actual_vs_average': { en: 'Actual vs Average', it: 'Effettivo vs Media', fr: 'Réel vs Moyenne', es: 'Real vs Promedio', zh: '实际 vs 平均' },
  'pd.power_consumption': { en: 'Power Consumption', it: 'Consumo Potenza', fr: 'Consommation de puissance', es: 'Consumo de potencia', zh: '功率消耗' },
  'pd.realtime_kw': { en: 'Real-time (kW)', it: 'Tempo reale (kW)', fr: 'Temps réel (kW)', es: 'Tiempo real (kW)', zh: '实时 (kW)' },
  'pd.devices_consumption': { en: 'Devices Consumption', it: 'Consumi per Dispositivo', fr: 'Consommation par appareil', es: 'Consumo por dispositivo', zh: '设备消耗' },
  'pd.breakdown_by': { en: 'Breakdown by', it: 'Suddivisione per', fr: 'Répartition par', es: 'Desglose por', zh: '按分类' },
  'pd.category': { en: 'Category', it: 'Categoria', fr: 'Catégorie', es: 'Categoría', zh: '类别' },
  'pd.device': { en: 'Device', it: 'Dispositivo', fr: 'Appareil', es: 'Dispositivo', zh: '设备' },
  'pd.carbon_footprint': { en: 'Carbon Footprint Analysis', it: 'Analisi Impronta CO₂', fr: 'Analyse empreinte carbone', es: 'Análisis de huella de carbono', zh: '碳足迹分析' },
  'pd.monthly_comparison': { en: 'Monthly Comparison (Year vs Year)', it: 'Confronto Mensile (Anno vs Anno)', fr: 'Comparaison mensuelle (Année vs Année)', es: 'Comparación mensual (Año vs Año)', zh: '月度对比（年 vs 年）' },
  'pd.weekly_breakdown': { en: 'Weekly Breakdown (Month vs Month)', it: 'Suddivisione Settimanale (Mese vs Mese)', fr: 'Répartition hebdomadaire (Mois vs Mois)', es: 'Desglose semanal (Mes vs Mes)', zh: '每周明细（月 vs 月）' },
  'pd.daily_profile': { en: 'Daily Profile (Week vs Week)', it: 'Profilo Giornaliero (Settimana vs Settimana)', fr: 'Profil journalier (Semaine vs Semaine)', es: 'Perfil diario (Semana vs Semana)', zh: '每日概况（周 vs 周）' },
  'pd.hourly_emissions': { en: 'Hourly Emissions', it: 'Emissioni Orarie', fr: 'Émissions horaires', es: 'Emisiones por hora', zh: '每小时排放' },
  'pd.energy_trend': { en: 'Energy Trend', it: 'Trend Energetico', fr: 'Tendance énergétique', es: 'Tendencia energética', zh: '能源趋势' },
  'pd.cumulative_kwh': { en: 'Cumulative kWh by category', it: 'kWh cumulativi per categoria', fr: 'kWh cumulés par catégorie', es: 'kWh acumulados por categoría', zh: '按类别累计 kWh' },
  'pd.energy_vs_outdoor': { en: 'Energy vs Outdoor', it: 'Energia vs Esterno', fr: 'Énergie vs Extérieur', es: 'Energía vs Exterior', zh: '能耗 vs 室外' },
  'pd.energy_periods': { en: 'Energy Periods', it: 'Periodi Energetici', fr: 'Périodes énergétiques', es: 'Períodos energéticos', zh: '能源时段' },
  'pd.no_data_year': { en: 'No data available for', it: 'Nessun dato disponibile per il', fr: 'Aucune donnée disponible pour', es: 'No hay datos disponibles para', zh: '无可用数据：' },

  // Air dashboard
  'pd.co2_trend': { en: 'CO₂ Trend', it: 'Trend CO₂', fr: 'Tendance CO₂', es: 'Tendencia CO₂', zh: 'CO₂ 趋势' },
  'pd.tvoc_trend': { en: 'TVOC Trend', it: 'Trend TVOC', fr: 'Tendance TVOC', es: 'Tendencia TVOC', zh: 'TVOC 趋势' },
  'pd.temp_humidity': { en: 'Temperature & Relative Humidity', it: 'Temperatura & Umidità Relativa', fr: 'Température & Humidité relative', es: 'Temperatura y Humedad relativa', zh: '温度与相对湿度' },
  'pd.pm25_fine': { en: 'PM2.5 - Fine Particulate', it: 'PM2.5 - Particolato Fine', fr: 'PM2.5 - Particules fines', es: 'PM2.5 - Partículas finas', zh: 'PM2.5 - 细颗粒物' },
  'pd.pm10_coarse': { en: 'PM10 - Coarse Particulate', it: 'PM10 - Particolato Grossolano', fr: 'PM10 - Particules grossières', es: 'PM10 - Partículas gruesas', zh: 'PM10 - 粗颗粒物' },
  'pd.co_o3_title': { en: 'Carbon Monoxide (CO) & Ozone (O₃)', it: 'Monossido di Carbonio (CO) & Ozono (O₃)', fr: 'Monoxyde de carbone (CO) & Ozone (O₃)', es: 'Monóxido de carbono (CO) y Ozono (O₃)', zh: '一氧化碳 (CO) 与 臭氧 (O₃)' },
  'pd.who_limit': { en: 'WHO Limit', it: 'Limite OMS', fr: 'Limite OMS', es: 'Límite OMS', zh: 'WHO 限值' },
  'pd.safety_limit': { en: 'Safety limit', it: 'Limite sicurezza', fr: 'Limite de sécurité', es: 'Límite de seguridad', zh: '安全限值' },
  'pd.limit': { en: 'Limit', it: 'Limite', fr: 'Limite', es: 'Límite', zh: '限值' },
  'pd.quality_excellent': { en: 'Excellent', it: 'Ottimo', fr: 'Excellent', es: 'Excelente', zh: '优秀' },
  'pd.quality_moderate': { en: 'Moderate', it: 'Moderato', fr: 'Modéré', es: 'Moderado', zh: '中等' },
  'pd.quality_poor': { en: 'Poor', it: 'Scarso', fr: 'Mauvais', es: 'Deficiente', zh: '较差' },
  'pd.indoor': { en: 'Indoor', it: 'Indoor', fr: 'Intérieur', es: 'Interior', zh: '室内' },
  'pd.outdoor': { en: 'Outdoor', it: 'Outdoor', fr: 'Extérieur', es: 'Exterior', zh: '室外' },
  'pd.daily_trend': { en: 'Daily trend', it: 'Trend giornaliero', fr: 'Tendance journalière', es: 'Tendencia diaria', zh: '每日趋势' },

  // Water dashboard
  'pd.water_consumption': { en: 'Water Consumption', it: 'Consumo Idrico', fr: "Consommation d'eau", es: 'Consumo de agua', zh: '用水量' },
  'pd.current_year': { en: 'Current Year', it: 'Anno Corrente', fr: 'Année en cours', es: 'Año actual', zh: '本年度' },
  'pd.previous_year': { en: 'Previous Year', it: 'Anno Precedente', fr: 'Année précédente', es: 'Año anterior', zh: '上一年度' },
  'pd.total_consumption': { en: 'Total Consumption', it: 'Consumo Totale', fr: 'Consommation totale', es: 'Consumo total', zh: '总消耗' },
  'pd.leak_detection': { en: 'Leak Detection', it: 'Rilevamento Perdite', fr: 'Détection de fuites', es: 'Detección de fugas', zh: '漏水检测' },
  'pd.critical_zones': { en: 'Critical zones monitoring', it: 'Monitoraggio zone critiche', fr: 'Surveillance des zones critiques', es: 'Monitoreo de zonas críticas', zh: '关键区域监控' },
  'pd.no_anomaly': { en: 'No anomaly', it: 'Nessuna anomalia', fr: 'Aucune anomalie', es: 'Sin anomalías', zh: '无异常' },
  'pd.detected': { en: 'Detected', it: 'Rilevato', fr: 'Détecté', es: 'Detectado', zh: '已检测' },
  'pd.leak_rate': { en: 'leak rate', it: 'tasso perdita', fr: 'taux de fuite', es: 'tasa de fuga', zh: '泄漏率' },
  'pd.daily_consumption_trend': { en: 'Daily Consumption Trend', it: 'Trend Consumo Giornaliero', fr: 'Tendance de consommation journalière', es: 'Tendencia de consumo diario', zh: '每日消耗趋势' },
  'pd.peaks_hourly': { en: 'Peaks and hourly consumption', it: 'Picchi e consumi orari', fr: 'Pics et consommation horaire', es: 'Picos y consumo por hora', zh: '峰值与每小时消耗' },
  'pd.weekly_efficiency': { en: 'Weekly Efficiency', it: 'Efficienza Settimanale', fr: 'Efficacité hebdomadaire', es: 'Eficiencia semanal', zh: '每周效率' },
  'pd.usage_waste_ratio': { en: 'Usage/waste ratio', it: 'Rapporto utilizzo/spreco', fr: 'Ratio utilisation/gaspillage', es: 'Ratio uso/desperdicio', zh: '使用/浪费比率' },
  'pd.water_quality': { en: 'Water Quality Parameters', it: 'Parametri Qualità Acqua', fr: "Paramètres de qualité de l'eau", es: 'Parámetros de calidad del agua', zh: '水质参数' },
  'pd.ph_subtitle': { en: 'pH, Turbidity, Residual Chlorine', it: 'pH, Torbidità, Cloro residuo', fr: 'pH, Turbidité, Chlore résiduel', es: 'pH, Turbidez, Cloro residual', zh: 'pH、浊度、余氯' },
  'pd.ph_acidity': { en: 'pH - Acidity', it: 'pH - Acidità', fr: 'pH - Acidité', es: 'pH - Acidez', zh: 'pH - 酸度' },
  'pd.current_value': { en: 'current value', it: 'valore attuale', fr: 'valeur actuelle', es: 'valor actual', zh: '当前值' },
  'pd.optimal_range': { en: 'Optimal range', it: 'Range ottimale', fr: 'Plage optimale', es: 'Rango óptimo', zh: '最佳范围' },
  'pd.optimal': { en: 'Optimal', it: 'Ottimale', fr: 'Optimal', es: 'Óptimo', zh: '最佳' },
  'pd.acidic': { en: 'Acidic (6)', it: 'Acido (6)', fr: 'Acide (6)', es: 'Ácido (6)', zh: '酸性 (6)' },
  'pd.neutral': { en: 'Neutral (7)', it: 'Neutro (7)', fr: 'Neutre (7)', es: 'Neutro (7)', zh: '中性 (7)' },
  'pd.basic': { en: 'Basic (9)', it: 'Basico (9)', fr: 'Basique (9)', es: 'Básico (9)', zh: '碱性 (9)' },
  'pd.turbidity': { en: 'Turbidity', it: 'Torbidità', fr: 'Turbidité', es: 'Turbidez', zh: '浊度' },
  'pd.ntu_current': { en: 'NTU (current)', it: 'NTU (attuale)', fr: 'NTU (actuel)', es: 'NTU (actual)', zh: 'NTU（当前）' },
  'pd.excellent': { en: 'Excellent', it: 'Eccellente', fr: 'Excellent', es: 'Excelente', zh: '优秀' },
  'pd.residual_chlorine': { en: 'Residual Chlorine', it: 'Cloro Residuo', fr: 'Chlore résiduel', es: 'Cloro residual', zh: '余氯' },
  'pd.mgl_current': { en: 'mg/L (current)', it: 'mg/L (attuale)', fr: 'mg/L (actuel)', es: 'mg/L (actual)', zh: 'mg/L（当前）' },
  'pd.ideal_range': { en: 'Ideal range', it: 'Range ideale', fr: 'Plage idéale', es: 'Rango ideal', zh: '理想范围' },
  'pd.in_range': { en: 'In range', it: 'Nel range', fr: 'Dans la plage', es: 'Dentro del rango', zh: '在范围内' },
  'pd.water_temperature': { en: 'Water Temperature', it: 'Temperatura Acqua', fr: "Température de l'eau", es: 'Temperatura del agua', zh: '水温' },
  'pd.c_current': { en: '°C (current)', it: '°C (attuale)', fr: '°C (actuel)', es: '°C (actual)', zh: '°C（当前）' },
  'pd.comfort_range': { en: 'Comfort range', it: 'Range comfort', fr: 'Plage de confort', es: 'Rango de confort', zh: '舒适范围' },
  'pd.ideal': { en: 'Ideal', it: 'Ideale', fr: 'Idéal', es: 'Ideal', zh: '理想' },

  // Heatmap legend
  'pd.hm_excellent': { en: 'Excellent', it: 'Ottimo', fr: 'Excellent', es: 'Excelente', zh: '优秀' },
  'pd.hm_good': { en: 'Good', it: 'Buono', fr: 'Bon', es: 'Bueno', zh: '良好' },
  'pd.hm_moderate': { en: 'Moderate', it: 'Moderato', fr: 'Modéré', es: 'Moderado', zh: '中等' },
  'pd.hm_high': { en: 'High', it: 'Elevato', fr: 'Élevé', es: 'Elevado', zh: '较高' },
  'pd.hm_critical': { en: 'Critical', it: 'Critico', fr: 'Critique', es: 'Crítico', zh: '严重' },

  // Site Alerts widget
  'pd.site_alerts.critical': { en: 'Critical', it: 'Critici', fr: 'Critiques', es: 'Críticos', zh: '严重' },
  'pd.site_alerts.medium': { en: 'Medium', it: 'Medi', fr: 'Moyens', es: 'Medios', zh: '中等' },
  'pd.site_alerts.low': { en: 'Low', it: 'Bassi', fr: 'Faibles', es: 'Bajos', zh: '低' },
  'pd.site_alerts.all_clear': { en: 'All clear', it: 'Tutto OK', fr: 'Tout est OK', es: 'Todo OK', zh: '一切正常' },
  'pd.site_alerts.back': { en: 'Back', it: 'Indietro', fr: 'Retour', es: 'Volver', zh: '返回' },
  'pd.site_alerts.no_alerts': { en: 'No alerts in this category', it: 'Nessun alert in questa categoria', fr: 'Aucune alerte dans cette catégorie', es: 'No hay alertas en esta categoría', zh: '此类别无警报' },
  'pd.site_alerts.device_offline': { en: 'Offline', it: 'Offline', fr: 'Hors ligne', es: 'Sin conexión', zh: '离线' },
  'pd.site_alerts.device_offline_msg': { en: 'No data for > 24h', it: 'Nessun dato da > 24h', fr: 'Pas de données depuis > 24h', es: 'Sin datos desde hace > 24h', zh: '超过24小时无数据' },
  'pd.site_alerts.site_stale': { en: 'Site offline (> 24h)', it: 'Sito offline (> 24h)', fr: 'Site hors ligne (> 24h)', es: 'Sitio sin conexión (> 24h)', zh: '站点离线（> 24小时）' },
  'pd.site_alerts.site_stale_msg': { en: 'No telemetry received from any device for over 24 hours', it: 'Nessuna telemetria ricevuta da alcun dispositivo per oltre 24 ore', fr: "Aucune télémétrie reçue d'aucun appareil depuis plus de 24 heures", es: 'No se ha recibido telemetría de ningún dispositivo en más de 24 horas', zh: '超过24小时未从任何设备接收到遥测数据' },
  'pd.site_alerts.timestamp': { en: 'Timestamp', it: 'Timestamp', fr: 'Horodatage', es: 'Marca de tiempo', zh: '时间戳' },
  'pd.site_alerts.metric': { en: 'Metric', it: 'Metrica', fr: 'Métrique', es: 'Métrica', zh: '指标' },
  'pd.site_alerts.device': { en: 'Device', it: 'Dispositivo', fr: 'Appareil', es: 'Dispositivo', zh: '设备' },
  'pd.site_alerts.description': { en: 'Description', it: 'Descrizione', fr: 'Description', es: 'Descripción', zh: '描述' },
  'pd.site_alerts.last_seen': { en: 'Last seen', it: 'Ultimo dato', fr: 'Dernière activité', es: 'Última actividad', zh: '最后在线' },

  // Certification
  'pd.points_obtained': { en: 'Points obtained', it: 'Punti ottenuti', fr: 'Points obtenus', es: 'Puntos obtenidos', zh: '获得分数' },
  'pd.certified_since': { en: 'Certified since 2023', it: 'Certificato dal 2023', fr: 'Certifié depuis 2023', es: 'Certificado desde 2023', zh: '自2023年起认证' },
  'pd.renewal': { en: 'Renewal: Dec 2025', it: 'Rinnovo: Dic 2025', fr: 'Renouvellement : Déc 2025', es: 'Renovación: Dic 2025', zh: '续期：2025年12月' },

  // Loading resources
  'pd.loading_resources': { en: 'Loading resources...', it: 'Caricamento Risorse...', fr: 'Chargement des ressources...', es: 'Cargando recursos...', zh: '正在加载资源...' },

  // No data
  'pd.no_data': { en: 'No data available', it: 'Nessun dato disponibile', fr: 'Aucune donnée disponible', es: 'No hay datos disponibles', zh: '暂无数据' },
  'pd.no_realtime_data': { en: 'No real-time data', it: 'Nessun dato in tempo reale', fr: 'Aucune donnée en temps réel', es: 'Sin datos en tiempo real', zh: '无实时数据' },

  // Time period selector
  'time.today': { en: 'Today', it: 'Oggi', fr: "Aujourd'hui", es: 'Hoy', zh: '今天' },
  'time.week': { en: 'Week', it: 'Settimana', fr: 'Semaine', es: 'Semana', zh: '本周' },
  'time.month': { en: 'Month', it: 'Mese', fr: 'Mois', es: 'Mes', zh: '本月' },
  'time.year': { en: 'Year', it: 'Anno', fr: 'Année', es: 'Año', zh: '本年' },
  'time.custom': { en: 'Custom', it: 'Personalizzato', fr: 'Personnalisé', es: 'Personalizado', zh: '自定义' },
  'time.custom_ellipsis': { en: 'Custom...', it: 'Personalizzato...', fr: 'Personnalisé...', es: 'Personalizado...', zh: '自定义...' },
  'time.select_date_range': { en: 'Select date range', it: 'Seleziona intervallo date', fr: 'Sélectionner une plage de dates', es: 'Seleccionar rango de fechas', zh: '选择日期范围' },
  'time.cancel': { en: 'Cancel', it: 'Annulla', fr: 'Annuler', es: 'Cancelar', zh: '取消' },
  'time.apply': { en: 'Apply', it: 'Applica', fr: 'Appliquer', es: 'Aplicar', zh: '应用' },
  'time.dates': { en: 'Dates', it: 'Date', fr: 'Dates', es: 'Fechas', zh: '日期' },

  // Access Request form
  'auth.request_access': { en: 'Request Access', it: 'Richiedi Accesso', fr: "Demander l'accès", es: 'Solicitar Acceso', zh: '申请访问' },
  'auth.request_subtitle': { en: 'Fill out the form to request access to FGB Studio', it: 'Compila il modulo per richiedere accesso a FGB Studio', fr: "Remplissez le formulaire pour demander l'accès à FGB Studio", es: 'Completa el formulario para solicitar acceso a FGB Studio', zh: '填写表格以申请访问 FGB Studio' },
  'auth.first_name': { en: 'First Name', it: 'Nome', fr: 'Prénom', es: 'Nombre', zh: '名' },
  'auth.last_name': { en: 'Last Name', it: 'Cognome', fr: 'Nom', es: 'Apellido', zh: '姓' },
  'auth.company': { en: 'Company', it: 'Azienda', fr: 'Entreprise', es: 'Empresa', zh: '公司' },
  'auth.job_title': { en: 'Job Title', it: 'Ruolo', fr: 'Poste', es: 'Cargo', zh: '职位' },
  'auth.request_message': { en: 'Message (why do you need access?)', it: 'Messaggio (perché hai bisogno dell\'accesso?)', fr: "Message (pourquoi avez-vous besoin d'un accès ?)", es: 'Mensaje (¿por qué necesitas acceso?)', zh: '留言（您为什么需要访问？）' },
  'auth.request_message_placeholder': { en: 'Briefly describe why you need access to the platform...', it: 'Descrivi brevemente perché hai bisogno di accedere alla piattaforma...', fr: "Décrivez brièvement pourquoi vous avez besoin d'accéder à la plateforme...", es: 'Describe brevemente por qué necesitas acceder a la plataforma...', zh: '请简要描述您为什么需要访问该平台...' },
  'auth.submit_request': { en: 'Submit Request', it: 'Invia Richiesta', fr: 'Envoyer la demande', es: 'Enviar Solicitud', zh: '提交申请' },
  'auth.request_sent': { en: 'Request submitted successfully! You will receive an email once your request is approved.', it: 'Richiesta inviata con successo! Riceverai un\'email una volta che la tua richiesta sarà approvata.', fr: 'Demande envoyée avec succès ! Vous recevrez un e-mail une fois votre demande approuvée.', es: '¡Solicitud enviada con éxito! Recibirás un correo cuando tu solicitud sea aprobada.', zh: '申请已成功提交！您的申请获批后将收到电子邮件通知。' },
  'auth.request_error': { en: 'Error submitting request. Please try again.', it: 'Errore nell\'invio della richiesta. Riprova.', fr: "Erreur lors de l'envoi de la demande. Veuillez réessayer.", es: 'Error al enviar la solicitud. Inténtalo de nuevo.', zh: '提交申请时出错，请重试。' },
  'auth.first_name_required': { en: 'First name is required', it: 'Il nome è obbligatorio', fr: 'Le prénom est requis', es: 'El nombre es obligatorio', zh: '请填写名字' },
  'auth.last_name_required': { en: 'Last name is required', it: 'Il cognome è obbligatorio', fr: 'Le nom est requis', es: 'El apellido es obligatorio', zh: '请填写姓氏' },
  'auth.company_required': { en: 'Company is required', it: "L'azienda è obbligatoria", fr: "L'entreprise est requise", es: 'La empresa es obligatoria', zh: '请填写公司名称' },
  'auth.email_required': { en: 'Business email is required', it: "L'email aziendale è obbligatoria", fr: "L'e-mail professionnel est requis", es: 'El correo corporativo es obligatorio', zh: '请填写企业邮箱' },
  'auth.back_to_login': { en: 'Back to Sign In', it: 'Torna al Login', fr: 'Retour à la connexion', es: 'Volver al inicio de sesión', zh: '返回登录' },

  // Admin access requests
  'admin.access_requests': { en: 'Access Requests', it: 'Richieste di Accesso', fr: "Demandes d'accès", es: 'Solicitudes de Acceso', zh: '访问请求' },
  'admin.access_requests_desc': { en: 'Review and manage access requests from new users', it: 'Revisiona e gestisci le richieste di accesso dei nuovi utenti', fr: "Examinez et gérez les demandes d'accès des nouveaux utilisateurs", es: 'Revisa y gestiona las solicitudes de acceso de nuevos usuarios', zh: '审核和管理新用户的访问请求' },
  'admin.pending': { en: 'Pending', it: 'In attesa', fr: 'En attente', es: 'Pendiente', zh: '待处理' },
  'admin.approved': { en: 'Approved', it: 'Approvata', fr: 'Approuvée', es: 'Aprobada', zh: '已批准' },
  'admin.rejected': { en: 'Rejected', it: 'Rifiutata', fr: 'Refusée', es: 'Rechazada', zh: '已拒绝' },
  'admin.approve': { en: 'Approve', it: 'Approva', fr: 'Approuver', es: 'Aprobar', zh: '批准' },
  'admin.reject': { en: 'Reject', it: 'Rifiuta', fr: 'Refuser', es: 'Rechazar', zh: '拒绝' },
  'admin.no_requests': { en: 'No access requests', it: 'Nessuna richiesta di accesso', fr: "Aucune demande d'accès", es: 'Sin solicitudes de acceso', zh: '暂无访问请求' },
  'admin.request_from': { en: 'Request from', it: 'Richiesta da', fr: 'Demande de', es: 'Solicitud de', zh: '来自' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('fgb-language');
    if (stored === 'it' || stored === 'fr' || stored === 'es' || stored === 'zh') return stored as Language;
    return 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('fgb-language', lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    const order: Language[] = ['en', 'it', 'fr', 'es', 'zh'];
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
