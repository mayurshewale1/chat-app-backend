/**
 * One-time cleanup: permanently delete users where active = false.
 *
 * Usage:
 *   node scripts/purge_inactive_users.js --dry-run
 *   node scripts/purge_inactive_users.js --execute
 *
 * Notes:
 * - This deletes ONLY from `users` table. If you need to delete related rows too,
 *   we can extend this script.
 */

require('dotenv').config();

const { connectDB, query, getPool } = require('../src/config/db');

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasFlag('--dry-run') || !hasFlag('--execute');

  await connectDB();

  const countRes = await query(
    "SELECT COUNT(*)::int AS count FROM users WHERE COALESCE(active, true) = false"
  );
  const count = countRes.rows[0]?.count ?? 0;
  console.log(`[purge_inactive_users] inactive users: ${count}`);

  if (count === 0) {
    await getPool().end();
    return;
  }

  const sampleRes = await query(
    "SELECT id, username, uid, created_at FROM users WHERE COALESCE(active, true) = false ORDER BY created_at DESC LIMIT 20"
  );
  console.log('[purge_inactive_users] sample (up to 20):');
  sampleRes.rows.forEach((r) => console.log(`- ${r.id} @${r.username} ${r.uid} ${r.created_at}`));

  if (dryRun) {
    console.log('[purge_inactive_users] DRY RUN (no deletes). Re-run with --execute to delete.');
    await getPool().end();
    return;
  }

  // Delete inactive users only. (FK constraints may block delete if not ON DELETE CASCADE)
  const delRes = await query(
    "DELETE FROM users WHERE COALESCE(active, true) = false"
  );
  console.log(`[purge_inactive_users] deleted rows: ${delRes.rowCount}`);

  await getPool().end();
}

main().catch(async (err) => {
  console.error('[purge_inactive_users] failed:', err);
  try {
    getPool().end();
  } catch {}
  process.exit(1);
});

