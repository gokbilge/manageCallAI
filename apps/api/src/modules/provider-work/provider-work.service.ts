import type { ProviderWorkRepository } from './provider-work.repository.js';
import type {
  ClaimWorkRequestInput,
  CompleteIvrAiTurnInput,
  CompletePromptGenerationInput,
  CreateIvrAiTurnInput,
  CreatePromptGenerationInput,
  IvrAiTurnRequest,
  PromptGenerationRequest,
} from './provider-work.types.js';

export class ProviderWorkRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Provider work request not found or not claimable: ${id}`);
    this.name = 'ProviderWorkRequestNotFoundError';
  }
}

export class ProviderWorkService {
  constructor(private readonly repo: ProviderWorkRepository) {}

  createPromptGeneration(tenantId: string, input: CreatePromptGenerationInput): Promise<PromptGenerationRequest> {
    this.validateOutputs(input.requested_outputs);
    return this.repo.createPromptGeneration(tenantId, input);
  }

  listPromptGenerations(tenantId: string): Promise<PromptGenerationRequest[]> {
    return this.repo.listPromptGenerations(tenantId);
  }

  async getPromptGeneration(id: string, tenantId: string): Promise<PromptGenerationRequest> {
    const request = await this.repo.findPromptGeneration(id, tenantId);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async claimPromptGeneration(id: string, input: ClaimWorkRequestInput): Promise<PromptGenerationRequest> {
    const request = await this.repo.claimPromptGeneration(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async completePromptGeneration(id: string, input: CompletePromptGenerationInput): Promise<PromptGenerationRequest> {
    const request = await this.repo.completePromptGeneration(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  createIvrAiTurn(tenantId: string, input: CreateIvrAiTurnInput): Promise<IvrAiTurnRequest> {
    this.validateOutputs(input.requested_outputs);
    return this.repo.createIvrAiTurn(tenantId, input);
  }

  async getIvrAiTurn(id: string, tenantId: string): Promise<IvrAiTurnRequest> {
    const request = await this.repo.findIvrAiTurn(id, tenantId);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async claimIvrAiTurn(id: string, input: ClaimWorkRequestInput): Promise<IvrAiTurnRequest> {
    const request = await this.repo.claimIvrAiTurn(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async completeIvrAiTurn(id: string, input: CompleteIvrAiTurnInput): Promise<IvrAiTurnRequest> {
    const request = await this.repo.completeIvrAiTurn(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  private validateOutputs(outputs: string[]): void {
    if (!Array.isArray(outputs) || outputs.length === 0 || outputs.some((output) => output.length < 1)) {
      throw new Error('requested_outputs must contain at least one output');
    }
  }
}
