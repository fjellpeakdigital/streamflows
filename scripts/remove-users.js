#!/usr/bin/env node
/**
 * StreamFlows — remove-users.js
 *
 * Admin utility to list and delete Supabase auth users.
 * Requires SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) from .env.local.
 *
 * Usage:
 *   node scripts/remove-users.js                   # list all users
 *   node scripts/remove-users.js user@example.com  # delete by email
 *   node scripts/remove-users.js <uuid>            # delete by user ID
 *   node scripts/remove-users.js --all             # delete ALL users (with confirmation)
 */

const fs   = require('fs');
const path = require('path');
const readline = require('readline');

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found. Create it with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

// ── Supabase admin helpers (raw fetch — no import needed) ────────────────────
const ADMIN_URL = `${SUPABASE_URL}/auth/v1/admin/users`;
const HEADERS   = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function listUsers() {
  const res  = await fetch(`${ADMIN_URL}?page=1&per_page=1000`, { headers: HEADERS });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? JSON.stringify(body));
  return body.users ?? [];
}

async function deleteUser(id) {
  const res  = await fetch(`${ADMIN_URL}/${id}`, { method: 'DELETE', headers: HEADERS });
  if (res.status === 204) return; // success, no body
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? JSON.stringify(body));
}

// ── Prompt helper ─────────────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

// ── Display helpers ───────────────────────────────────────────────────────────
function formatUser(u) {
  const name   = u.user_metadata?.full_name ?? '—';
  const region = u.user_metadata?.home_region ?? u.user_metadata?.state ?? '—';
  const conf   = u.email_confirmed_at ? 'confirmed' : 'unconfirmed';
  return `  ${u.email.padEnd(36)} ${name.padEnd(24)} region=${region.padEnd(4)} ${conf}  [${u.id}]`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];

  // ── List ──
  if (!arg || arg === '--list') {
    const users = await listUsers();
    if (users.length === 0) {
      console.log('No users found.');
      return;
    }
    console.log(`\n${users.length} user(s):\n`);
    console.log(`  ${'EMAIL'.padEnd(36)} ${'NAME'.padEnd(24)} ${'REGION'.padEnd(11)} ${'ID'}`);
    console.log('  ' + '─'.repeat(100));
    users.forEach((u) => console.log(formatUser(u)));
    console.log('');
    return;
  }

  // ── Delete all ──
  if (arg === '--all') {
    const users = await listUsers();
    if (users.length === 0) { console.log('No users to delete.'); return; }
    console.log(`\nAbout to delete ALL ${users.length} user(s):\n`);
    users.forEach((u) => console.log(formatUser(u)));
    const ans = await ask(`\nType DELETE to confirm: `);
    if (ans !== 'DELETE') { console.log('Aborted.'); return; }
    for (const u of users) {
      await deleteUser(u.id);
      console.log(`Deleted ${u.email}`);
    }
    console.log('\nDone.');
    return;
  }

  // ── Delete by email or ID ──
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg);

  const users = await listUsers();
  let target;

  if (isUuid) {
    target = users.find((u) => u.id === arg);
    if (!target) { console.error(`No user found with ID: ${arg}`); process.exit(1); }
  } else {
    // treat as email
    target = users.find((u) => u.email?.toLowerCase() === arg.toLowerCase());
    if (!target) { console.error(`No user found with email: ${arg}`); process.exit(1); }
  }

  console.log(`\nAbout to delete:\n`);
  console.log(formatUser(target));
  const ans = await ask('\nConfirm? [y/N] ');
  if (ans.toLowerCase() !== 'y') { console.log('Aborted.'); return; }

  await deleteUser(target.id);
  console.log(`\nDeleted ${target.email}.`);
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
