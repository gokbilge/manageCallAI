export type CommercialSchemaName =
  | 'managecallai_commercial'
  | 'managecallai_enterprise';

export type CommercialEdition = 'pro' | 'enterprise';

export interface PrivateMigrationDescriptor {
  /** Globally unique migration ID within the module, e.g. "commercial-0001" */
  id: string;
  /** Owner module identifier, e.g. "managecallai-commercial" */
  moduleId: string;
  edition: CommercialEdition;
  schema: CommercialSchemaName;
  /** Migration filename relative to the private module root */
  filename: string;
  /** SHA-256 hex digest of the migration file contents */
  checksum: string;
  description: string;
}

export interface PrivateSchemaModuleDescriptor {
  moduleId: string;
  edition: CommercialEdition;
  /** PostgreSQL schemas this module requires to exist before running migrations */
  requiredSchemas: CommercialSchemaName[];
  migrations: PrivateMigrationDescriptor[];
  /** Entitlement capability keys from the public framework that this module requires */
  requiredEntitlements: string[];
}

export interface MigrationRunnerHooks {
  /** Called after all public migrations complete successfully */
  onPublicMigrationsComplete?(context: MigrationContext): Promise<void>;
  /** Returns private module descriptors to be applied after public migrations */
  resolvePrivateDescriptors?(): Promise<PrivateSchemaModuleDescriptor[]>;
}

export interface MigrationContext {
  /** Number of public migrations applied in this run */
  appliedCount: number;
  /** Highest public migration prefix applied */
  highestPrefix: number;
  /** Whether this is a dry-run (check) mode */
  dryRun: boolean;
}
