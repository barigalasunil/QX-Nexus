const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gchjungfinbfzlkbedlv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaGp1bmdmaW5iZnpsa2JlZGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzA0NjEyOSwiZXhwIjoyMDk4NjIyMTI5fQ.vi5KOiHWwMHElFjoXO6Db_rq21YSq07YkNXD9HJ8fuE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkSchema() {
  // Check profiles table columns using SQL
  const { data: columns, error: colError } = await supabase.rpc('get_profile_columns');
  if (colError) console.error('Columns error:', colError);
  else console.table(columns);
  
  // Check indexes
  const { data: indexes, error: idxError } = await supabase
    .from('pg_indexes')
    .select('indexname, indexdef')
    .eq('tablename', 'profiles')
    .eq('schemaname', 'public')
    .order('indexname');
  if (idxError) console.error('Indexes error:', idxError);
  else console.table(indexes);
  
  // Check foreign keys
  const { data: fkCols, error: fkColsError } = await supabase
    .from('information_schema.key_column_usage')
    .select('constraint_name, column_name, referenced_table_name, referenced_column_name')
    .eq('table_name', 'profiles')
    .eq('table_schema', 'public');
  if (fkColsError) console.error('FK cols error:', fkColsError);
  else console.table(fkCols);
  
  // Check RLS policies
  const { data: policies, error: polError } = await supabase
    .from('pg_policies')
    .select('schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check')
    .eq('tablename', 'profiles')
    .eq('schemaname', 'public');
  if (polError) console.error('Policies error:', polError);
  else console.table(policies);
}

checkSchema();