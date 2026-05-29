import type { IngestRecordingInput, Recording } from './recording.types.js';
import type { RecordingRepository } from './recording.repository.js';

export class RecordingNotFoundError extends Error {
  constructor(id: string) {
    super(`Recording not found: ${id}`);
    this.name = 'RecordingNotFoundError';
  }
}

export class RecordingService {
  constructor(private readonly repo: RecordingRepository) {}

  async ingest(input: IngestRecordingInput): Promise<Recording> {
    return this.repo.create(input);
  }

  async listByTenant(tenantId: string, callId?: string): Promise<Recording[]> {
    return this.repo.listByTenant(tenantId, callId);
  }

  async getById(id: string, tenantId: string): Promise<Recording> {
    const recording = await this.repo.findById(id, tenantId);
    if (!recording) throw new RecordingNotFoundError(id);
    return recording;
  }
}
