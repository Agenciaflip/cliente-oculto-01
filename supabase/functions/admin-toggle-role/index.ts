import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, action } = await req.json();
    
    if (!user_id || !action) {
      throw new Error('user_id and action are required');
    }

    if (action !== 'promote' && action !== 'demote') {
      throw new Error('action must be "promote" or "demote"');
    }

    console.log(`[admin-toggle-role] ${action} user:`, user_id);

    // Cliente com service_role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Verificar se quem está chamando é admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    
    if (!user) {
      throw new Error("Unauthorized: No user found");
    }

    console.log('[admin-toggle-role] Request from user:', user.id);
    
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (roleError) {
      console.error('[admin-toggle-role] Role check error:', roleError);
      throw new Error(`Role check failed: ${roleError.message}`);
    }

    if (!roleCheck) {
      throw new Error("Unauthorized: User is not admin");
    }

    // Impedir admin de modificar seu próprio role
    if (user_id === user.id) {
      throw new Error("Cannot modify your own role");
    }
    
    if (action === 'promote') {
      // Promover para admin
      console.log('[admin-toggle-role] Promoting user to admin');
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: user_id,
          role: "admin"
        });
      
      if (error) {
        // Se já existe, não é erro
        if (error.code === '23505') { // unique violation
          return new Response(JSON.stringify({ 
            success: true,
            message: 'User is already admin'
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        throw error;
      }
    } else {
      // Rebaixar de admin
      console.log('[admin-toggle-role] Demoting user from admin');
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", "admin");
      
      if (error) throw error;
    }

    console.log('[admin-toggle-role] Role toggle successful');
    
    return new Response(JSON.stringify({ 
      success: true,
      action,
      user_id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error: any) {
    console.error('[admin-toggle-role] Error:', error);
    
    // Map error to generic message for client
    let clientMessage = 'Failed to update user role. Please try again.';
    let statusCode = 500;
    
    if (error.message.includes('Unauthorized')) {
      clientMessage = 'You do not have permission to perform this action.';
      statusCode = 401;
    } else if (error.message.includes('Forbidden')) {
      clientMessage = 'You do not have permission to perform this action.';
      statusCode = 403;
    } else if (error.message.includes('not found')) {
      clientMessage = 'The requested resource was not found.';
      statusCode = 404;
    }
    
    return new Response(JSON.stringify({ error: clientMessage }), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
