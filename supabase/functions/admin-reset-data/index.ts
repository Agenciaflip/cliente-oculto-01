import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reset-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com privilégios de service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação e role de admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (roleError || !roleCheck) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} initiated data reset...`);

    // 1. Deletar sales_analysis (deve vir antes de analysis_requests)
    console.log('Deleting sales_analysis...');
    const { error: salesError } = await supabaseAdmin
      .from('sales_analysis')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (salesError) {
      console.error('Error deleting sales_analysis:', salesError);
    } else {
      console.log('Successfully deleted sales_analysis');
    }

    // 2. Deletar analysis_metrics (deve vir antes de analysis_requests)
    console.log('Deleting analysis_metrics...');
    const { error: metricsError } = await supabaseAdmin
      .from('analysis_metrics')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (metricsError) {
      console.error('Error deleting analysis_metrics:', metricsError);
    } else {
      console.log('Successfully deleted analysis_metrics');
    }

    // 3. Deletar conversation_messages (deve vir antes de analysis_requests)
    console.log('Deleting conversation_messages...');
    const { error: messagesError } = await supabaseAdmin
      .from('conversation_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (messagesError) {
      console.error('Error deleting conversation_messages:', messagesError);
    } else {
      console.log('Successfully deleted conversation_messages');
    }

    // 4. Deletar analysis_requests
    console.log('Deleting analysis_requests...');
    const { error: analysisError } = await supabaseAdmin
      .from('analysis_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (analysisError) {
      console.error('Error deleting analysis_requests:', analysisError);
    } else {
      console.log('Successfully deleted analysis_requests');
    }

    console.log('Data reset completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All conversations and analyses have been deleted. Users remain intact.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-data:', error);
    
    // Map error to generic message for client
    let clientMessage = 'Failed to reset data. Please try again.';
    let statusCode = 500;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('Unauthorized')) {
      clientMessage = 'You do not have permission to perform this action.';
      statusCode = 401;
    } else if (errorMessage.includes('Forbidden')) {
      clientMessage = 'You do not have permission to perform this action.';
      statusCode = 403;
    }
    
    return new Response(
      JSON.stringify({ error: clientMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
