/**
 * QX Nexus — Seed Script (Supabase Admin API)
 *
 * Creates auth users and profiles for the default test accounts.
 *
 * Usage:
 *   1. Set environment variables:
 *      SUPABASE_URL=https://your-project.supabase.co
 *      SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *
 *   2. Install dependencies:
 *      npm install @supabase/supabase-js
 *
 *   3. Run:
 *      npx tsx supabase/seed.ts
 *
 * IMPORTANT: This script uses the service_role key which bypasses RLS.
 * Only run this in development/seed environments.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SeedUser {
  email: string;
  password: string;
  username: string;
  role: "superadmin" | "admin" | "lead" | "member";
  employeeId: string;
  jobTitle: string;
  baseOffice: "Bengaluru" | "Mumbai";
}

const SEED_USERS: SeedUser[] = [
  {
    email: "admin@qxnexus.local",
    password: "Admin@123",
    username: "Super Admin",
    role: "superadmin",
    employeeId: "EMP001",
    jobTitle: "System Administrator",
    baseOffice: "Bengaluru",
  },
  {
    email: "admin2@qxnexus.local",
    password: "Admin@123",
    username: "Admin",
    role: "admin",
    employeeId: "EMP002",
    jobTitle: "Project Administrator",
    baseOffice: "Bengaluru",
  },
  {
    email: "lead@qxnexus.local",
    password: "Lead@123",
    username: "Lead",
    role: "lead",
    employeeId: "EMP003",
    jobTitle: "QA Lead",
    baseOffice: "Bengaluru",
  },
  {
    email: "member@qxnexus.local",
    password: "Member@123",
    username: "Member",
    role: "member",
    employeeId: "EMP004",
    jobTitle: "QA Engineer",
    baseOffice: "Mumbai",
  },
];

async function seed() {
  console.log("Seeding Supabase auth users and profiles...\n");

  // Look up the default project and squad
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("project_code", "QXN")
    .single();

  const { data: squad } = await supabase
    .from("squads")
    .select("id")
    .eq("squad_code", "QA-1")
    .single();

  if (!project || !squad) {
    console.error(
      "Default project (QXN) or squad (QA-1) not found. Run migration 3 first."
    );
    process.exit(1);
  }

  const createdUsers: { user: SeedUser; id: string }[] = [];

  for (const seedUser of SEED_USERS) {
    console.log(`Creating user: ${seedUser.email} (${seedUser.role})...`);

    const { data, error } = await supabase.auth.admin.createUser({
      email: seedUser.email,
      password: seedUser.password,
      email_confirm: true, // skip email confirmation for seed users
      user_metadata: {
        username: seedUser.username,
        role: seedUser.role,
        must_change_password: true,
      },
    });

    if (error) {
      if (error.message.includes("already exists")) {
        console.log(`  → User ${seedUser.email} already exists, skipping.`);
        continue;
      }
      console.error(`  → Error creating ${seedUser.email}:`, error.message);
      continue;
    }

    const userId = data.user.id;
    createdUsers.push({ user: seedUser, id: userId });
    console.log(`  → Created with ID: ${userId}`);

    // The on_auth_user_created trigger already created the profile.
    // Update it with additional fields.
    const profileUpdates: Record<string, unknown> = {
      employee_id: seedUser.employeeId,
      username: seedUser.username,
      role: seedUser.role,
      base_office: seedUser.baseOffice,
      job_title: seedUser.jobTitle,
      must_change_password: true,
    };

    // Assign project/squad for non-superadmin users
    if (seedUser.role !== "superadmin") {
      profileUpdates.project_id = project.id;
    }
    if (seedUser.role === "lead" || seedUser.role === "member") {
      profileUpdates.squad_id = squad.id;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);

    if (updateError) {
      console.error(
        `  → Error updating profile for ${seedUser.email}:`,
        updateError.message
      );
    } else {
      console.log(`  → Profile updated.`);
    }
  }

  // Set up reporting relationships
  const adminUser = createdUsers.find((u) => u.user.role === "admin");
  const leadUser = createdUsers.find((u) => u.user.role === "lead");
  const memberUser = createdUsers.find((u) => u.user.role === "member");

  if (leadUser && adminUser) {
    await supabase
      .from("profiles")
      .update({
        reports_to: adminUser.id,
        direct_reports: [leadUser.id],
      })
      .eq("id", adminUser.id);

    await supabase
      .from("profiles")
      .update({ reports_to: adminUser.id })
      .eq("id", leadUser.id);

    console.log("\nReporting relationships established.");
  }

  if (memberUser && leadUser) {
    await supabase
      .from("profiles")
      .update({
        reports_to: leadUser.id,
        direct_reports: [memberUser.id],
      })
      .eq("id", leadUser.id);

    await supabase
      .from("profiles")
      .update({ reports_to: leadUser.id })
      .eq("id", memberUser.id);

    console.log("Lead → Member reporting relationship established.");
  }

  // Add lead + member to user_squads
  for (const u of createdUsers) {
    if (u.user.role === "lead" || u.user.role === "member") {
      const { error } = await supabase.from("user_squads").upsert(
        { user_id: u.id, squad_id: squad.id },
        { onConflict: "user_id,squad_id" }
      );
      if (error) {
        console.error(
          `  → Error adding ${u.user.email} to squad:`,
          error.message
        );
      } else {
        console.log(`  → ${u.user.email} added to squad QA-1.`);
      }
    }
  }

  console.log("\n✅ Seed complete.");
  console.log("\nDefault accounts:");
  console.log("  Super Admin: admin@qxnexus.local  / Admin@123");
  console.log("  Admin:       admin2@qxnexus.local / Admin@123");
  console.log("  Lead:        lead@qxnexus.local   / Lead@123");
  console.log("  Member:      member@qxnexus.local / Member@123");
  console.log("\n⚠️  Users will be forced to change password on first login.");
}

seed().catch(console.error);
