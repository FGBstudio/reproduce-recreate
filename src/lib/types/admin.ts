// Admin Types for FGB IoT Dashboard

// User roles (matches database app_role enum)
export type UserRole = 'viewer' | 'editor' | 'admin' | 'superuser';

// Extended user profile (matches profiles table)
export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  company?: string;
  job_title?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

// User representation with role (for UI/context)
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  profile?: UserProfile;
}

// Module configuration
export type ModuleType = 'energy' | 'air' | 'water';

export interface ModuleConfig {
  enabled: boolean;
  showDemo: boolean;
  lockCopy: {
    title: string;
    description: string;
    ctaLabel: string;
    ctaType: 'link' | 'email' | 'whatsapp';
    ctaValue: string;
  };
}

export interface ProjectModules {
  energy: ModuleConfig;
  air: ModuleConfig;
  water: ModuleConfig;
}

// Certification types
export type CertificationType = 'LEED' | 'BREEAM' | 'WELL' | 'ENERGY_AUDIT' | 'ISO_14001' | 'ISO_50001';

// Region values
export type RegionCode = 'EU' | 'AMER' | 'APAC' | 'MEA';

// Extended admin entities
export interface AdminHolding {
  id: string;
  name: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminBrand {
  id: string;
  holdingId: string;
  name: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSite {
  id: string;
  brandId: string;
  name: string;
  address: string;
  city: string;
  country: string;
  region: RegionCode;
  lat: number;
  lng: number;
  areaSqm?: number;
  area_m2?: number; // Alternative naming for area
  energy_price_kwh?: number; // Price per kWh for cost calculations
  imageUrl?: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminProject {
  id: string;
  siteId: string;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  modules: ProjectModules;
  certifications: CertificationType[];
  createdAt: Date;
  updatedAt: Date;
}

// User access / membership (matches database enums)
export type ScopeType = 'project' | 'site' | 'region' | 'brand' | 'holding';
export type Permission = 'view' | 'edit' | 'admin';

export interface UserMembership {
  id: string;
  userId: string;
  scopeType: ScopeType;
  scopeId: string; // ID of the project/site/brand/holding or region code
  permission: Permission;
  allowedRegions: string[] | null; // null/empty = all regions, otherwise restrict to these region codes
  createdAt: Date;
}

// Database user role record
export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

// Default module config
export const defaultModuleConfig: ModuleConfig = {
  enabled: false,
  showDemo: false,
  lockCopy: {
    title: 'Modulo Non Attivo',
    description: 'Questo modulo non è attualmente attivo per il progetto selezionato. Contattaci per attivarlo.',
    ctaLabel: 'Richiedi Attivazione',
    ctaType: 'email',
    ctaValue: 'support@fgb.com',
  },
};

export const defaultProjectModules: ProjectModules = {
  energy: { ...defaultModuleConfig },
  air: { ...defaultModuleConfig },
  water: { ...defaultModuleConfig },
};

// Auth state for context
export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperuser: boolean;
}
