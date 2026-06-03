import { Pool } from 'pg';
import { config } from '../../config/env.js';
import { RetentionPurgeService } from './retention-purge.service.js';
import { LocalStorageBackend } from './storage-backend.js';

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const dryRun = hasFlag('--dry-run');
const jsonOutput = hasFlag('--json');

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to run the retention purge job');
}

const pool = new Pool({ connectionString: config.databaseUrl });

try {
  const storage = dryRun ? undefined : new LocalStorageBackend();
  const service = new RetentionPurgeService(pool, undefined, storage);
  const result = await service.run({ dryRun, actorId: 'worker:retention-purge' });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Retention purge ${dryRun ? 'dry-run' : 'run'} completed`);
    for (const item of result.results) {
      console.log(`${item.tenant_id} ${item.category}: ${item.record_count} record(s), cutoff ${item.cutoff}`);
    }
  }
} finally {
  await pool.end();
}
