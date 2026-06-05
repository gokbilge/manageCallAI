import QRCode from 'qrcode';

export interface SipProvisioningConfig {
  sip_username: string;
  sip_password: string;
  sip_server: string;
}

export function getSipServer(): string {
  const explicit = import.meta.env.VITE_SIP_DOMAIN as string | undefined;
  if (explicit) return explicit;
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (apiBase) {
    try {
      return new URL(apiBase).hostname;
    } catch { /* ignore */ }
  }
  return '';
}

export function buildSipUri(config: SipProvisioningConfig): string {
  return `sip:${config.sip_username}:${config.sip_password}@${config.sip_server}`;
}

export async function generateProvisioningQr(config: SipProvisioningConfig): Promise<string> {
  const uri = buildSipUri(config);
  return QRCode.toDataURL(uri, { width: 220, margin: 1, errorCorrectionLevel: 'M' });
}

export const SUPPORTED_SIP_CLIENTS: Array<{
  name: string;
  platforms: string;
  url: string;
  notes: string;
}> = [
  {
    name: 'Zoiper',
    platforms: 'iOS · Android · Windows · macOS · Linux',
    url: 'https://www.zoiper.com/en/voip-softphone/download/current',
    notes: 'Scan the QR code directly from the app login screen.',
  },
  {
    name: 'Linphone',
    platforms: 'iOS · Android · Windows · macOS · Linux',
    url: 'https://www.linphone.org/releases',
    notes: 'Open the app, tap "Use SIP account", then scan the QR code.',
  },
  {
    name: 'MicroSIP',
    platforms: 'Windows only',
    url: 'https://www.microsip.org/downloads',
    notes: 'Manual entry: Add account → SIP server, username, password.',
  },
  {
    name: 'Bria (CounterPath)',
    platforms: 'iOS · Android · Windows · macOS',
    url: 'https://www.counterpath.com/bria/',
    notes: 'Enterprise SIP client. Manual entry required.',
  },
];
