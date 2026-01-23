/**
 * Fetch devices DIRECTLY from Database (Bypassing Edge Function to avoid param issues)
 */
export async function fetchDevicesApi(params?: {
  site_id?: string;
  type?: string;
  status?: string;
  model?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiDevicesResponse | null> {
  if (!supabase) return null;

  // 1. Costruiamo la query diretta al DB
  let query = supabase
    .from('devices')
    .select('*', { count: 'exact' });

  // 2. Applichiamo i filtri (Mappando i nomi corretti!)
  if (params?.site_id) {
    query = query.eq('site_id', params.site_id);
  }
  
  if (params?.type) {
    // QUI RISOLVIAMO IL PROBLEMA: Il frontend passa 'type', noi chiediamo al DB 'device_type'
    query = query.eq('device_type', params.type);
  }

  if (params?.status) {
    query = query.eq('status', params.status);
  }

  // Paginazione
  const limit = params?.limit || 100;
  const from = params?.offset || 0;
  const to = from + limit - 1;
  
  query = query.range(from, to);

  // 3. Eseguiamo la query
  const { data, error, count } = await query;

  if (error) {
    console.error('Direct DB Devices fetch error:', error);
    return null;
  }

  // 4. Formattiamo la risposta come se la aspetta il frontend
  return {
    data: (data as any[]) || [], // Cast necessario per TypeScript
    meta: {
      total: count || 0,
      limit: limit,
      offset: from,
      has_more: (count || 0) > to + 1,
    },
  };
}
