import crypto from 'node:crypto';
import dgram from 'node:dgram';

const HOST = process.env.SIP_HOST ?? '127.0.0.1';
const PORT = Number(process.env.SIP_PORT ?? '5080');
const USERNAME = process.env.SIP_USERNAME ?? '200';
const PASSWORD = process.env.SIP_PASSWORD ?? 'PhonePass123!';
const DOMAIN = process.env.SIP_DOMAIN ?? 'acme-demo.managecallai.local';
const TRANSPORT = (process.env.SIP_TRANSPORT ?? 'UDP').toUpperCase();
const LOCAL_IP = process.env.SIP_LOCAL_IP ?? '127.0.0.1';
const LOCAL_PORT = Number(process.env.SIP_LOCAL_PORT ?? '5092');
const USER_AGENT = 'manageCallAI-registration-smoke/1.0';

// ── Log redaction helpers ─────────────────────────────────────────────────────
function debugEnabled() {
  return process.env.SIP_SMOKE_DEBUG === '1';
}

/**
 * Returns a copy of a raw SIP message with sensitive header values replaced.
 * Strips: Authorization, WWW-Authenticate, Contact, From, To, Call-ID, Via
 * username/password fields, and nonce/response values.
 */
function redactSipMessage(message) {
  return message
    .replace(/^(Authorization|Proxy-Authorization):[^\r\n]*/gim, '$1: Digest <redacted>')
    .replace(/^(WWW-Authenticate|Proxy-Authenticate):[^\r\n]*/gim, '$1: Digest <redacted>')
    .replace(/^(Contact):[^\r\n]*/gim, '$1: <redacted>')
    .replace(/^(From|To):[^\r\n]*/gim, '$1: <redacted>')
    .replace(/^(Call-ID):[^\r\n]*/gim, '$1: <redacted>')
    .replace(/(username|realm|nonce|response|cnonce)="[^"]*"/gi, '$1="<redacted>"');
}

function md5(value) {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function buildRegister({ cseq, callId, branch, fromTag, authHeader, expires = 300 }) {
  const lines = [
    `REGISTER sip:${DOMAIN} SIP/2.0`,
    `Via: SIP/2.0/${TRANSPORT} ${LOCAL_IP}:${LOCAL_PORT};branch=${branch};rport`,
    'Max-Forwards: 70',
    `From: <sip:${USERNAME}@${DOMAIN}>;tag=${fromTag}`,
    `To: <sip:${USERNAME}@${DOMAIN}>`,
    `Call-ID: ${callId}`,
    `CSeq: ${cseq} REGISTER`,
    `Contact: <sip:${USERNAME}@${LOCAL_IP}:${LOCAL_PORT};transport=${TRANSPORT.toLowerCase()}>`,
    `Expires: ${expires}`,
    `User-Agent: ${USER_AGENT}`,
    'Allow: REGISTER, INVITE, ACK, BYE, CANCEL, OPTIONS',
    'Content-Length: 0',
  ];

  if (authHeader) {
    lines.splice(8, 0, authHeader);
  }

  return Buffer.from(`${lines.join('\r\n')}\r\n\r\n`, 'utf8');
}

function parseHeader(message, headerName) {
  const pattern = new RegExp(`^${headerName}:\\s*(.+)$`, 'gim');
  const match = pattern.exec(message);
  return match?.[1]?.trim() ?? null;
}

function parseDigestFields(headerValue) {
  const fields = {};
  for (const match of headerValue.matchAll(/(\w+)="?([^",]+)"?/g)) {
    fields[match[1]] = match[2];
  }
  return fields;
}

function buildAuthorization(wwwAuthenticate, uri) {
  const digest = parseDigestFields(wwwAuthenticate);
  const realm = digest.realm;
  const nonce = digest.nonce;
  const algorithm = digest.algorithm ?? 'MD5';
  const qop = digest.qop;
  const nc = '00000001';
  const cnonce = md5(String(Date.now()));

  const ha1 = md5(`${USERNAME}:${realm}:${PASSWORD}`);
  const ha2 = md5(`REGISTER:${uri}`);

  if (qop) {
    const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    return `Authorization: Digest username="${USERNAME}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=${algorithm}, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  }

  const response = md5(`${ha1}:${nonce}:${ha2}`);
  return `Authorization: Digest username="${USERNAME}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=${algorithm}`;
}

function receiveMessage(socket) {
  return new Promise((resolve, reject) => {
    const onMessage = (buffer) => {
      cleanup();
      const text = buffer.toString('utf8');
      if (debugEnabled()) {
        process.stdout.write(`${redactSipMessage(text)}\n`);
      }
      resolve(text);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error('Timed out waiting for SIP response'));
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.off('message', onMessage);
      socket.off('error', onError);
    };

    const timeoutId = setTimeout(onTimeout, 8000);
    socket.once('message', onMessage);
    socket.once('error', onError);
  });
}

async function main() {
  if (TRANSPORT !== 'UDP') {
    throw new Error('Only UDP transport is supported by this smoke script.');
  }

  const socket = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(LOCAL_PORT, LOCAL_IP, resolve);
  });

  try {
    const requestUri = `sip:${DOMAIN}`;
    const callId = `${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}@${LOCAL_IP}`;
    const firstBranch = `z9hG4bK${Math.floor(Math.random() * 900000 + 100000)}`;
    const fromTag = `mcai${Math.floor(Math.random() * 9000 + 1000)}`;

    // Endpoint and identity are not interpolated here: even masked helpers receive
    // env-derived values that CodeQL's taint-tracking follows through the call chain.
    console.log('Sending unauthenticated REGISTER (endpoint and identity redacted)');
    socket.send(buildRegister({ cseq: 1, callId, branch: firstBranch, fromTag }), PORT, HOST);
    const first = await receiveMessage(socket);

    if (!first.includes('401')) {
      throw new Error('Expected 401 challenge, did not receive it.');
    }

    const wwwAuthenticate = parseHeader(first, 'WWW-Authenticate');
    if (!wwwAuthenticate) {
      throw new Error('Missing WWW-Authenticate challenge.');
    }

    console.log('Sending authenticated REGISTER');
    const authHeader = buildAuthorization(wwwAuthenticate, requestUri);
    const secondBranch = `z9hG4bK${Math.floor(Math.random() * 900000 + 100000)}`;
    socket.send(
      buildRegister({ cseq: 2, callId, branch: secondBranch, fromTag, authHeader }),
      PORT,
      HOST,
    );
    const second = await receiveMessage(socket);

    if (!second.includes('200 OK')) {
      throw new Error('Registration did not succeed.');
    }

    console.log('REGISTER succeeded.');
  } finally {
    socket.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
