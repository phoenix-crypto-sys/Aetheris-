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

        // Skip obvious APIPA / Virtual IPs if possible
        if (ip.startsWith('169.254.')) continue;

        if (!isVirtual) {
          // Check if interface looks like Wi-Fi / Hotspot / Ethernet
          if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wireless') || lowerName.includes('hotspot')) {
            return ip; // Top priority: Wi-Fi / Wireless Hotspot
          }
          if (lowerName.includes('ethernet') || lowerName.includes('lan')) {
            candidates.unshift(ip); // High priority: Ethernet
          } else {
            candidates.push(ip);
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    return candidates[0];
  }

  // Fallback to any non-internal IPv4 if no non-virtual adapter was found
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return '127.0.0.1';
}

console.log(getLocalIP());

