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

    console.log(`Admin ${user.id} initiated full reset...`);

    // 1. Deletar conversation_messages
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

    // 2. Deletar analysis_requests
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

    // 3. Deletar user_roles (exceto do admin que está executando)
    console.log('Deleting user_roles...');
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .neq('user_id', user.id);

    if (rolesError) {
      console.error('Error deleting user_roles:', rolesError);
    } else {
      console.log('Successfully deleted user_roles');
    }

    // 4. Deletar subscriptions
    console.log('Deleting subscriptions...');
    const { error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (subscriptionsError) {
      console.error('Error deleting subscriptions:', subscriptionsError);
    } else {
      console.log('Successfully deleted subscriptions');
    }

    // 5. Deletar usage_tracking
    console.log('Deleting usage_tracking...');
    const { error: usageError } = await supabaseAdmin
      .from('usage_tracking')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (usageError) {
      console.error('Error deleting usage_tracking:', usageError);
    } else {
      console.log('Successfully deleted usage_tracking');
    }

    // 6. Deletar profiles (exceto do admin que está executando)
    console.log('Deleting profiles...');
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .neq('id', user.id);

    if (profilesError) {
      console.error('Error deleting profiles:', profilesError);
    } else {
      console.log('Successfully deleted profiles');
    }

    // 7. Deletar usuários do auth (exceto o admin que está executando)
    console.log('Fetching all users from auth...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${users.length} users to process`);

    let deletedCount = 0;
    for (const targetUser of users) {
      // Não deletar o próprio admin
      if (targetUser.id === user.id) {
        console.log(`Skipping deletion of current admin: ${targetUser.email}`);
        continue;
      }

      console.log(`Deleting user: ${targetUser.email} (${targetUser.id})`);
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
      
      if (deleteUserError) {
        console.error(`Error deleting user ${targetUser.email}:`, deleteUserError);
      } else {
        console.log(`Successfully deleted user: ${targetUser.email}`);
        deletedCount++;
      }
    }

    console.log('User reset completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All users and related data have been deleted',
        deletedUsers: deletedCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-users:', error);
    
    // Map error to generic message for client
    let clientMessage = 'Failed to reset users. Please try again.';
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
