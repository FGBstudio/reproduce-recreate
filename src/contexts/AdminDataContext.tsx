import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import {
  AdminHolding,
  AdminBrand,
  AdminSite,
  AdminProject,
  UserMembership,
  defaultProjectModules,
} from '@/lib/types/admin';

interface AdminDataContextType {
  holdings: AdminHolding[];
  brands: AdminBrand[];
  sites: AdminSite[];
  projects: AdminProject[];
  memberships: UserMembership[];
  
  // CRUD operations
  addHolding: (holding: Omit<AdminHolding, 'id' | 'createdAt' | 'updatedAt'>) => AdminHolding;
  updateHolding: (id: string, data: Partial<AdminHolding>) => void;
  deleteHolding: (id: string) => void;
  
  addBrand: (brand: Omit<AdminBrand, 'id' | 'createdAt' | 'updatedAt'>) => AdminBrand;
  updateBrand: (id: string, data: Partial<AdminBrand>) => void;
  deleteBrand: (id: string) => void;
  
  addSite: (site: Omit<AdminSite, 'id' | 'createdAt' | 'updatedAt'>) => AdminSite;
  updateSite: (id: string, data: Partial<AdminSite>) => void;
  deleteSite: (id: string) => void;
  
  addProject: (project: Omit<AdminProject, 'id' | 'createdAt' | 'updatedAt'>) => AdminProject;
  updateProject: (id: string, data: Partial<AdminProject>) => void;
  deleteProject: (id: string) => void;
  
  addMembership: (membership: Omit<UserMembership, 'id' | 'createdAt'>) => UserMembership;
  updateMembership: (id: string, data: Partial<UserMembership>) => void;
  deleteMembership: (id: string) => void;
  
