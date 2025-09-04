import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRM_STATUS_MAP: Record<string, string> = {
  "New": "Pending Acceptance",
  "Accepted": "Pending Schedule",
  "Scheduled": "Scheduled",
  "On-Site Complete": "On-Site Complete",
  "Completed": "Complete",
};

Deno.serve(async (req) => {
  console.log("--- Sync Work Orders Function Invoked (v18 - Reverted to BRITE_CRM_BASE_URL) ---");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Check for all required environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const CRM_API_KEY = Deno.env.get("BRITE_CRM_API_KEY");
    const CRM_BASE_URL = Deno.env.get("BRITE_CRM_BASE_URL"); // Reverting to the original URL

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !CRM_API_KEY || !SUPABASE_SERVICE_ROLE_KEY || !CRM_BASE_URL) {
      throw new Error("Server configuration error: Missing required API keys or URLs, including BRITE_CRM_BASE_URL.");
    }

    // 2. Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header missing.");
    }
    const accessToken = authHeader.replace('Bearer ', '');
    
    const supabaseUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user || !user.email) {
      throw new Error(`Authentication failed: ${userError?.message || "No user found."}`);
    }
    console.log(`User authenticated: ${user.id}`);

    // 3. Get user's profile using a Service Role client for robustness
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, crm_email')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      console.error(`Profile fetch error for user ${user.id}:`, profileError);
      throw new Error(`Could not find a valid profile for your user account. Please contact support. (Error: ${profileError?.message})`);
    }
    if (!profileData.company_id) {
        throw new Error(`Your user profile is missing a company link. Please contact support.`);
    }
    const userCompanyId = profileData.company_id;
    const crmEmail = profileData.crm_email || user.email;
    console.log(`Profile found. Company ID: ${userCompanyId}. Using CRM Email from profile: ${crmEmail}`);

    // 4. Fetch the list of work orders from the CRM
    const crmUrl = `${CRM_BASE_URL}v1/work-orders?email=${encodeURIComponent(crmEmail)}`;
    console.log(`Fetching from CRM: ${crmUrl}`);

    const crmHeaders = {
      "Authorization": `Bearer ${CRM_API_KEY}`,
      "Content-Type": "application/json",
    };

    const listWorkOrdersResponse = await fetch(crmUrl, { headers: crmHeaders });

    if (!listWorkOrdersResponse.ok) {
      const errorText = await listWorkOrdersResponse.text();
      console.error(`CRM API Error (${listWorkOrdersResponse.status}):`, errorText);
      throw new Error(`Failed to fetch work order list from CRM. Status: ${listWorkOrdersResponse.status} ${listWorkOrdersResponse.statusText}`);
    }

    const crmListData = await listWorkOrdersResponse.json();
    const crmWorkOrdersList = crmListData.workOrders;

    if (!Array.isArray(crmWorkOrdersList)) {
      console.error("Unexpected CRM list format:", crmListData);
      throw new Error("CRM returned an unexpected format for the work order list.");
    }
    console.log(`Found ${crmWorkOrdersList.length} work orders in CRM.`);
    
    const detailFetchPromises = crmWorkOrdersList.map(summary => {
      const workOrderId = summary?.id;
      if (!workOrderId) return Promise.resolve(null);
      return fetch(`${CRM_BASE_URL}v1/work-orders/${workOrderId}`, { headers: crmHeaders });
    });

    const detailResponses = await Promise.allSettled(detailFetchPromises);
    console.log("All detail fetches complete.");

    const syncedProjectIds: string[] = [];
    const failedProjectIds: { id: string; error: string }[] = [];

    for (let i = 0; i < detailResponses.length; i++) {
      const result = detailResponses[i];
      const workOrderId = crmWorkOrdersList[i]?.id || `unknown_index_${i}`;

      if (result.status === 'rejected' || !result.value || !result.value.ok) {
        const reason = result.status === 'rejected' ? result.reason : await result.value?.text();
        failedProjectIds.push({ id: workOrderId, error: `Failed to fetch details: ${reason}` });
        continue;
      }

      try {
        const detailJson = await result.value.json();
        const crmWorkOrder = detailJson.workOrder;
        if (!crmWorkOrder) throw new Error("No 'workOrder' object in details response.");

        const projectToUpsert = {
          id: crmWorkOrder.id,
          user_id: user.id,
          company_id: userCompanyId,
          name: crmWorkOrder.consumer?.name || crmWorkOrder.workOrderNumber || `Work Order ${crmWorkOrder.id}`,
          customer_name: crmWorkOrder.consumer?.name || null,
          schedule_date: typeof crmWorkOrder.scheduledDate === 'string' ? crmWorkOrder.scheduledDate.split('T')[0] : null,
          seller_name: crmWorkOrder.dealer?.name || null,
          work_order_number: crmWorkOrder.workOrderNumber || null,
          status: CRM_STATUS_MAP[crmWorkOrder.status?.name] || "Pending Acceptance",
          address: crmWorkOrder.consumerLocations?.[0]?.location?.address || null,
          phone: crmWorkOrder.consumer?.phoneNumbers?.[0]?.phoneNumber || null,
          follow_up_date: null,
          work_type: crmWorkOrder.serviceType?.name || null,
          details: {
            summary: crmWorkOrder.summary || null,
            instructions: crmWorkOrder.notes?.[0]?.note || null,
            work_no: crmWorkOrder.briteOrderNumber || null,
            field_ops_rep: crmWorkOrder.installer ? `${crmWorkOrder.installer.firstName || ''} ${crmWorkOrder.installer.lastName || ''}`.trim() : null,
            service_order: crmWorkOrder.erpOrderNumber || null,
            work_type: crmWorkOrder.serviceType?.name || null,
            additional_visit_needed: crmWorkOrder.additionalVisitNeeded || false,
            brand: crmWorkOrder.lineItems?.[0]?.brand || null,
            arrival_window_start: crmWorkOrder.arrivalWindowStart || null,
            arrival_window_end: crmWorkOrder.arrivalWindowEnd || null,
            duration: crmWorkOrder.duration || null,
            duration_type: crmWorkOrder.durationType || null,
            date_service_delayed: crmWorkOrder.dateServiceDelayed || null,
            reason_for_delay: crmWorkOrder.reasonForDelay || null,
            contact_attempt_counter: crmWorkOrder.contactAttemptCounter || 0,
            time_service_delayed: crmWorkOrder.timeServiceDelayed || null,
            date_scheduled: crmWorkOrder.scheduledDate || null,
          },
          customer_contact_info: {
            account: crmWorkOrder.consumer?.originalRecordId || null,
            contact_name: crmWorkOrder.consumer?.name || null,
            home_phone: crmWorkOrder.consumer?.phoneNumbers?.find((p: any) => p?.type === 'HOME')?.phoneNumber || null,
            mobile_phone: crmWorkOrder.consumer?.phoneNumbers?.find((p: any) => p?.type === 'MOBILE')?.phoneNumber || null,
            email: crmWorkOrder.consumer?.emails?.[0]?.email || null,
          },
          seller_contact_info: {
            company: crmWorkOrder.dealer?.name || null,
            contact_name: crmWorkOrder.dealer?.users?.[0] ? `${crmWorkOrder.dealer.users[0].firstName || ''} ${crmWorkOrder.dealer.users[0].lastName || ''}`.trim() : null,
            phone: crmWorkOrder.dealer?.phone || null,
            email: crmWorkOrder.dealer?.email || null,
            secondary_email: crmWorkOrder.dealer?.users?.[0]?.email || null,
            address: crmWorkOrder.dealer?.dealerLocations?.[0]?.location?.address || null,
          },
          payment_info: {
            billed_surcharges: crmWorkOrder.billedSurcharges || null,
            payment_status: crmWorkOrder.paymentStatus || null,
          },
          related_items: {
            related_work_orders: (crmWorkOrder.relations || []).filter((r: any) => r?.relation).map((r: any) => ({ id: r.relation.relatedWorkOrderId, name: r.relatedServiceType?.name })),
            linked_files: (crmWorkOrder.attachments || []).filter((a: any) => a).map((a: any) => ({ name: a.name, url: a.url })),
            service_calls: null,
          },
          updated_at: new Date().toISOString(),
        };

        const { error: upsertProjectError } = await supabaseUserClient.from("projects").upsert(projectToUpsert, { onConflict: "id" });
        if (upsertProjectError) throw upsertProjectError;
        
        syncedProjectIds.push(workOrderId);

        const crmWindows = crmWorkOrder.consumerLocations?.[0]?.rooms?.[0]?.windows || [];
        for (const crmWindow of crmWindows) {
          if (!crmWindow?.id) continue;
          const windowToUpsert = {
            id: crmWindow.id,
            project_id: crmWorkOrder.id,
            user_id: user.id,
            line_number: crmWindow.windowNumber || 0,
            data: {
              location: crmWorkOrder.consumerLocations?.[0]?.rooms?.[0]?.name || null,
              width: crmWindow.width || 0,
              height: crmWindow.height || 0,
              depth: crmWindow.depth || 0,
              product: crmWorkOrder.lineItems?.[0]?.productType || null,
              windowNumber: crmWindow.windowNumber || null,
            },
            notes: crmWorkOrder.notes?.[0]?.note || null,
            updated_at: new Date().toISOString(),
          };
          const { error: upsertWindowError } = await supabaseUserClient.from("window_measurements").upsert(windowToUpsert, { onConflict: "id" });
          if (upsertWindowError) console.error(`Error upserting window ${crmWindow.id}:`, upsertWindowError.message);
        }
      } catch (error) {
        failedProjectIds.push({ id: workOrderId, error: error.message });
      }
    }

    return new Response(JSON.stringify({ 
      message: `Sync complete. Synced: ${syncedProjectIds.length}. Failed: ${failedProjectIds.length}.`, 
      syncedProjectIds,
      failedProjectIds 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("--- Uncaught Exception in Sync Function ---", error);
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});