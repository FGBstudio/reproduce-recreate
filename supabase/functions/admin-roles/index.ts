// Edge Function: /admin-roles
// Manages user roles (admin, editor, viewer) - accessible only to superusers
//
// Endpoints:
//   GET  - List all user roles (optional: ?user_id=UUID)
//   POST - Assign role to user { user_id: UUID, role: 'admin'|'editor'|'viewer' }
//   DELETE - Remove role from user { user_id: UUID, role: 'admin'|'editor'|'viewer' }
//
// Authentication: Requires Authorization header with valid JWT
// Authorization: Only users with 'admin' role can access this endpoint

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valid roles
const VALID_ROLES = ['admin', 'editor', 'viewer'] as const
type AppRole = typeof VALID_ROLES[number]

// Validation helpers
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

const isValidRole = (role: string): role is AppRole => {
  return VALID_ROLES.includes(role as AppRole)
}

// JSON response helper
const jsonResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Error response helper
const errorResponse = (error: string, details?: string, status = 400) => {
  return jsonResponse({ error, details }, status)
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 'Missing or invalid Authorization header', 401)
    }

    // Create client with user's JWT to verify authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify user's token and get claims
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token)
    
    if (claimsError || !claimsData?.user) {
      return errorResponse('Unauthorized', 'Invalid or expired token', 401)
    }

    const userId = claimsData.user.id

    // Use service role client for admin operations (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check if the requesting user is an admin using the has_role function
    const { data: isAdmin, error: roleCheckError } = await adminClient
      .rpc('has_role', { _user_id: userId, _role: 'admin' })

    if (roleCheckError) {
      console.error('Role check error:', roleCheckError)
      return errorResponse('Internal error', 'Failed to verify user role', 500)
    }

    if (!isAdmin) {
      return errorResponse('Forbidden', 'Only administrators can manage user roles', 403)
    }

    // Route by HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGet(req, adminClient)
      case 'POST':
        return await handlePost(req, adminClient, userId)
      case 'DELETE':
        return await handleDelete(req, adminClient, userId)
      default:
        return errorResponse('Method not allowed', `${req.method} is not supported`, 405)
    }

  } catch (error) {
    console.error('Admin roles function error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return errorResponse('Internal server error', message, 500)
  }
})

// GET: List user roles
// deno-lint-ignore no-explicit-any
async function handleGet(req: Request, client: any) {
  const url = new URL(req.url)
  const targetUserId = url.searchParams.get('user_id')

  // Validate user_id if provided
  if (targetUserId && !isValidUUID(targetUserId)) {
    return errorResponse('Invalid user_id format', 'user_id must be a valid UUID')
  }

  let query = client
    .from('user_roles')
    .select(`
      id,
      user_id,
      role,
      created_at,
      profiles!inner(id, display_name, email, company)
    `)
    .order('created_at', { ascending: false })

  if (targetUserId) {
    query = query.eq('user_id', targetUserId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Query error:', error)
    return errorResponse('Failed to fetch roles', error.message, 500)
  }

  return jsonResponse({
    data,
    meta: { total: data?.length || 0 }
  })
}

// POST: Assign role to user
// deno-lint-ignore no-explicit-any
async function handlePost(req: Request, client: any, requesterId: string) {
  let body: { user_id?: string; role?: string }
  
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 'Request body must be valid JSON')
  }

  const { user_id, role } = body

  // Validate required fields
  if (!user_id) {
    return errorResponse('Missing user_id', 'user_id is required')
  }
  if (!role) {
    return errorResponse('Missing role', 'role is required')
  }

  // Validate formats
  if (!isValidUUID(user_id)) {
    return errorResponse('Invalid user_id format', 'user_id must be a valid UUID')
  }
  if (!isValidRole(role)) {
    return errorResponse('Invalid role', `role must be one of: ${VALID_ROLES.join(', ')}`)
  }

  // Prevent self-demotion from admin (safety check)
  if (user_id === requesterId && role !== 'admin') {
    // Check if this would remove the last admin
    const { count, error: countError } = await client
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .neq('user_id', requesterId)

    if (countError) {
      return errorResponse('Failed to verify admin count', countError.message, 500)
    }

    if (count === 0) {
      return errorResponse('Cannot demote last admin', 'At least one admin must exist in the system')
    }
  }

  // Check if user exists in auth.users (via profiles)
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('id', user_id)
    .single()

  if (profileError || !profile) {
    return errorResponse('User not found', 'The specified user_id does not exist')
  }

  // Insert or update role (upsert based on unique constraint)
  const { data, error } = await client
    .from('user_roles')
    .upsert(
      { user_id, role },
      { onConflict: 'user_id,role', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) {
    // Check for duplicate (role already assigned)
    if (error.code === '23505') {
      return errorResponse('Role already assigned', `User already has the ${role} role`)
    }
    console.error('Insert error:', error)
    return errorResponse('Failed to assign role', error.message, 500)
  }

  return jsonResponse({
    message: `Role '${role}' assigned successfully`,
    data
  }, 201)
}

// DELETE: Remove role from user
// deno-lint-ignore no-explicit-any
async function handleDelete(req: Request, client: any, requesterId: string) {
  let body: { user_id?: string; role?: string }
  
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 'Request body must be valid JSON')
  }

  const { user_id, role } = body

  // Validate required fields
  if (!user_id) {
    return errorResponse('Missing user_id', 'user_id is required')
  }
  if (!role) {
    return errorResponse('Missing role', 'role is required')
  }

  // Validate formats
  if (!isValidUUID(user_id)) {
    return errorResponse('Invalid user_id format', 'user_id must be a valid UUID')
  }
  if (!isValidRole(role)) {
    return errorResponse('Invalid role', `role must be one of: ${VALID_ROLES.join(', ')}`)
  }

  // Prevent removing own admin role if last admin
  if (user_id === requesterId && role === 'admin') {
    const { count, error: countError } = await client
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')

    if (countError) {
      return errorResponse('Failed to verify admin count', countError.message, 500)
    }

    if (count === 1) {
      return errorResponse('Cannot remove last admin', 'At least one admin must exist in the system')
    }
  }

  // Delete the role
  const { error, count } = await client
    .from('user_roles')
    .delete({ count: 'exact' })
    .eq('user_id', user_id)
    .eq('role', role)

  if (error) {
    console.error('Delete error:', error)
    return errorResponse('Failed to remove role', error.message, 500)
  }

  if (count === 0) {
    return errorResponse('Role not found', `User does not have the ${role} role`, 404)
  }

  return jsonResponse({
    message: `Role '${role}' removed successfully`,
    deleted: count
  })
}
