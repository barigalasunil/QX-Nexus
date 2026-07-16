import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gchjungfinbfzlkbedlv.supabase.co';
const supabaseAnonKey = 'sb_publishable_aHdAcNP0x994QQQSyZQrxA_Yn-wiUQo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const individualColumns = [
  'id', 'employee_id', 'full_name', 'email', 'role',
  'active', 'must_change_password',
  'project_id', 'squad_id',
  'reports_to', 'job_title', 'base_office',
  'birthday', 'permissions',
  'login_count', 'failed_login_attempts', 'locked_until', 'password_changed_at', 'login_history',
  'created_by', 'created_by_role', 'created_at', 'updated_at',
  'username', 'accessible_squads', 'direct_reports', 'login_count_without_birthday',
];

async function main() {
  for (const col of individualColumns) {
    const { error } = await supabase
      .from('profiles')
      .select(col)
      .limit(0);

    if (error) {
      console.log(`FAIL: ${col} - ${error.message}`);
    } else {
      console.log(`OK: ${col}`);
    }
  }
}

main().catch(console.error);
