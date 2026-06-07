export type ManageCallAIEdition = 'free' | 'pro' | 'enterprise';

export interface CapabilityMetadata {
  description?: string;
  minimumEdition?: ManageCallAIEdition;
  category?: string;
  experimental?: boolean;
}

export interface QuotaMetadata {
  unit: 'tenant' | 'user' | 'extension' | 'call' | 'node' | 'custom';
  description?: string;
  defaultLimit?: number | null;
}

export interface ManageCallAIModule {
  id: string;
  name: string;
  edition: ManageCallAIEdition;
  version: string;
  registerCapabilities?(registry: CapabilityRegistry): void | Promise<void>;
  registerApiRoutes?(context: ModuleApiContext): void | Promise<void>;
  registerWorkers?(registry: WorkerRegistry): void | Promise<void>;
  registerUiExtensions?(registry: UiExtensionRegistry): void | Promise<void>;
  registerAuditEvents?(registry: AuditEventRegistry): void | Promise<void>;
}

export interface CapabilityRegistry {
  registerFeature(key: string, metadata: CapabilityMetadata): void;
  registerQuota(key: string, metadata: QuotaMetadata): void;
}

export interface ModuleApiContext {
  app: unknown;
  entitlementService: unknown;
  auditService?: unknown;
}

export interface WorkerRegistry {
  registerWorker(id: string, handlerRef: unknown): void;
}

export interface UiExtensionRegistry {
  registerExtension(slot: string, extensionRef: unknown): void;
}

export interface AuditEventRegistry {
  registerAuditEventType(key: string, metadata: unknown): void;
}

export class InMemoryCapabilityRegistry implements CapabilityRegistry {
  readonly features = new Map<string, CapabilityMetadata>();
  readonly quotas = new Map<string, QuotaMetadata>();

  registerFeature(key: string, metadata: CapabilityMetadata): void {
    this.features.set(key, metadata);
  }

  registerQuota(key: string, metadata: QuotaMetadata): void {
    this.quotas.set(key, metadata);
  }
}

export class NoopWorkerRegistry implements WorkerRegistry {
  readonly workers = new Map<string, unknown>();

  registerWorker(id: string, handlerRef: unknown): void {
    this.workers.set(id, handlerRef);
  }
}

export class NoopUiExtensionRegistry implements UiExtensionRegistry {
  readonly extensions = new Map<string, unknown[]>();

  registerExtension(slot: string, extensionRef: unknown): void {
    const existing = this.extensions.get(slot) ?? [];
    existing.push(extensionRef);
    this.extensions.set(slot, existing);
  }
}

export class NoopAuditEventRegistry implements AuditEventRegistry {
  readonly auditEventTypes = new Map<string, unknown>();

  registerAuditEventType(key: string, metadata: unknown): void {
    this.auditEventTypes.set(key, metadata);
  }
}

export class StaticModuleRegistry {
  readonly modules: ManageCallAIModule[] = [];

  registerModule(module: ManageCallAIModule): void {
    if (this.modules.some((existing) => existing.id === module.id)) {
      throw new Error(`module already registered: ${module.id}`);
    }
    this.modules.push(module);
  }

  listModules(): ManageCallAIModule[] {
    return [...this.modules];
  }
}
