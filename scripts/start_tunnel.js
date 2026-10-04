const ngrok = require('@expo/ngrok');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const url = await ngrok.connect({ addr: 3000, proto: 'http' });
    console.log('NGROK_TUNNEL_URL:' + url);
    fs.writeFileSync(path.join(__dirname, 'tunnel_url.txt'), url);
  } catch (err) {
    console.error('Ngrok error:', err.message);
  }
}

main();
