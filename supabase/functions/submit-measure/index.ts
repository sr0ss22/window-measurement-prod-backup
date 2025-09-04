import { createClient } from 'jsr:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();

    if (!projectId) {
      console.error('Submit Measure: Missing projectId in request body.');
      return new Response(JSON.stringify({ error: 'Project ID is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the user's auth token from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Submit Measure: Authorization header missing.');
      return new Response(JSON.stringify({ error: 'Authorization header missing.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract the access token from the "Bearer " prefix
    const accessToken = authHeader.replace('Bearer ', '');
    console.log("Submit Measure: Received accessToken (first 10 chars):", accessToken.substring(0, 10)); // Log token snippet

    // Create a new Supabase client FOR THIS REQUEST, authenticated as the user.
    // Explicitly pass the access_token to the auth object.
    const supabaseClientForUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Correct way to pass token for Deno Edge Functions
          },
        },
      }
    );

    // Verify the user token is valid
    const { data: { user }, error: userError } = await supabaseClientForUser.auth.getUser();

    if (userError || !user) {
      console.error('Submit Measure: User authentication failed:', userError?.message || 'No user found.');
      return new Response(JSON.stringify({ error: 'Authentication failed.', details: userError?.message || 'No user found.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log("Submit Measure: User authenticated:", user.id); // Log user ID

    // Update the project status using the user-authenticated client.
    // RLS will now correctly identify the user via auth.uid().
    const { data, error } = await supabaseClientForUser
      .from('projects')
      .update({ status: 'On-Site Complete', updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single(); // Use .single() to get a single object or an error if not found/unauthorized

    if (error) {
      console.error('Submit Measure: Error updating project status in DB:', error.message);
      // Check for a PostgREST error code for RLS violation or not found
      if (error.code === 'PGRST204') {
         return new Response(JSON.stringify({ error: 'Project not found or you do not have permission to update it.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Failed to update project status.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Project marked as measured successfully.', project: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Submit Measure: Uncaught exception:', error.message || error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});