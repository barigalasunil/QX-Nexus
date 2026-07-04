import { supabase } from "../lib/supabase";

export async function testSupabaseConnection() {
  console.log("Testing Supabase...");

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .limit(1);

  console.log("DATA:", data);
  console.log("ERROR:", error);
}