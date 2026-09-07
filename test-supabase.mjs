import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

async function testInsert() {
  console.log('Testing Profile Upsert...');
  const { data: pData, error: pError } = await supabase.from('profiles').upsert(
    [{
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      full_name: 'Test User'
    }],
    { onConflict: 'id' }
  );
  if (pError) console.error('PROFILE UPSERT ERROR:', pError);
  else console.log('PROFILE UPSERT SUCCESS:', pData);
}

testInsert();
