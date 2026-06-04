/**
 * Global emergency number set used across the API to enforce non-bypassable
 * outbound call blocks, feature-code collision detection, and fraud policy
 * evaluation ordering.
 *
 * Covers the ITU-T E.164 well-known emergency codes for the primary supported
 * markets. This is a static block; the product does not support per-tenant
 * emergency number overrides because doing so would constitute accepting
 * E911/emergency-routing responsibility that belongs to the operator/carrier.
 *
 * US E911 note: The product blocks 911 at the API layer and at the outbound-
 * call fraud-service layer. Geo-routing, PSAP connectivity, and callback
 * address provisioning are operator and carrier responsibilities. See
 * docs/ops/emergency-routing.md for the full deployment guidance.
 */
export const GLOBAL_EMERGENCY_NUMBERS: ReadonlySet<string> = new Set([
  '000',  // Australia / NZ
  '110',  // China police / fire
  '112',  // GSM/EU universal emergency
  '118',  // Italy medical
  '119',  // South Korea emergency
  '911',  // North America (US/Canada/Mexico)
  '999',  // UK / some Commonwealth countries
]);

/**
 * Returns true if the given digit string is a globally blocked emergency
 * number. The check is normalised to strip any leading '+' so that E.164-
 * formatted inputs are also caught.
 */
export function isGlobalEmergencyNumber(digits: string): boolean {
  return GLOBAL_EMERGENCY_NUMBERS.has(digits.replace(/^\+/, ''));
}
