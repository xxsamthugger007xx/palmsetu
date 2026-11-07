#!/usr/bin/env node
/**
 * Writes the Mac's current LAN IP into .env's EXPO_PUBLIC_API_URL before
 * Expo starts. This app's dev server IP has drifted (DHCP reassignment)
 * repeatedly in testing, each time silently breaking the phone's connection
 * to the backend until someone noticed and manually edited .env. Running
 * this automatically on every `npm start` removes that manual step - the
 * IP is always correct for whichever network this Mac is on right now.
 *
 * This only ever rewrites the EXPO_PUBLIC_API_URL line; it does not touch
 * any other .env content. If the IP cannot be determined (no active
 * network interface), it leaves .env untouched rather than writing a
 * broken value.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');
const PORT = process.env.SOLUNE_SERVER_PORT || '4000';

function getLanIp() {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      // en0 is this Mac's Wi-Fi interface - confirmed via `networksetup
      // -listallhardwareports` earlier in this project's setup. Fall back
      // to en1 (common for wired/USB adapters) if en0 has no address.
      for (const iface of ['en0', 'en1']) {
        try {
          const ip = execSync(`ipconfig getifaddr ${iface}`, { encoding: 'utf8' }).trim();
          if (ip) return ip;
        } catch {
          // that interface has no address - try the next one
        }
      }
    } else if (platform === 'linux') {
      const out = execSync("hostname -I", { encoding: 'utf8' }).trim();
      const first = out.split(/\s+/)[0];
      if (first) return first;
    } else if (platform === 'win32') {
      const out = execSync('ipconfig', { encoding: 'utf8' });
      const match = out.match(/IPv4 Address[.\s]*:\s*([\d.]+)/);
      if (match) return match[1];
    }
  } catch {
    // fall through to null below
  }
  return null;
}

function main() {
  const ip = getLanIp();
  if (!ip) {
    console.warn('[sync-lan-ip] Could not determine a LAN IP - leaving .env unchanged.');
    return;
  }

  const newUrl = `EXPO_PUBLIC_API_URL=http://${ip}:${PORT}`;
  let existing = '';
  try {
    existing = fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    // .env does not exist yet - will be created below.
  }

  const lines = existing.split('\n');
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith('EXPO_PUBLIC_API_URL=')) {
      found = true;
      return newUrl;
    }
    return line;
  });
  if (!found) updated.push(newUrl);

  const nextContent = updated.join('\n');
  if (nextContent !== existing) {
    fs.writeFileSync(ENV_PATH, nextContent.endsWith('\n') ? nextContent : nextContent + '\n');
    console.log(`[sync-lan-ip] EXPO_PUBLIC_API_URL set to http://${ip}:${PORT}`);
  } else {
    console.log(`[sync-lan-ip] EXPO_PUBLIC_API_URL already correct (http://${ip}:${PORT})`);
  }
}

main();
