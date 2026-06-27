/**
 * One-time Gmail OAuth setup for LeadWolf reply sync.
 *
 * Prerequisites:
 *   1. GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env
 *   2. OAuth client redirect URI: http://localhost:3333/oauth2callback
 *
 * Usage:
 *   cd backend && npm run gmail:oauth-setup
 */
import http from 'node:http';
import { exec } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

function loadEnvFile() {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(`
Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in backend/.env

Complete Google Cloud steps first, then add:

  GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
  GMAIL_CLIENT_SECRET=your-client-secret

Then run again: npm run gmail:oauth-setup
`);
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      console.log('\nOpen this URL in your browser:\n');
      console.log(url);
    }
  });
}

async function exchangeCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${raw}`);
  }

  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
    console.error(`\nAuthorization error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>Missing authorization code</h1>');
    return;
  }

  try {
    const tokens = await exchangeCode(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h1>Gmail connected</h1>
      <p>You can close this tab and return to the terminal.</p>
    `);

    console.log('\n✅ Gmail OAuth success!\n');
    console.log('Add this to backend/.env:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token ?? '(no refresh token — revoke app access and run again with prompt=consent)'}`);
    console.log('\nOptional (defaults are fine):');
    console.log('GMAIL_REPLY_QUERY=in:inbox newer_than:30d');
    console.log('\nThen test:');
    console.log('  npm run start:dev');
    console.log('  curl -X POST http://localhost:3001/api/analytics/sync-gmail-replies -H "Content-Type: application/json" -d "{\\"limit\\":30}"');
    console.log('');

    if (!tokens.refresh_token) {
      console.warn(
        'No refresh_token returned. Go to https://myaccount.google.com/permissions',
      );
      console.warn(
        'Remove LeadWolf access, then run npm run gmail:oauth-setup again.\n',
      );
    }

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Token exchange failed</h1><pre>${String(err)}</pre>`);
    console.error(err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`
LeadWolf — Gmail OAuth setup
============================

1. Make sure redirect URI is registered in Google Cloud:
   ${REDIRECT_URI}

2. Sign in with the SAME Gmail account you use as OUTREACH_SENDER_EMAIL
   (replies to your outreach land in this inbox).

3. Opening browser...
`);
  openBrowser(authUrl.toString());
  console.log(`If the browser did not open, visit:\n${authUrl.toString()}\n`);
});
