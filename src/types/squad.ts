export interface Squad {
  id: string;
  project_id: string;
  squad_code: string;
  squad_name: string;
  description?: string | null;
  active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}