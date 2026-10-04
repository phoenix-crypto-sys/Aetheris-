const fs = require('fs');
const path = require('path');
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  const virtualKeywords = [
    'vethernet', 'wsl', 'virtual', 'vmware', 'vbox', 'hyper-v',
    'nordvpn', 'tailscale', 'zerotier', 'tap', 'tunnel', 'loopback',
    'bluetooth', 'host-only', 'docker', 'npcap'
  ];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    const isVirtual = virtualKeywords.some(k => lowerName.includes(k));

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        if (ip.startsWith('169.254.')) continue;
        if (!isVirtual) {
          if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wireless') || lowerName.includes('hotspot')) {
            return ip;
          }
          if (lowerName.includes('ethernet') || lowerName.includes('lan')) {
            candidates.unshift(ip);
          } else {
            candidates.push(ip);
          }
        }
      }
    }
  }

  if (candidates.length > 0) return candidates[0];
  return '127.0.0.1';
}

const localIP = getLocalIP();
const args = process.argv.slice(2);
const mobileWebUrl = process.env.MOBILE_WEB_URL || args[0] || `http://${localIP}:3000/mobile`;
const expoUrl = process.env.EXPO_URL || args[1] || `exp://${localIP}:8081`;

async function downloadQR(data, filename) {
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(data)}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const buffer = Buffer.from(await res.arrayBuffer());
    
    // Save to scripts directory
    const scriptPath = path.join(__dirname, filename);
    fs.writeFileSync(scriptPath, buffer);
    console.log(` Saved QR code image: ${scriptPath}`);
  } catch (e) {
    console.error(` Failed to download QR image ${filename}:`, e.message);
  }
}

async function main() {
  console.log('Generating QR code PNG images...');
  await downloadQR(mobileWebUrl, 'mobile_web_qr.png');
  await downloadQR(expoUrl, 'expo_go_qr.png');
}

main().catch(console.error);

