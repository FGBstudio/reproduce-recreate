import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { brands as mockBrands } from '@/lib/data';

// Client role types (mapped from user_memberships)
export type ClientRole = 
  | 'ADMIN_FGB'      // admin/superuser in user_roles
  | 'USER_FGB'       // editor/viewer in user_roles with no specific scope
  | 'ADMIN_HOLDING'  // holding membership with admin permission
  | 'ADMIN_BRAND'    // brand membership with admin permission
  | 'STORE_USER';    // site membership (single project access)

export interface UserScopeInfo {
  clientRole: ClientRole;
  // Scope IDs (only one populated based on role)
  holdingId: string | null;
  brandId: string | null;
  siteId: string | null;
  projectId: string | null;
  // All accessible IDs (for filtering)
  accessibleHoldingIds: string[];
  accessibleBrandIds: string[];
  accessibleSiteIds: string[];
  // Region restriction (null/empty = all regions allowed)
  allowedRegions: string[] | null;
  // Loading state
  isLoading: boolean;
}

export const useUserScope = (): UserScopeInfo => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [scopeInfo, setScopeInfo] = useState<UserScopeInfo>({
    clientRole: 'USER_FGB',
    holdingId: null,
    brandId: null,
    siteId: null,
    projectId: null,
    accessibleHoldingIds: [],
    accessibleBrandIds: [],
    accessibleSiteIds: [],
    allowedRegions: null,
    isLoading: true,
  });

  const fetchUserScope = useCallback(async () => {
    // Still loading auth
    if (authLoading) {
      return;
    }

    // No authenticated user - default to USER_FGB (guest view)
    if (!user) {
      setScopeInfo(prev => ({ ...prev, clientRole: 'USER_FGB', isLoading: false }));
      return;
    }

    // FGB Admin/Superuser - full access
    if (isAdmin) {
      setScopeInfo({
        clientRole: 'ADMIN_FGB',
        holdingId: null,
        brandId: null,
        siteId: null,
        projectId: null,
        accessibleHoldingIds: [],
        accessibleBrandIds: [],
        accessibleSiteIds: [],
        allowedRegions: null,
        isLoading: false,
      });
      return;
    }

    // --- HELPER PER LOGICA EMAIL (Fallback) ---
    const checkEmailForBrandScope = () => {
      const email = user.email?.toLowerCase() || '';
      const matchedBrand = mockBrands.find(b => 
        email.includes(b.id) || email.includes(b.name.toLowerCase())
      );

      if (matchedBrand) {
        setScopeInfo({
          clientRole: 'ADMIN_BRAND',
          holdingId: matchedBrand.holdingId,
          brandId: matchedBrand.id,
          siteId: null,
          projectId: null,
          accessibleHoldingIds: [matchedBrand.holdingId],
          accessibleBrandIds: [matchedBrand.id],
          accessibleSiteIds: [],
          allowedRegions: null,
          isLoading: false,
        });
        return true;
      }
      return false;
    };

    if (!isSupabaseConfigured) {
      if (!checkEmailForBrandScope()) {
        setScopeInfo(prev => ({ ...prev, clientRole: 'USER_FGB', isLoading: false }));
      }
      return;
    }

    // --- REAL DB MODE ---
    try {
      const { data: memberships, error } = await supabase
        .from('user_memberships')
        .select('scope_type, scope_id, permission, allowed_regions')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!memberships || memberships.length === 0) {
        // Fallback email se non ci sono membership nel DB
        if (!checkEmailForBrandScope()) {
          setScopeInfo(prev => ({ ...prev, clientRole: 'USER_FGB', isLoading: false }));
        }
        return;
      }

      // Categorize memberships
      const holdingMemberships = memberships.filter(m => m.scope_type === 'holding');
      const brandMemberships = memberships.filter(m => m.scope_type === 'brand');
      const siteMemberships = memberships.filter(m => m.scope_type === 'site');

      let clientRole: ClientRole = 'USER_FGB';
      let holdingId: string | null = null;
      let brandId: string | null = null;
      let siteId: string | null = null;
      let projectId: string | null = null;

      // --- LOGICA MODIFICATA QUI SOTTO ---
      // Accettiamo sia 'admin' che 'view' (o altro). Diamo priorità ad 'admin' se esiste.
      
      // 1. Check Holding
      const activeHoldingMembership = holdingMemberships.find(m => m.permission === 'admin') || holdingMemberships[0];
      
      if (activeHoldingMembership) {
        clientRole = 'ADMIN_HOLDING';
        holdingId = activeHoldingMembership.scope_id;
      } else {
        // 2. Check Brand (Ora accetta anche chi ha solo "view")
        const activeBrandMembership = brandMemberships.find(m => m.permission === 'admin') || brandMemberships[0];
        
        if (activeBrandMembership) {
          clientRole = 'ADMIN_BRAND'; // Usiamo questo ruolo per definire lo scope Brand, indipendentemente dal permesso
          brandId = activeBrandMembership.scope_id;
        } else if (siteMemberships.length > 0) {
          // 3. Check Site
          clientRole = 'STORE_USER';
          siteId = siteMemberships[0].scope_id;
          
          const { data: siteConfig } = await supabase
            .from('site_config')
            .select('id')
            .eq('site_id', siteId)
            .single();
          
          if (siteConfig) {
            projectId = siteConfig.id;
          }
        }
      }

      // Merge allowed_regions from all memberships (union of all)
      const allRegions = memberships
        .map(m => (m as any).allowed_regions as string[] | null)
        .filter((r): r is string[] => Array.isArray(r) && r.length > 0);
      const mergedAllowedRegions = allRegions.length > 0
        ? [...new Set(allRegions.flat())]
        : null;

      setScopeInfo({
        clientRole,
        holdingId,
        brandId,
        siteId,
        projectId,
        accessibleHoldingIds: holdingMemberships.map(m => m.scope_id),
        accessibleBrandIds: brandMemberships.map(m => m.scope_id),
        accessibleSiteIds: siteMemberships.map(m => m.scope_id),
        allowedRegions: mergedAllowedRegions,
        isLoading: false,
      });

    } catch (error) {
      console.error('Error fetching user scope:', error);
      if (!checkEmailForBrandScope()) {
        setScopeInfo(prev => ({ ...prev, clientRole: 'USER_FGB', isLoading: false }));
      }
    }
  }, [user, isAdmin, authLoading]);

  useEffect(() => {
    fetchUserScope();
  }, [fetchUserScope]);

  return scopeInfo;
};
