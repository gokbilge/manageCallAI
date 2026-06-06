import { getSipServer } from '@/lib/provisioning/sip-provisioning';

export type CallTarget = {
  /** E.164 number or internal extension number */
  number: string;
  /** Display label shown on the button / tooltip */
  label: string;
};

export type ClickToCallResult =
  | { supported: true; href: string; scheme: 'sip' | 'tel' }
  | { supported: false; reason: 'no_sip_server' | 'no_number' };

/**
 * Builds the best call URI for a given target number.
 *
 * Internal extensions (1–6 digits, no + prefix) get a `sip:` URI so the
 * registered softphone handles the call directly.  All other numbers get a
 * `tel:` URI which the OS routes to the default phone/dialer app.
 *
 * Returns `supported: false` when the number is blank or a `sip:` URI is
 * needed but no SIP domain is configured.
 */
export function buildCallHref(number: string): ClickToCallResult {
  const n = number.trim();
  if (!n) return { supported: false, reason: 'no_number' };

  const isInternal = /^\d{1,6}$/.test(n);

  if (isInternal) {
    const server = getSipServer();
    if (!server) return { supported: false, reason: 'no_sip_server' };
    return { supported: true, href: `sip:${n}@${server}`, scheme: 'sip' };
  }

  return { supported: true, href: `tel:${n}`, scheme: 'tel' };
}

export const CALL_FALLBACK_MESSAGES: Record<
  'no_sip_server' | 'no_number',
  string
> = {
  no_sip_server:
    'SIP domain not configured — provision a softphone first to enable click-to-call.',
  no_number: 'No phone number available for this entry.',
};
