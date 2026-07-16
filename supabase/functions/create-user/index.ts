/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log("STEP 1 - request received");

  // Handle browser preflight
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Missing Authorization header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Verify caller
    console.log("STEP 2 - verifying caller");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const { data: caller, error: callerError } = await supabase
      .from("profiles")
      .select("role")
      .single();

    if (callerError || !caller) {
      return new Response(
        JSON.stringify({
          error: "Unable to verify caller",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log("STEP 3 - caller:", caller);

    const normalizedRole = (caller.role ?? "").trim().toLowerCase().replace(/\s+/g, "");

    if (normalizedRole !== "superadmin" && normalizedRole !== "admin") {
      console.log("Caller role:", caller.role);
      console.log("Normalized role:", normalizedRole);
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          callerRole: caller.role,
          normalizedRole,
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

console.log("STEP 4 - parsing body");
    const body = await req.json();

    const {
      email,
      password,
      full_name: username,
      employee_id,
      role: newRole,
      project_id: rawProjectId,
      squad_id: rawSquadId,
      reports_to: rawReportsTo,
      job_title,
      base_office,
      permissions,
      accessible_squads,
      direct_reports,
      created_by: rawCreatedBy,
      created_by_role,
    } = body;

    if (!email || !password || !username) {
      return new Response(
        JSON.stringify({
          error: "email, password and full_name are required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Normalize optional UUID fields: undefined, "", "   " -> null
    const normalizeUuid = (val: unknown): string | null => {
      if (val === undefined || val === null) return null;
      const trimmed = String(val).trim();
      return trimmed === "" ? null : trimmed;
    };

    const project_id = normalizeUuid(rawProjectId);
    const squad_id = normalizeUuid(rawSquadId);
    const reports_to = normalizeUuid(rawReportsTo);
    const created_by = normalizeUuid(rawCreatedBy);

    // Service Role Client
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    console.log("STEP 5 - creating auth user");
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    console.log("STEP 6 - auth user created");
    console.log("Auth Result", authData);
    console.log("Auth Error", authError);

    if (authError) {
      return new Response(
        JSON.stringify({
          error: authError.message,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const userId = authData.user.id;

    console.log("STEP 7 - inserting profile");
    const insertPayload = {
      id: userId,
      employee_id: employee_id ?? null,
      full_name: username,
      email,
      role: newRole ?? "member",
      active: true,
      must_change_password: true,
      project_id,
      squad_id,
      reports_to,
      job_title: job_title ?? null,
      base_office: base_office ?? 'Bengaluru',
      permissions: permissions ?? null,
      direct_reports: direct_reports ?? [],
      accessible_squads: accessible_squads ?? [],
      created_by,
      created_by_role: created_by_role ?? null,
    };
    console.log("INSERT payload:", JSON.stringify(insertPayload, null, 2));

    const { data: profileRow, error: profileError } = await admin
      .from("profiles")
      .insert(insertPayload)
      .select("*")
      .single();

    console.log("Profile Insert Error", profileError);

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);

      return new Response(
        JSON.stringify({
          error: profileError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    console.log("STEP 8 - profile inserted");

    return new Response(
      JSON.stringify({
        success: true,
        profile: profileRow,
      }),
      {
        status: 201,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("UNHANDLED ERROR:", err);

    return new Response(
      JSON.stringify({
        stage: "unhandled",
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      },
    );
  }
});