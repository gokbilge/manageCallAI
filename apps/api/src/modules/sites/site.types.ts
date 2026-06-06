export type SiteStatus = 'active' | 'inactive';

export interface Site {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country_code: string | null;
  timezone: string | null;
  language_code: string | null;
  network_zone: string | null;
  emergency_number: string;
  emergency_outbound_route_id: string | null;
  default_calling_policy_id: string | null;
  default_numbering_plan_id: string | null;
  default_outbound_route_id: string | null;
  status: SiteStatus;
  created_at: Date;
  updated_at: Date;
}

export interface SiteLocation {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  description: string | null;
  floor: string | null;
  room: string | null;
  created_at: Date;
}

export interface CreateSiteInput {
  name: string;
  description?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_region?: string;
  postal_code?: string;
  country_code?: string;
  timezone?: string;
  language_code?: string;
  network_zone?: string;
  emergency_number?: string;
  emergency_outbound_route_id?: string | null;
  default_calling_policy_id?: string | null;
  default_numbering_plan_id?: string | null;
  default_outbound_route_id?: string | null;
}

export interface UpdateSiteInput {
  name?: string;
  description?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  timezone?: string | null;
  language_code?: string | null;
  network_zone?: string | null;
  emergency_number?: string;
  emergency_outbound_route_id?: string | null;
  default_calling_policy_id?: string | null;
  default_numbering_plan_id?: string | null;
  default_outbound_route_id?: string | null;
  status?: SiteStatus;
}

export interface CreateSiteLocationInput {
  name: string;
  description?: string;
  floor?: string;
  room?: string;
}

export interface SiteWithLocations extends Site {
  locations: SiteLocation[];
}
