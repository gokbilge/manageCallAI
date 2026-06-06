import type { LineAppearanceRepository } from './line-appearance.repository.js';
import type {
  AssignAppearanceInput,
  CreateLineAppearanceInput,
  DeviceAppearanceAssignment,
  LineAppearance,
  UpdateLineAppearanceInput,
} from './line-appearance.types.js';

export class LineAppearanceNotFoundError extends Error {
  constructor(id: string) { super(`Line appearance not found: ${id}`); this.name = 'LineAppearanceNotFoundError'; }
}

export class AppearanceAssignmentNotFoundError extends Error {
  constructor(id: string) { super(`Appearance assignment not found: ${id}`); this.name = 'AppearanceAssignmentNotFoundError'; }
}

export class LineAppearanceService {
  constructor(private readonly repo: LineAppearanceRepository) {}

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
}
