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
    // Verificar token de segurança
    const resetToken = req.headers.get('x-reset-token');
    const expectedToken = Deno.env.get('RESET_TOKEN');

    if (!resetToken || resetToken !== expectedToken) {
      console.error('Unauthorized: Invalid or missing reset token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Reset token validated, proceeding with data reset...');

    // Criar cliente Supabase com privilégios de service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
