// supabase/functions/create-user/index.ts
//
// Creates a new Supabase auth user + profiles row.
// Called by the frontend SupabaseUserRepository.create() method.
//
// Security:
//   - Requires --verify-jwt (default). Supabase gateway validates the JWT's
//     cryptographic signature and expiry before this code runs.
//   - This function additionally calls serviceClient.auth.getUser(token) as
//     defense-in-depth verification.
//   - Only callers with role = 'superadmin' or 'admin' may invoke.
//   - The Edge Function's service_role key is NEVER exposed to the browser.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Password generation — crypto.getRandomValues(), 20 chars,
// guaranteed coverage of uppercase, lowercase, digit, and special classes.
// ---------------------------------------------------------------------------
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@#$!";
  const all = upper + lower + digits + special;

  const pickRandom = (charset: string, count: number): string[] => {
    const arr = new Uint8Array(count);
    crypto.getRandomValues(arr);
    return Array.from(arr, (v) => charset[v % charset.length]);
  };

  // Guarantee at least one from each required class
  const required = [
    pickRandom(upper, 1),
    pickRandom(lower, 1),
    pickRandom(digits, 1),
    pickRandom(special, 1),
  ].flat();

  // Fill remaining 16 chars from the full set
  const remaining = pickRandom(all, 16);

  // Fisher-Yates shuffle
  const password = [...required, ...remaining];
  for (let i = password.length - 1; i > 0; i--) {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ------------------------------------------------------------------
    // STEP 1 — Verify caller's JWT (defense-in-depth with --verify-jwt)
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // supabase.auth.getUser() validates the JWT's cryptographic signature
    // and expiry server-side against Supabase Auth.
    const {
      data: { user: callerUser },
      error: verifyError,
    } = await serviceClient.auth.getUser(token);

    if (verifyError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ------------------------------------------------------------------
    // STEP 2 — Check caller's role
    // ------------------------------------------------------------------
    const { data: callerProfile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role, project_id")
      .eq("id", callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Unable to verify caller profile" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const callerRole = (callerProfile.role ?? "").trim().toLowerCase();
    if (callerRole !== "superadmin" && callerRole !== "admin") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: only superadmin or admin can create users",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ------------------------------------------------------------------
    // STEP 3 — Parse request body
    // ------------------------------------------------------------------
    const body = await req.json();
    const {
      username,
      email,
      employee_id,
      role,
      squad_id,
      project_id,
      reports_to,
      job_title,
      base_office,
      birthday,
      permissions,
      accessible_squads,
      direct_reports,
    } = body as Record<string, unknown>;

    if (!username || typeof username !== "string" || !username.trim()) {
      return new Response(
        JSON.stringify({ error: "username is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!role || typeof role !== "string") {
      return new Response(JSON.stringify({ error: "role is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ------------------------------------------------------------------
    // STEP 4 — Generate password server-side
    // ------------------------------------------------------------------
    const plainPassword = generatePassword();
    const userEmail = email.trim();

    // ------------------------------------------------------------------
    // STEP 5 — Create auth user (triggers on_auth_user_created → bare profile)
    // ------------------------------------------------------------------
    const {
      data: authUser,
      error: authError,
    } = await serviceClient.auth.admin.createUser({
      email: userEmail,
      password: plainPassword,
      email_confirm: true,
      user_metadata: { username: username.trim() },
    });

    if (authError) {
      return new Response(
        JSON.stringify({
          error: `Failed to create auth user: ${authError.message}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!authUser?.user?.id) {
      return new Response(
        JSON.stringify({ error: "Auth user created but no ID returned" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = authUser.user.id;

    // ------------------------------------------------------------------
    // STEP 6 — Update profile row (auto-created by on_auth_user_created)
    // ------------------------------------------------------------------
    const profileUpdate: Record<string, unknown> = {
      username: username.trim(),
      role,
      must_change_password: true,
      login_count: 0,
      failed_login_attempts: 0,
      login_count_without_birthday: 0,
      login_history: [],
      direct_reports: Array.isArray(direct_reports) ? direct_reports : [],
      reports_to: reports_to || null,
    };

    if (employee_id) profileUpdate.employee_id = employee_id;
    if (squad_id) profileUpdate.squad_id = squad_id;
    if (project_id) profileUpdate.project_id = project_id;
    if (reports_to) profileUpdate.reports_to = reports_to;
    if (job_title) profileUpdate.job_title = job_title;
    if (base_office) profileUpdate.base_office = base_office;
    if (birthday) profileUpdate.birthday = birthday;
    if (permissions) profileUpdate.permissions = permissions;
    if (Array.isArray(accessible_squads))
      profileUpdate.accessible_squads = accessible_squads;

    const { error: updateError } = await serviceClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: `Failed to update profile: ${updateError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ------------------------------------------------------------------
    // STEP 7 — Return created profile + generated password
    // ------------------------------------------------------------------
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    return new Response(
      JSON.stringify({ user: profile, password: plainPassword }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("create-user error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
