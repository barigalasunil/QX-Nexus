import { Squad } from "@/types";

export interface ISquadRepository {
  fetchSquads(): Promise<Squad[]>;

  createSquad(
    squad: Omit<Squad, "id" | "created_at" | "updated_at">
  ): Promise<Squad>;

  deleteSquad(id: string): Promise<void>;

  isSquadCodeExists(code: string): Promise<boolean>;

  isSquadNameExists(
    projectId: string,
    squadName: string
  ): Promise<boolean>;
}