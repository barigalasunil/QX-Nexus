import { supabase } from "@/lib/supabase";
import { ISquadRepository } from "@/repositories/ISquadRepository";
import { Squad } from "@/types/squad";

export class SquadRepository implements ISquadRepository {
  async fetchSquads(): Promise<Squad[]> {
    const { data, error } = await supabase
      .from("squads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load squads. ${error.message}`);
    }

    return (data ?? []) as Squad[];
  }

  async createSquad(
    squad: Omit<Squad, "id" | "created_at" | "updated_at">
  ): Promise<Squad> {
    const { data, error } = await supabase
      .from("squads")
      .insert(squad)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Unable to create squad. ${error?.message ?? ""}`);
    }

    return data as Squad;
  }

  async deleteSquad(id: string): Promise<void> {
    const { error } = await supabase.from("squads").delete().eq("id", id);

    if (error) {
      throw new Error(`Unable to delete squad. ${error.message}`);
    }
  }

  async isSquadCodeExists(code: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("squads")
      .select("id", { count: "exact", head: true })
      .eq("squad_code", code);

    if (error) {
      throw new Error(`Unable to check squad code. ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async isSquadNameExists(
    projectId: string,
    squadName: string
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from("squads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("squad_name", squadName);

    if (error) {
      throw new Error(`Unable to check squad name. ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}

export const squadRepository = new SquadRepository();
