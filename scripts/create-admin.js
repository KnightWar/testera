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
    // Remove wrapping quotes if present
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('dummy-supabase-url-please-replace')) {
  console.error('Error: Please configure real Supabase credentials in your .env.local file first.');
  process.exit(1);
}

// Get arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('\nUsage: node scripts/create-admin.js <email> <password>');
  console.log('Example: node scripts/create-admin.js admin@socse.edu mysecurepassword\n');
  process.exit(1);
}

const [email, password] = args;

// Create Supabase Admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  console.log(`Attempting to create admin user: ${email}...`);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true // Auto-confirm email so they can log in immediately
  });

  if (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }

  console.log('Success! Admin user created successfully.');
  console.log('User ID:', data.user.id);
  process.exit(0);
}

createAdmin();
