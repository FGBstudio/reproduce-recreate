import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  AdminHolding,
  AdminBrand,
  AdminSite,
  AdminProject,
  UserMembership,
  defaultProjectModules,
  ModuleConfig,
} from '@/lib/types/admin';
import { toast } from 'sonner';

interface AdminDataContextType {
  holdings: AdminHolding[];
  brands: AdminBrand[];
  sites: AdminSite[];
  projects: AdminProject[];
  memberships: UserMembership[];
  loading: boolean;
  
  // CRUD operations
  addHolding: (holding: Omit<AdminHolding, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AdminHolding | null>;
  updateHolding: (id: string, data: Partial<AdminHolding>) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  
  addBrand: (brand: Omit<AdminBrand, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AdminBrand | null>;
  updateBrand: (id: string, data: Partial<AdminBrand>) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  
  addSite: (site: Omit<AdminSite, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AdminSite | null>;
  updateSite: (id: string, data: Partial<AdminSite>) => Promise<void>;
  deleteSite: (id: string) => Promise<void>;
  
  addProject: (project: Omit<AdminProject, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AdminProject | null>;
  updateProject: (id: string, data: Partial<AdminProject>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  addMembership: (membership: Omit<UserMembership, 'id' | 'createdAt'>) => Promise<UserMembership | null>;
  updateMembership: (id: string, data: Partial<UserMembership>) => Promise<void>;
  deleteMembership: (id: string) => Promise<void>;
  
  // Helpers
  getBrandsByHolding: (holdingId: string) => AdminBrand[];
  getSitesByBrand: (brandId: string) => AdminSite[];
  getProjectsBySite: (siteId: string) => AdminProject[];
  getProjectById: (projectId: string) => AdminProject | undefined;
  
  // Refresh
  refreshData: () => Promise<void>;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

// Fallback mock data when Supabase is not configured
const mockHoldings: AdminHolding[] = [
  { id: 'kering', name: 'Kering', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Kering_Logo.svg/512px-Kering_Logo.svg.png', createdAt: new Date(), updatedAt: new Date() },
  { id: 'lvmh', name: 'LVMH', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/LVMH_logo.svg/512px-LVMH_logo.svg.png', createdAt: new Date(), updatedAt: new Date() },
];

const mockBrands: AdminBrand[] = [
  { id: 'gucci', holdingId: 'kering', name: 'Gucci', createdAt: new Date(), updatedAt: new Date() },
  { id: 'lv', holdingId: 'lvmh', name: 'Louis Vuitton', createdAt: new Date(), updatedAt: new Date() },
];

const mockSites: AdminSite[] = [
  { id: 'site-1', brandId: 'gucci', name: 'Milan Flagship', address: 'Via Monte Napoleone 5', city: 'Milan', country: 'Italy', region: 'EU', lat: 45.4642, lng: 9.1900, areaSqm: 850, timezone: 'Europe/Rome', createdAt: new Date(), updatedAt: new Date() },
];

const mockProjects: AdminProject[] = [
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
];

// System site ID for inbox
const INBOX_SITE_ID = '00000000-0000-0000-0000-000000000003';

export const AdminDataProvider = ({ children }: { children: ReactNode }) => {
  const [holdings, setHoldings] = useState<AdminHolding[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data from Supabase
  const fetchAllData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Use mock data
      setHoldings(mockHoldings);
      setBrands(mockBrands);
      setSites(mockSites);
      setProjects(mockProjects);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch holdings
      const { data: holdingsData, error: holdingsError } = await supabase
        .from('holdings')
        .select('*')
        .order('name');
      
      if (holdingsError) throw holdingsError;
      
      const mappedHoldings: AdminHolding[] = (holdingsData || []).map(h => ({
        id: h.id,
        name: h.name,
        logo: h.logo_url,
        createdAt: new Date(h.created_at),
        updatedAt: new Date(h.updated_at),
      }));
      setHoldings(mappedHoldings);

      // Fetch brands
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .order('name');
      
      if (brandsError) throw brandsError;
      
      const mappedBrands: AdminBrand[] = (brandsData || []).map(b => ({
        id: b.id,
        holdingId: b.holding_id,
        name: b.name,
        logo: b.logo_url,
        createdAt: new Date(b.created_at),
        updatedAt: new Date(b.updated_at),
      }));
      setBrands(mappedBrands);

      // Fetch sites (exclude inbox)
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .neq('id', INBOX_SITE_ID)
        .order('name');
      
      if (sitesError) throw sitesError;
      
      const mappedSites: AdminSite[] = (sitesData || []).map(s => ({
        id: s.id,
        brandId: s.brand_id,
        name: s.name,
        address: s.address || '',
        city: s.city || '',
        country: s.country || '',
        region: s.region || 'EU',
        lat: s.lat || 0,
        lng: s.lng || 0,
        areaSqm: s.area_m2 || 0,
        imageUrl: s.image_url,
        timezone: s.timezone || 'UTC',
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
      }));
      setSites(mappedSites);

      // Fetch site configs (projects)
      const { data: configsData, error: configsError } = await supabase
        .from('site_config')
        .select('*, sites!inner(name)')
        .order('created_at');
      
      if (configsError && configsError.code !== 'PGRST116') {
        // Table might not exist yet, use sites as projects
        console.warn('site_config table not found, using sites as projects');
      }
      
      if (configsData) {
        const mappedProjects: AdminProject[] = configsData.map(c => ({
          id: c.id,
          siteId: c.site_id,
          name: c.display_name || (c.sites as any)?.name || 'Unknown',
          status: c.status || 'active',
          modules: c.modules || defaultProjectModules,
          certifications: c.certifications || [],
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at),
        }));
        setProjects(mappedProjects);
      } else {
        // Fallback: create projects from sites
        const siteProjects: AdminProject[] = mappedSites.map(s => ({
          id: `proj-${s.id}`,
          siteId: s.id,
          name: s.name,
          status: 'active',
          modules: { ...defaultProjectModules },
          certifications: [],
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }));
        setProjects(siteProjects);
      }

      // Fetch memberships
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('user_memberships')
        .select('*');
      
      if (!membershipsError && membershipsData) {
        const mappedMemberships: UserMembership[] = membershipsData.map(m => ({
          id: m.id,
          userId: m.user_id,
          scopeType: m.scope_type,
          scopeId: m.scope_id,
          permission: m.permission,
          createdAt: new Date(m.created_at),
        }));
        setMemberships(mappedMemberships);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      // Fallback to mock data on error
      setHoldings(mockHoldings);
      setBrands(mockBrands);
      setSites(mockSites);
      setProjects(mockProjects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Holdings CRUD
  const addHolding = useCallback(async (data: Omit<AdminHolding, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminHolding | null> => {
    if (!isSupabaseConfigured || !supabase) {
      const newHolding: AdminHolding = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      setHoldings(prev => [...prev, newHolding]);
      return newHolding;
    }

    try {
      const { data: inserted, error } = await supabase
        .from('holdings')
        .insert({ name: data.name, logo_url: data.logo })
        .select()
        .single();
      
      if (error) throw error;
      
      const newHolding: AdminHolding = {
        id: inserted.id,
        name: inserted.name,
        logo: inserted.logo_url,
        createdAt: new Date(inserted.created_at),
        updatedAt: new Date(inserted.updated_at),
      };
      setHoldings(prev => [...prev, newHolding]);
      toast.success('Holding creato con successo');
      return newHolding;
    } catch (error: any) {
      console.error('Error adding holding:', error);
      toast.error(`Errore: ${error.message}`);
      return null;
    }
  }, []);

  const updateHolding = useCallback(async (id: string, data: Partial<AdminHolding>) => {
    if (!isSupabaseConfigured || !supabase) {
      setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...data, updatedAt: new Date() } : h));
      return;
    }

    try {
      const { error } = await supabase
        .from('holdings')
        .update({ name: data.name, logo_url: data.logo })
        .eq('id', id);
      
      if (error) throw error;
      
      setHoldings(prev => prev.map(h => h.id === id ? { ...h, ...data, updatedAt: new Date() } : h));
      toast.success('Holding aggiornato');
    } catch (error: any) {
      console.error('Error updating holding:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  const deleteHolding = useCallback(async (id: string) => {
    if (!isSupabaseConfigured || !supabase) {
      setHoldings(prev => prev.filter(h => h.id !== id));
      setBrands(prev => prev.filter(b => b.holdingId !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('holdings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setHoldings(prev => prev.filter(h => h.id !== id));
      setBrands(prev => prev.filter(b => b.holdingId !== id));
      toast.success('Holding eliminato');
    } catch (error: any) {
      console.error('Error deleting holding:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  // Brands CRUD
  const addBrand = useCallback(async (data: Omit<AdminBrand, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminBrand | null> => {
    if (!isSupabaseConfigured || !supabase) {
      const newBrand: AdminBrand = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      setBrands(prev => [...prev, newBrand]);
      return newBrand;
    }

    try {
      const { data: inserted, error } = await supabase
        .from('brands')
        .insert({ 
          holding_id: data.holdingId, 
          name: data.name, 
          logo_url: data.logo 
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newBrand: AdminBrand = {
        id: inserted.id,
        holdingId: inserted.holding_id,
        name: inserted.name,
        logo: inserted.logo_url,
        createdAt: new Date(inserted.created_at),
        updatedAt: new Date(inserted.updated_at),
      };
      setBrands(prev => [...prev, newBrand]);
      toast.success('Brand creato con successo');
      return newBrand;
    } catch (error: any) {
      console.error('Error adding brand:', error);
      toast.error(`Errore: ${error.message}`);
      return null;
    }
  }, []);

  const updateBrand = useCallback(async (id: string, data: Partial<AdminBrand>) => {
    if (!isSupabaseConfigured || !supabase) {
      setBrands(prev => prev.map(b => b.id === id ? { ...b, ...data, updatedAt: new Date() } : b));
      return;
    }

    try {
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.holdingId !== undefined) updateData.holding_id = data.holdingId;
      if (data.logo !== undefined) updateData.logo_url = data.logo;
      
      const { error } = await supabase
        .from('brands')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      setBrands(prev => prev.map(b => b.id === id ? { ...b, ...data, updatedAt: new Date() } : b));
      toast.success('Brand aggiornato');
    } catch (error: any) {
      console.error('Error updating brand:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  const deleteBrand = useCallback(async (id: string) => {
    if (!isSupabaseConfigured || !supabase) {
      setBrands(prev => prev.filter(b => b.id !== id));
      setSites(prev => prev.filter(s => s.brandId !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setBrands(prev => prev.filter(b => b.id !== id));
      setSites(prev => prev.filter(s => s.brandId !== id));
      toast.success('Brand eliminato');
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  // Sites CRUD
  const addSite = useCallback(async (data: Omit<AdminSite, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminSite | null> => {
    if (!isSupabaseConfigured || !supabase) {
      const newSite: AdminSite = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      setSites(prev => [...prev, newSite]);
      return newSite;
    }

    try {
      const { data: inserted, error } = await supabase
        .from('sites')
        .insert({ 
          brand_id: data.brandId,
          name: data.name,
          address: data.address,
          city: data.city,
          country: data.country,
          region: data.region,
          lat: data.lat,
          lng: data.lng,
          area_m2: data.areaSqm,
          image_url: data.imageUrl,
          timezone: data.timezone,
          monitoring_types: ['energy', 'air', 'water'],
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newSite: AdminSite = {
        id: inserted.id,
        brandId: inserted.brand_id,
        name: inserted.name,
        address: inserted.address || '',
        city: inserted.city || '',
        country: inserted.country || '',
        region: inserted.region || 'EU',
        lat: inserted.lat || 0,
        lng: inserted.lng || 0,
        areaSqm: inserted.area_m2 || 0,
        imageUrl: inserted.image_url,
        timezone: inserted.timezone || 'UTC',
        createdAt: new Date(inserted.created_at),
        updatedAt: new Date(inserted.updated_at),
      };
      setSites(prev => [...prev, newSite]);
      toast.success('Site creato con successo');
      return newSite;
    } catch (error: any) {
      console.error('Error adding site:', error);
      toast.error(`Errore: ${error.message}`);
      return null;
    }
  }, []);

  const updateSite = useCallback(async (id: string, data: Partial<AdminSite>) => {
    if (!isSupabaseConfigured || !supabase) {
      setSites(prev => prev.map(s => s.id === id ? { ...s, ...data, updatedAt: new Date() } : s));
      return;
    }

    try {
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.brandId !== undefined) updateData.brand_id = data.brandId;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.city !== undefined) updateData.city = data.city;
      if (data.country !== undefined) updateData.country = data.country;
      if (data.region !== undefined) updateData.region = data.region;
      if (data.lat !== undefined) updateData.lat = data.lat;
      if (data.lng !== undefined) updateData.lng = data.lng;
      if (data.areaSqm !== undefined) updateData.area_m2 = data.areaSqm;
      if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
      if (data.timezone !== undefined) updateData.timezone = data.timezone;
      
      const { error } = await supabase
        .from('sites')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      setSites(prev => prev.map(s => s.id === id ? { ...s, ...data, updatedAt: new Date() } : s));
      toast.success('Site aggiornato');
    } catch (error: any) {
      console.error('Error updating site:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  const deleteSite = useCallback(async (id: string) => {
    if (!isSupabaseConfigured || !supabase) {
      setSites(prev => prev.filter(s => s.id !== id));
      setProjects(prev => prev.filter(p => p.siteId !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('sites')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setSites(prev => prev.filter(s => s.id !== id));
      setProjects(prev => prev.filter(p => p.siteId !== id));
      toast.success('Site eliminato');
    } catch (error: any) {
      console.error('Error deleting site:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  // Projects CRUD (using site_config table)
  const addProject = useCallback(async (data: Omit<AdminProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminProject | null> => {
    if (!isSupabaseConfigured || !supabase) {
      const newProject: AdminProject = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      setProjects(prev => [...prev, newProject]);
      return newProject;
    }

    try {
      const { data: inserted, error } = await supabase
        .from('site_config')
        .insert({ 
          site_id: data.siteId,
          display_name: data.name,
          status: data.status || 'active',
          modules: data.modules,
          certifications: data.certifications,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newProject: AdminProject = {
        id: inserted.id,
        siteId: inserted.site_id,
        name: inserted.display_name || data.name,
        status: inserted.status || 'active',
        modules: inserted.modules || defaultProjectModules,
        certifications: inserted.certifications || [],
        createdAt: new Date(inserted.created_at),
        updatedAt: new Date(inserted.updated_at),
      };
      setProjects(prev => [...prev, newProject]);
      toast.success('Progetto creato con successo');
      return newProject;
    } catch (error: any) {
      console.error('Error adding project:', error);
      toast.error(`Errore: ${error.message}`);
      return null;
    }
  }, []);

  const updateProject = useCallback(async (id: string, data: Partial<AdminProject>) => {
    if (!isSupabaseConfigured || !supabase) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date() } : p));
      return;
    }

    try {
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.display_name = data.name;
      if (data.siteId !== undefined) updateData.site_id = data.siteId;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.modules !== undefined) updateData.modules = data.modules;
      if (data.certifications !== undefined) updateData.certifications = data.certifications;
      
      const { error } = await supabase
        .from('site_config')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date() } : p));
      toast.success('Progetto aggiornato');
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    if (!isSupabaseConfigured || !supabase) {
      setProjects(prev => prev.filter(p => p.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('site_config')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Progetto eliminato');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  // Memberships CRUD
  const addMembership = useCallback(async (data: Omit<UserMembership, 'id' | 'createdAt'>): Promise<UserMembership | null> => {
    if (!isSupabaseConfigured || !supabase) {
      const newMembership: UserMembership = { ...data, id: crypto.randomUUID(), createdAt: new Date() };
      setMemberships(prev => [...prev, newMembership]);
      return newMembership;
    }

    try {
      const { data: inserted, error } = await supabase
        .from('user_memberships')
        .insert({
          user_id: data.userId,
          scope_type: data.scopeType,
          scope_id: data.scopeId,
          permission: data.permission,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newMembership: UserMembership = {
        id: inserted.id,
        userId: inserted.user_id,
        scopeType: inserted.scope_type,
        scopeId: inserted.scope_id,
        permission: inserted.permission,
        createdAt: new Date(inserted.created_at),
      };
      setMemberships(prev => [...prev, newMembership]);
      toast.success('Membership creata');
      return newMembership;
    } catch (error: any) {
      console.error('Error adding membership:', error);
      toast.error(`Errore: ${error.message}`);
      return null;
    }
  }, []);

  const updateMembership = useCallback(async (id: string, data: Partial<UserMembership>) => {
    if (!isSupabaseConfigured || !supabase) {
      setMemberships(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
      return;
    }

    try {
      const updateData: Record<string, any> = {};
      if (data.scopeType !== undefined) updateData.scope_type = data.scopeType;
      if (data.scopeId !== undefined) updateData.scope_id = data.scopeId;
      if (data.permission !== undefined) updateData.permission = data.permission;
      
      const { error } = await supabase
        .from('user_memberships')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      setMemberships(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
      toast.success('Membership aggiornata');
    } catch (error: any) {
      console.error('Error updating membership:', error);
      toast.error(`Errore: ${error.message}`);
    }
  }, []);

  const deleteMembership = useCallback(async (id: string) => {
    if (!isSupabaseConfigured || !supabase) {
      setMemberships(prev => prev.filter(m => m.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('user_memberships')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setMemberships(prev => prev.filter(m => m.id !== id));
      toast.success('Membership eliminata');
    } catch (error: any) {
      console.error('Error deleting membership:', error);
      toast.error(`Errore: ${error.message}`);
    }
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
      loading,
      addHolding, updateHolding, deleteHolding,
      addBrand, updateBrand, deleteBrand,
      addSite, updateSite, deleteSite,
      addProject, updateProject, deleteProject,
      addMembership, updateMembership, deleteMembership,
      getBrandsByHolding, getSitesByBrand, getProjectsBySite, getProjectById,
      refreshData: fetchAllData,
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