  // Helpers
  getBrandsByHolding: (holdingId: string) => AdminBrand[];
  getSitesByBrand: (brandId: string) => AdminSite[];
  getProjectsBySite: (siteId: string) => AdminProject[];
  getProjectById: (projectId: string) => AdminProject | undefined;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

// Initial mock data
const initialHoldings: AdminHolding[] = [
  { id: 'kering', name: 'Kering', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Kering_Logo.svg/512px-Kering_Logo.svg.png', createdAt: new Date(), updatedAt: new Date() },
  { id: 'lvmh', name: 'LVMH', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/LVMH_logo.svg/512px-LVMH_logo.svg.png', createdAt: new Date(), updatedAt: new Date() },
  { id: 'richemont', name: 'Richemont', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Richemont.svg/512px-Richemont.svg.png', createdAt: new Date(), updatedAt: new Date() },
];

const initialBrands: AdminBrand[] = [
  { id: 'gucci', holdingId: 'kering', name: 'Gucci', createdAt: new Date(), updatedAt: new Date() },
  { id: 'bottega', holdingId: 'kering', name: 'Bottega Veneta', createdAt: new Date(), updatedAt: new Date() },
  { id: 'ysl', holdingId: 'kering', name: 'Saint Laurent', createdAt: new Date(), updatedAt: new Date() },
  { id: 'lv', holdingId: 'lvmh', name: 'Louis Vuitton', createdAt: new Date(), updatedAt: new Date() },
  { id: 'dior', holdingId: 'lvmh', name: 'Dior', createdAt: new Date(), updatedAt: new Date() },
  { id: 'fendi', holdingId: 'lvmh', name: 'Fendi', createdAt: new Date(), updatedAt: new Date() },
  { id: 'cartier', holdingId: 'richemont', name: 'Cartier', createdAt: new Date(), updatedAt: new Date() },
  { id: 'iwc', holdingId: 'richemont', name: 'IWC', createdAt: new Date(), updatedAt: new Date() },
];

const initialSites: AdminSite[] = [
  { id: 'site-1', brandId: 'gucci', name: 'Milan Flagship', address: 'Via Monte Napoleone 5', city: 'Milan', country: 'Italy', region: 'EU', lat: 45.4642, lng: 9.1900, areaSqm: 850, timezone: 'Europe/Rome', createdAt: new Date(), updatedAt: new Date() },
  { id: 'site-2', brandId: 'lv', name: 'Paris Flagship', address: '101 Avenue des Champs-Élysées', city: 'Paris', country: 'France', region: 'EU', lat: 48.8566, lng: 2.3522, areaSqm: 1200, timezone: 'Europe/Paris', createdAt: new Date(), updatedAt: new Date() },
  { id: 'site-3', brandId: 'dior', name: 'NY Soho', address: '155 Mercer St', city: 'New York', country: 'USA', region: 'AMER', lat: 40.7128, lng: -74.0060, areaSqm: 950, timezone: 'America/New_York', createdAt: new Date(), updatedAt: new Date() },
  { id: 'site-4', brandId: 'bottega', name: 'Tokyo Ginza', address: '5 Chome Ginza', city: 'Tokyo', country: 'Japan', region: 'APAC', lat: 35.6762, lng: 139.6503, areaSqm: 720, timezone: 'Asia/Tokyo', createdAt: new Date(), updatedAt: new Date() },
  { id: 'site-5', brandId: 'fendi', name: 'Dubai Mall', address: 'Financial Center Rd', city: 'Dubai', country: 'UAE', region: 'MEA', lat: 25.1972, lng: 55.2744, areaSqm: 1100, timezone: 'Asia/Dubai', createdAt: new Date(), updatedAt: new Date() },
];

const initialProjects: AdminProject[] = [
  { 
    id: 'proj-1', 
    siteId: 'site-1', 
    name: 'Gucci Milan Flagship', 
    status: 'active',
    modules: {
      energy: { ...defaultProjectModules.energy, enabled: true },
      air: { ...defaultProjectModules.air, enabled: true },
      water: { ...defaultProjectModules.water, enabled: true },
    },
    certifications: ['LEED', 'BREEAM'],
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
  { 
    id: 'proj-2', 
    siteId: 'site-2', 
    name: 'Louis Vuitton Paris', 
    status: 'active',
    modules: {
      energy: { ...defaultProjectModules.energy, enabled: true },
      air: { ...defaultProjectModules.air, enabled: true, showDemo: false },
      water: { ...defaultProjectModules.water, enabled: false, showDemo: true },
    },
    certifications: ['WELL'],
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
  { 
    id: 'proj-3', 
    siteId: 'site-3', 
    name: 'Dior NY Soho', 
    status: 'active',
    modules: {
      energy: { ...defaultProjectModules.energy, enabled: true },
      air: { ...defaultProjectModules.air, enabled: false, showDemo: false },
      water: { ...defaultProjectModules.water, enabled: true },
    },
    certifications: ['ENERGY_AUDIT'],
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
  { 
    id: 'proj-4', 
    siteId: 'site-4', 
    name: 'Bottega Veneta Tokyo', 
    status: 'active',
    modules: {
      energy: { ...defaultProjectModules.energy, enabled: true },
      air: { ...defaultProjectModules.air, enabled: true },
      water: { ...defaultProjectModules.water, enabled: true },
    },
    certifications: ['LEED', 'WELL'],
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
  { 
    id: 'proj-5', 
    siteId: 'site-5', 
    name: 'Fendi Dubai Mall', 
    status: 'active',
    modules: {
      energy: { ...defaultProjectModules.energy, enabled: true },
      air: { ...defaultProjectModules.air, enabled: false, showDemo: true },
      water: { ...defaultProjectModules.water, enabled: false, showDemo: false },
    },
    certifications: [],
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
];

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const AdminDataProvider = ({ children }: { children: ReactNode }) => {
  const [holdings, setHoldings] = useState<AdminHolding[]>(initialHoldings);
  const [brands, setBrands] = useState<AdminBrand[]>(initialBrands);
  const [sites, setSites] = useState<AdminSite[]>(initialSites);
  const [projects, setProjects] = useState<AdminProject[]>(initialProjects);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);

  // Holdings CRUD
  const addHolding = useCallback((data: Omit<AdminHolding, 'id' | 'createdAt' | 'updatedAt'>): AdminHolding => {
    const newHolding: AdminHolding = { ...data, id: generateId(), createdAt: new Date(), updatedAt: new Date() };
    setHoldings(prev => [...prev, newHolding]);
    return newHolding;
  }, []);

  const updateHolding = useCallback((id: string, data: Partial<AdminHolding>) => {
    setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...data, updatedAt: new Date() } : h));
  }, []);

  const deleteHolding = useCallback((id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
    // Cascade delete brands
    const brandIds = brands.filter(b => b.holdingId === id).map(b => b.id);
    setBrands(prev => prev.filter(b => b.holdingId !== id));
    // Cascade delete sites
    const siteIds = sites.filter(s => brandIds.includes(s.brandId)).map(s => s.id);
    setSites(prev => prev.filter(s => !brandIds.includes(s.brandId)));
    // Cascade delete projects
    setProjects(prev => prev.filter(p => !siteIds.includes(p.siteId)));
  }, [brands, sites]);

  // Brands CRUD
  const addBrand = useCallback((data: Omit<AdminBrand, 'id' | 'createdAt' | 'updatedAt'>): AdminBrand => {
    const newBrand: AdminBrand = { ...data, id: generateId(), createdAt: new Date(), updatedAt: new Date() };
    setBrands(prev => [...prev, newBrand]);
    return newBrand;
  }, []);

  const updateBrand = useCallback((id: string, data: Partial<AdminBrand>) => {
    setBrands(prev => prev.map(b => b.id === id ? { ...b, ...data, updatedAt: new Date() } : b));
  }, []);

  const deleteBrand = useCallback((id: string) => {
    setBrands(prev => prev.filter(b => b.id !== id));
    const siteIds = sites.filter(s => s.brandId === id).map(s => s.id);
    setSites(prev => prev.filter(s => s.brandId !== id));
    setProjects(prev => prev.filter(p => !siteIds.includes(p.siteId)));
  }, [sites]);

  // Sites CRUD
  const addSite = useCallback((data: Omit<AdminSite, 'id' | 'createdAt' | 'updatedAt'>): AdminSite => {
    const newSite: AdminSite = { ...data, id: generateId(), createdAt: new Date(), updatedAt: new Date() };
    setSites(prev => [...prev, newSite]);
    return newSite;
  }, []);

  const updateSite = useCallback((id: string, data: Partial<AdminSite>) => {
    setSites(prev => prev.map(s => s.id === id ? { ...s, ...data, updatedAt: new Date() } : s));
  }, []);

  const deleteSite = useCallback((id: string) => {
    setSites(prev => prev.filter(s => s.id !== id));
    setProjects(prev => prev.filter(p => p.siteId !== id));
  }, []);

  // Projects CRUD
  const addProject = useCallback((data: Omit<AdminProject, 'id' | 'createdAt' | 'updatedAt'>): AdminProject => {
    const newProject: AdminProject = { ...data, id: generateId(), createdAt: new Date(), updatedAt: new Date() };
    setProjects(prev => [...prev, newProject]);
    return newProject;
  }, []);

  const updateProject = useCallback((id: string, data: Partial<AdminProject>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date() } : p));
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  // Memberships CRUD
  const addMembership = useCallback((data: Omit<UserMembership, 'id' | 'createdAt'>): UserMembership => {
    const newMembership: UserMembership = { ...data, id: generateId(), createdAt: new Date() };
    setMemberships(prev => [...prev, newMembership]);
    return newMembership;
  }, []);

  const updateMembership = useCallback((id: string, data: Partial<UserMembership>) => {
    setMemberships(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
  }, []);

  const deleteMembership = useCallback((id: string) => {
    setMemberships(prev => prev.filter(m => m.id !== id));
  }, []);

  // Helpers
  const getBrandsByHolding = useCallback((holdingId: string) => brands.filter(b => b.holdingId === holdingId), [brands]);
  const getSitesByBrand = useCallback((brandId: string) => sites.filter(s => s.brandId === brandId), [sites]);
  const getProjectsBySite = useCallback((siteId: string) => projects.filter(p => p.siteId === siteId), [projects]);
  const getProjectById = useCallback((projectId: string) => projects.find(p => p.id === projectId), [projects]);

  return (
    <AdminDataContext.Provider value={{
      holdings,
      brands,
      sites,
      projects,
      memberships,
      addHolding, updateHolding, deleteHolding,
      addBrand, updateBrand, deleteBrand,
      addSite, updateSite, deleteSite,
      addProject, updateProject, deleteProject,
      addMembership, updateMembership, deleteMembership,
      getBrandsByHolding, getSitesByBrand, getProjectsBySite, getProjectById,
    }}>
      {children}
    </AdminDataContext.Provider>
  );
};

export const useAdminData = () => {
  const context = useContext(AdminDataContext);
  if (context === undefined) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
};
