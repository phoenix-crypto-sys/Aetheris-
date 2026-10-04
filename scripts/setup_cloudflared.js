const fs = require('fs');
const path = require('path');
const https = require('https');

const binPath = path.join(__dirname, 'cloudflared.exe');

function downloadCloudflared() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(binPath)) {
      console.log('Cloudflared binary already present:', binPath);
      return resolve(binPath);
    }
    console.log('Downloading official Cloudflare Tunnel binary (cloudflared.exe)...');
    
    function get(url) {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download cloudflared: HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(binPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            console.log('Cloudflared binary downloaded successfully!');
            resolve(binPath);
          });
        });
      }).on('error', reject);
    }
    
    get('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe');
  });
}

downloadCloudflared().catch(err => console.error(err));
