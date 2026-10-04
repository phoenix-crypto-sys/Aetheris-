const os = require('os');
const qrcode = require('qrcode-terminal');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();
const expoUrl = `exp://${localIp}:8081`;

console.log('\n======================================================');
console.log('📱 AETHERIS EXPO GO METRO SERVER READY');
console.log(`Scan the QR code below using Expo Go app on your phone:`);
console.log(`URL: ${expoUrl}`);
console.log('======================================================\n');

qrcode.generate(expoUrl, { small: true });

console.log('\n======================================================\n');
