export type ExtensionStatus = 'active' | 'inactive';
export type DestinationType = 'flow' | 'extension' | 'user' | 'queue';

export interface Extension {
  id: string;
  tenant_id: string;
  extension_number: string;
  display_name: string;
  status: ExtensionStatus;
  sip_username: string;
  default_destination_type: DestinationType | null;
  default_destination_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// What the HTTP client sends on POST — tenant_id comes from the JWT, not the body.
export interface CreateExtensionBody {
  extension_number: string;
  display_name: string;
  sip_username?: string;
  sip_password: string;
  default_destination_type?: DestinationType;
  default_destination_id?: string;
}

// Full service/repository input — controller adds tenant_id from JWT.
export type CreateExtensionInput = CreateExtensionBody & { tenant_id: string };

export interface UpdateExtensionInput {
  extension_number?: string;
  display_name?: string;
  status?: ExtensionStatus;
  sip_username?: string;
  sip_password?: string;
  default_destination_type?: DestinationType | null;
  default_destination_id?: string | null;
}

export interface DirectoryExtension extends Extension {
  sip_password: string;
  directory_domain: string;
}
