export interface Project {
  id: string;

  project_code: string;

  project_name: string;

  description: string | null;

  active: boolean;

  created_by?: string | null;

  created_at?: string;

  updated_at?: string;
}