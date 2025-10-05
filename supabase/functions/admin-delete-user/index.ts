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
    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log('[admin-delete-user] Deleting user:', user_id);

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

    console.log('[admin-delete-user] Request from user:', user.id);
    
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (roleError) {
      console.error('[admin-delete-user] Role check error:', roleError);
      throw new Error(`Role check failed: ${roleError.message}`);
    }

    if (!roleCheck) {
      throw new Error("Unauthorized: User is not admin");
    }
    
    // Deletar dados do banco manualmente com service_role
    console.log('[admin-delete-user] Deleting user data from database');
    
    // Buscar IDs das análises do usuário
    const { data: userAnalyses } = await supabaseAdmin
      .from('analysis_requests')
      .select('id')
      .eq('user_id', user_id);
    
    const analysisIds = userAnalyses?.map(a => a.id) || [];
    
    // Deletar mensagens de conversação
    if (analysisIds.length > 0) {
      await supabaseAdmin
        .from('conversation_messages')
        .delete()
        .in('analysis_id', analysisIds);
      
      // Deletar análises de vendas
      await supabaseAdmin
        .from('sales_analysis')
        .delete()
        .in('analysis_id', analysisIds);
      
      // Deletar métricas
      await supabaseAdmin
        .from('analysis_metrics')
        .delete()
        .in('analysis_id', analysisIds);
    }
    
    // Deletar análises
    await supabaseAdmin
      .from('analysis_requests')
      .delete()
      .eq('user_id', user_id);
    
    // Buscar IDs dos tickets do usuário
    const { data: userTickets } = await supabaseAdmin
      .from('support_tickets')
      .select('id')
      .eq('user_id', user_id);
    
    const ticketIds = userTickets?.map(t => t.id) || [];
    
    // Deletar mensagens de suporte
    if (ticketIds.length > 0) {
      await supabaseAdmin
        .from('support_messages')
        .delete()
        .in('ticket_id', ticketIds);
    }
    
    // Deletar tickets de suporte
    await supabaseAdmin
      .from('support_tickets')
      .delete()
      .eq('user_id', user_id);
    
    // Deletar outros dados
    await supabaseAdmin.from('subscriptions').delete().eq('user_id', user_id);
    await supabaseAdmin.from('usage_tracking').delete().eq('user_id', user_id);
    await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);
    await supabaseAdmin.from('profiles').delete().eq('id', user_id);
    
    console.log('[admin-delete-user] Database deletion successful');
    
    // Deletar do auth
    console.log('[admin-delete-user] Deleting from auth.users');
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    
    if (authError) {
      console.error('[admin-delete-user] Auth deletion error:', authError);
      throw new Error(`Auth deletion failed: ${authError.message}`);
    }

    console.log('[admin-delete-user] User deleted successfully');
    
    return new Response(JSON.stringify({ 
      success: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error: any) {
    console.error('[admin-delete-user] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
