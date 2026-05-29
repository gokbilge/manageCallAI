import { resolve, sep } from 'node:path';
import type {
  ClaimRecordingAnalysisInput,
  CompleteRecordingAnalysisInput,
  CreateRecordingAnalysisInput,
  IngestRecordingInput,
  Recording,
  RecordingAnalysisRequest,
} from './recording.types.js';
import type { RecordingRepository } from './recording.repository.js';

export class RecordingNotFoundError extends Error {
  constructor(id: string) {
    super(`Recording not found: ${id}`);
    this.name = 'RecordingNotFoundError';
  }
}

export class RecordingPlaybackPathError extends Error {
  constructor() {
    super('Recording media is not available through the configured storage root');
    this.name = 'RecordingPlaybackPathError';
  }
}

export class RecordingService {
  constructor(
    private readonly repo: RecordingRepository,
    private readonly storageRoot = resolve('recordings'),
  ) {}

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

  async getPlaybackPath(id: string, tenantId: string): Promise<{ recording: Recording; file_path: string }> {
    const recording = await this.getById(id, tenantId);
    if (recording.status !== 'available') throw new RecordingPlaybackPathError();

    const root = resolve(this.storageRoot);
    const candidate = resolve(root, recording.storage_path);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      throw new RecordingPlaybackPathError();
    }

    return { recording, file_path: candidate };
  }

  async createAnalysisRequest(
    recordingId: string,
    tenantId: string,
    input: CreateRecordingAnalysisInput,
  ): Promise<RecordingAnalysisRequest> {
    this.validateRequestedOutputs(input.requested_outputs);
    const request = await this.repo.createAnalysisRequest(recordingId, tenantId, input);
    if (!request) throw new RecordingNotFoundError(recordingId);
    return request;
  }

  async listAnalysisRequests(recordingId: string, tenantId: string): Promise<RecordingAnalysisRequest[]> {
    const recording = await this.repo.findById(recordingId, tenantId);
    if (!recording) throw new RecordingNotFoundError(recordingId);
    return this.repo.listAnalysisRequests(recordingId, tenantId);
  }

  async getAnalysisRequest(id: string, tenantId: string): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.findAnalysisRequest(id, tenantId);
    if (!request) throw new RecordingNotFoundError(id);
    return request;
  }

  async claimAnalysisRequest(id: string, input: ClaimRecordingAnalysisInput): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.claimAnalysisRequest(id, input);
    if (!request) throw new RecordingNotFoundError(id);
    return request;
  }

  async completeAnalysisRequest(id: string, input: CompleteRecordingAnalysisInput): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.completeAnalysisRequest(id, input);
    if (!request) throw new RecordingNotFoundError(id);
    return request;
  }

  private validateRequestedOutputs(outputs: string[]): void {
    const allowed = new Set(['transcript', 'summary']);
    if (outputs.length === 0 || outputs.some((output) => !allowed.has(output))) {
      throw new Error('requested_outputs must contain transcript, summary, or both');
    }
  }
}
