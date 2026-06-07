import type { LineAppearanceRepository } from './line-appearance.repository.js';
import type {
  AssignAppearanceInput,
  CreateLineAppearanceInput,
  DeviceAppearanceAssignment,
  LineAppearance,
  UpdateLineAppearanceInput,
} from './line-appearance.types.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type {
  EnterpriseVersion,
  EnterpriseValidationResult,
  EnterpriseSimulationResult,
  EnterpriseDryRunResult,
  EnterprisePublishAttemptResult,
} from '../shared/enterprise-lifecycle.types.js';
import type { Role } from '../auth/capabilities.js';

export class LineAppearanceNotFoundError extends Error {
  constructor(id: string) { super(`Line appearance not found: ${id}`); this.name = 'LineAppearanceNotFoundError'; }
}

export class AppearanceAssignmentNotFoundError extends Error {
  constructor(id: string) { super(`Appearance assignment not found: ${id}`); this.name = 'AppearanceAssignmentNotFoundError'; }
}

export class LineAppearanceService {
  constructor(
    private readonly repo: LineAppearanceRepository,
    private readonly lifecycleSvc?: EnterpriseLifecycleService,
  ) {}

  // ── Line appearances (#314) ───────────────────────────────────────────────

  create(tenantId: string, input: CreateLineAppearanceInput): Promise<LineAppearance> {
    return this.repo.create(
      tenantId,
      input.extension_id,
      input.label,
      input.appearance_index ?? 0,
      input.metadata ?? {},
    );
  }

  list(tenantId: string, extensionId?: string): Promise<LineAppearance[]> {
    return this.repo.findAll(tenantId, extensionId);
  }

  async getById(id: string, tenantId: string): Promise<LineAppearance> {
    const appearance = await this.repo.findById(id, tenantId);
    if (!appearance) throw new LineAppearanceNotFoundError(id);
    return appearance;
  }

  async update(id: string, tenantId: string, input: UpdateLineAppearanceInput): Promise<LineAppearance> {
    const appearance = await this.repo.update(id, tenantId, input);
    if (!appearance) throw new LineAppearanceNotFoundError(id);
    return appearance;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new LineAppearanceNotFoundError(id);
  }

  // ── Device appearance assignments (#315) ──────────────────────────────────

  assignToDevice(tenantId: string, input: AssignAppearanceInput): Promise<DeviceAppearanceAssignment> {
    return this.repo.assignToDevice(tenantId, input);
  }

  async removeFromDevice(assignmentId: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.removeFromDevice(assignmentId, tenantId);
    if (!deleted) throw new AppearanceAssignmentNotFoundError(assignmentId);
  }

  listByDevice(tenantId: string, deviceId: string): Promise<DeviceAppearanceAssignment[]> {
    return this.repo.listByDevice(tenantId, deviceId);
  }

  listByAppearance(tenantId: string, lineAppearanceId: string): Promise<DeviceAppearanceAssignment[]> {
    return this.repo.listByAppearance(tenantId, lineAppearanceId);
  }

  // ── Publish lifecycle (#319, #321) ────────────────────────────────────────

  private get lifecycle(): EnterpriseLifecycleService {
    if (!this.lifecycleSvc) throw new Error('EnterpriseLifecycleService not provided');
    return this.lifecycleSvc;
  }

  createVersion(appearanceId: string, tenantId: string, definition: Record<string, unknown>, createdBy?: string, metadata?: Record<string, unknown>): Promise<EnterpriseVersion> {
    return this.lifecycle.createVersion('line_appearance', appearanceId, tenantId, definition, createdBy, metadata);
  }

  listVersions(appearanceId: string, tenantId: string): Promise<EnterpriseVersion[]> {
    return this.lifecycle.listVersions('line_appearance', appearanceId, tenantId);
  }

  async validate(appearanceId: string, versionId: string, tenantId: string): Promise<EnterpriseValidationResult> {
    const appearance = await this.repo.findById(appearanceId, tenantId);
    if (!appearance) throw new LineAppearanceNotFoundError(appearanceId);
    return this.lifecycle.validate('line_appearance', appearanceId, versionId, tenantId, async () => {
      const errors: { field: string; message: string }[] = [];
      if (!appearance.label || appearance.label.trim().length === 0) {
        errors.push({ field: 'label', message: 'Line appearance label is required.' });
      }
      if (appearance.appearance_index < 0) {
        errors.push({ field: 'appearance_index', message: 'appearance_index must be >= 0.' });
      }
      return { status: errors.length === 0 ? 'passed' : 'failed', errors, warnings: [] };
    });
  }

  async simulate(appearanceId: string, versionId: string, tenantId: string, scenario: Record<string, unknown>): Promise<EnterpriseSimulationResult> {
    const appearance = await this.repo.findById(appearanceId, tenantId);
    if (!appearance) throw new LineAppearanceNotFoundError(appearanceId);
    const outcome = {
      status: 'passed',
      appearance_id: appearanceId,
      label: appearance.label,
      appearance_index: appearance.appearance_index,
      scenario,
      notes: 'Line appearance configuration is structurally valid.',
    };
    return this.lifecycle.simulate('line_appearance', appearanceId, versionId, tenantId, scenario, async () => outcome);
  }

  dryRunPublish(appearanceId: string, versionId: string, tenantId: string, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user', actorRole?: Role): Promise<EnterpriseDryRunResult> {
    return this.lifecycle.dryRunPublish('line_appearance', appearanceId, versionId, tenantId, actorType, actorRole);
  }

  publish(appearanceId: string, versionId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.publish('line_appearance', appearanceId, versionId, tenantId, triggeredById, actorRole, actorType);
  }

  rollback(appearanceId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.rollback('line_appearance', appearanceId, tenantId, triggeredById, actorRole, actorType);
  }
}
