const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gchjungfinbfzlkbedlv.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjaGp1bmdmaW5iZnpsa2JlZGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzA0NjEyOSwiZXhwIjoyMDk4NjIyMTI5fQ.vi5KOiHWwMHElFjoXO6Db_rq21YSq07YkNXD9HJ8fuE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testCreateUser() {
  // First get a caller (superadmin) - database stores "Super Admin"
  const { data: caller, error: callerError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('role', 'Super Admin')
    .single();
  
  if (callerError || !caller) {
    console.error('No superadmin found');
    return;
  }
  
  console.log('Caller:', caller);
  
  // Get a project and squad
  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_name')
    .limit(1);
    
  const { data: squads } = await supabase
    .from('squads')
    .select('id, squad_name')
    .limit(1);
  
  console.log('Project:', projects?.[0]);
  console.log('Squad:', squads?.[0]);
  
  // Call the Edge Function directly
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPass123!',
    full_name: `Test User ${Date.now()}`,
    employee_id: `EMP${Date.now()}`,
    role: 'member',
    project_id: projects?.[0]?.id || null,
    squad_id: squads?.[0]?.id || null,
    reports_to: caller.id,
    job_title: 'Test Engineer',
    base_office: 'Bengaluru',
    permissions: { dashboard: 'view', dataEntry: 'edit' },
    accessible_squads: [squads?.[0]?.id || ''],
    direct_reports: [],
    created_by: caller.id,
    created_by_role: 'superadmin',
  };
  
  console.log('\n--- Sending to Edge Function ---');
  console.log(JSON.stringify(testUser, null, 2));
  
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: testUser,
  });
  
  console.log('\n--- Edge Function Response ---');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', JSON.stringify(data, null, 2));
    
    if (data.profile) {
      console.log('\n--- Inserted Profile ---');
      console.log('project_id:', data.profile.project_id);
      console.log('squad_id:', data.profile.squad_id);
      console.log('reports_to:', data.profile.reports_to);
      console.log('job_title:', data.profile.job_title);
      console.log('base_office:', data.profile.base_office);
    }
  }
}

testCreateUser().catch(console.error);