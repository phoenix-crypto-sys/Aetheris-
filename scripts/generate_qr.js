const fs = require('fs');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode-terminal');

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

console.log('\n================================================================');
console.log('📱 AETHERIS MOBILE PRESENTATION QR CODES');
console.log('================================================================');
console.log(`📡 Detected Host IP : ${localIP}`);
console.log(`🌐 Mobile Web URL   : ${mobileWebUrl}`);
console.log(`📱 Expo Go Native   : ${expoUrl}`);
console.log('================================================================\n');

console.log('1️⃣ MOBILE WEB APP (Scan with any Phone Camera - No App Needed):');
console.log(`URL: ${mobileWebUrl}`);
qrcode.generate(mobileWebUrl, { small: true });

console.log('\n2️⃣ EXPO GO NATIVE APP (Scan inside Expo Go app):');
console.log(`URL: ${expoUrl}`);
qrcode.generate(expoUrl, { small: true });

console.log('================================================================\n');

