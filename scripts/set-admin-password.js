const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found. Please create it first.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Please configure real Supabase credentials in your .env.local file first.');
  process.exit(1);
}

// Create Supabase Admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const admins = [
  { email: 'admin1@pravAI.org', password: 'admin123' },
  { email: 'admin2@pravAI.org', password: 'admin123' }
];

async function main() {
  // List users to find existing emails
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  for (const admin of admins) {
    const existingUser = users.find(u => u.email === admin.email);

    if (existingUser) {
      console.log(`Found existing user: ${admin.email} (ID: ${existingUser.id}). Updating password to ${admin.password}...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: admin.password,
        email_confirm: true
      });
      if (updateError) {
        console.error(`Error updating password for ${admin.email}:`, updateError.message);
      } else {
        console.log(`Success! Password updated for ${admin.email}.`);
      }
    } else {
      console.log(`User ${admin.email} not found. Creating user with password ${admin.password}...`);
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true
      });
      if (createError) {
        console.error(`Error creating user ${admin.email}:`, createError.message);
      } else {
        console.log(`Success! User created: ${admin.email}. ID: ${createData.user.id}`);
      }
    }
  }
  process.exit(0);
}

main();
