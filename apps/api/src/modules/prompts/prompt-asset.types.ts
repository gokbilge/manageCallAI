export interface PromptAsset {
  id: string;
  tenant_id: string;
  name: string;
  media_type: string;
  language: string | null;
  storage_uri: string | null;
  checksum: string | null;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface CreatePromptAssetInput {
  tenant_id: string;
  name: string;
  media_type: string;
  language?: string;
  storage_uri: string;
  checksum?: string;
}

export interface UpdatePromptAssetInput {
  name?: string;
  media_type?: string;
  language?: string | null;
  storage_uri?: string | null;
  checksum?: string | null;
  status?: PromptAsset['status'];
}
