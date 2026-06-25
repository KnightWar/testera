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

const email = 'admin@socse.edu';
const password = 'admin123';

async function main() {
  console.log(`Checking if admin user ${email} exists...`);
  
  // List users to find the matching email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  const existingUser = users.find(u => u.email === email);

  if (existingUser) {
    console.log(`Found existing user with ID: ${existingUser.id}. Updating password to: ${password}...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password,
      email_confirm: true
    });
    if (updateError) {
      console.error('Error updating password:', updateError.message);
      process.exit(1);
    }
    console.log('Success! Password updated to admin123.');
  } else {
    console.log(`User ${email} not found. Creating user with password: ${password}...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });
    if (createError) {
      console.error('Error creating user:', createError.message);
      process.exit(1);
    }
    console.log('Success! User created with password admin123. ID:', createData.user.id);
  }
  process.exit(0);
}

main();
