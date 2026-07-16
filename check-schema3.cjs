const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gchjungfinbfzlkbedlv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaGp1bmdmaW5iemxrYmVkbHYiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzgzMDQ2MTI5LCJleHAiOjIwOTg2MjIxMjl9.vi5KOiHWwMHElFjoXO6Db_rq21YSq07YkNXD9HJ8fuE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkSchema() {
  // Check indexes using information_schema
  const { data: indexes, error: idxError } = await supabase
    .from('pg_indexes')
    .select('indexname, indexdef')
    .eq('tablename', 'profiles')
    .eq('schemaname', 'public')
    .order('indexname');
  
  if (idxError) console.error('Indexes error:', idxError);
  else console.table(indexes);
  
  // Check foreign keys
  const { data: fks, error: fkError } = await supabase
    .from('information_schema.table_constraints')
    .select('constraint_name, table_name')
    .eq('constraint_type', 'FOREIGN KEY')
    .eq('table_name', 'profiles')
    .eq('table_schema', 'public');
  
  if (fkError) console.error('FKs error:', fkError);
  else console.table(fks);
  
  // Check FK columns
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