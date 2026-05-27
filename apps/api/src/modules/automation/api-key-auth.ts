import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { AutomationRepository } from './automation.repository.js';

const repo = new AutomationRepository(db);

export async function resolveApiKey(rawKey: string): Promise<AuthClaims | null> {
  const keyHash = AutomationRepository.hashKey(rawKey);
  const record = await repo.findApiKeyByHash(keyHash);
  if (!record) return null;
  return { sub: record.id, tenant_id: record.tenant_id, email: '', role: 'tenant_admin' };
}
