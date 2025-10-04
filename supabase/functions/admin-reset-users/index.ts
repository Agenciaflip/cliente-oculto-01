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

    console.log('Reset token validated, proceeding with user reset...');

    // Criar cliente Supabase com privilégios de service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Deletar conversation_messages
    console.log('Deleting conversation_messages...');
    const { error: messagesError } = await supabaseAdmin
      .from('conversation_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

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
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

    if (analysisError) {
      console.error('Error deleting analysis_requests:', analysisError);
    } else {
      console.log('Successfully deleted analysis_requests');
    }

    // 3. Deletar user_roles
    console.log('Deleting user_roles...');
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

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
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

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
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

    if (usageError) {
      console.error('Error deleting usage_tracking:', usageError);
    } else {
      console.log('Successfully deleted usage_tracking');
    }

    // 6. Deletar profiles
    console.log('Deleting profiles...');
    const { error: profilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

    if (profilesError) {
      console.error('Error deleting profiles:', profilesError);
    } else {
      console.log('Successfully deleted profiles');
    }

    // 7. Deletar usuários do auth
    console.log('Fetching all users from auth...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list users', details: listError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${users.length} users to delete`);

    for (const user of users) {
      console.log(`Deleting user: ${user.email} (${user.id})`);
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      
      if (deleteUserError) {
        console.error(`Error deleting user ${user.email}:`, deleteUserError);
      } else {
        console.log(`Successfully deleted user: ${user.email}`);
      }
    }

    console.log('User reset completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All users and related data have been deleted',
        deletedUsers: users.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
