import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
        isLoading: false,
      });
      return;
    }

    if (!isSupabaseConfigured) {
      // Mock mode - treat as FGB user
      setScopeInfo(prev => ({ ...prev, clientRole: 'USER_FGB', isLoading: false }));
      return;
    }

    try {
      // Fetch user memberships
      const { data: memberships, error } = await supabase
        .from('user_memberships')
        .select('scope_type, scope_id, permission')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!memberships || memberships.length === 0) {
        // No memberships = FGB user without specific scope
        setScopeInfo(prev => ({ ...prev, clientRole: 'USER_FGB', isLoading: false }));
        return;
      }

      // Categorize memberships
      const holdingMemberships = memberships.filter(m => m.scope_type === 'holding');
      const brandMemberships = memberships.filter(m => m.scope_type === 'brand');
      const siteMemberships = memberships.filter(m => m.scope_type === 'site');

      // Determine highest privilege role
      let clientRole: ClientRole = 'USER_FGB';
      let holdingId: string | null = null;
      let brandId: string | null = null;
      let siteId: string | null = null;
      let projectId: string | null = null;

      // Priority: ADMIN_HOLDING > ADMIN_BRAND > STORE_USER
      const adminHolding = holdingMemberships.find(m => m.permission === 'admin');
      if (adminHolding) {
        clientRole = 'ADMIN_HOLDING';
        holdingId = adminHolding.scope_id;
      } else {
        const adminBrand = brandMemberships.find(m => m.permission === 'admin');
        if (adminBrand) {
          clientRole = 'ADMIN_BRAND';
          brandId = adminBrand.scope_id;
        } else if (siteMemberships.length > 0) {
          clientRole = 'STORE_USER';
          siteId = siteMemberships[0].scope_id;
          
          // Fetch project ID for this site
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

      setScopeInfo({
        clientRole,
        holdingId,
        brandId,
        siteId,
        projectId,
        accessibleHoldingIds: holdingMemberships.map(m => m.scope_id),
        accessibleBrandIds: brandMemberships.map(m => m.scope_id),
        accessibleSiteIds: siteMemberships.map(m => m.scope_id),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching user scope:', error);
      setScopeInfo(prev => ({ ...prev, clientRole: 'USER_FGB', isLoading: false }));
    }
  }, [user, isAdmin, authLoading]);

  useEffect(() => {
    fetchUserScope();
  }, [fetchUserScope]);

  return scopeInfo;
};
