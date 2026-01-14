// Admin Types for FGB IoT Dashboard

// User roles
export type UserRole = 'viewer' | 'editor' | 'admin' | 'superuser';

// User representation
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
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
  areaSqm: number;
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

// User access / membership
export type ScopeType = 'project' | 'site' | 'region' | 'brand' | 'holding';
export type Permission = 'view' | 'edit' | 'admin';

export interface UserMembership {
  id: string;
  userId: string;
  scopeType: ScopeType;
  scopeId: string; // ID of the project/site/brand/holding or region code
  permission: Permission;
  createdAt: Date;
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
