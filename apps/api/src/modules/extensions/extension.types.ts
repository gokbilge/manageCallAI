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

// What the HTTP client sends on POST - tenant_id comes from the JWT, not the body.
export interface CreateExtensionBody {
  extension_number: string;
  display_name: string;
  sip_username?: string;
  sip_password: string; // plaintext; service encrypts before storage
  default_destination_type?: DestinationType;
  default_destination_id?: string;
}

// Full service input - controller adds tenant_id from JWT.
export type CreateExtensionInput = CreateExtensionBody & { tenant_id: string };

// What the service passes to the repository after encrypting the password.
export interface CreateExtensionRepoInput {
  tenant_id: string;
  extension_number: string;
  display_name: string;
  sip_username?: string;
  sip_password_ciphertext: string;
  sip_password_key_id: string;
  default_destination_type?: DestinationType;
  default_destination_id?: string;
}

// What the HTTP client sends on PATCH - sip_password is plaintext; service encrypts.
export interface UpdateExtensionInput {
  extension_number?: string;
  display_name?: string;
  status?: ExtensionStatus;
  sip_username?: string;
  sip_password?: string; // plaintext; service encrypts before storage
  default_destination_type?: DestinationType | null;
  default_destination_id?: string | null;
}

// What the service passes to the repository after encrypting the password.
export interface UpdateExtensionRepoInput {
  extension_number?: string;
  display_name?: string;
  status?: ExtensionStatus;
  sip_username?: string;
  sip_password_ciphertext?: string;
  sip_password_key_id?: string;
  default_destination_type?: DestinationType | null;
  default_destination_id?: string | null;
}

// Returned only by the directory-lookup query; never sent to HTTP clients.
export interface DirectoryExtension extends Extension {
  sip_password_ciphertext: string;
  sip_password_key_id: string;
  directory_domain: string;
}
