const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const urlFile = path.join(__dirname, 'tunnel_url.txt');
const logFile = path.join(__dirname, 'tunnel_log.txt');

fs.writeFileSync(logFile, 'Starting Cloudflare Tunnel...\n');

const binPath = path.join(__dirname, 'cloudflared.exe');

console.log('Initiating Cloudflare Global Public Tunnel for Port 3000...');

const cf = spawn(binPath, ['tunnel', '--url', 'http://localhost:3000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let urlFound = false;

function parseLine(data) {
  const text = data.toString();
  try { fs.appendFileSync(logFile, text); } catch (e) {}
  
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !urlFound) {
    urlFound = true;
    const tunnelUrl = match[0].trim();
    console.log('PUBLIC_TUNNEL_ESTABLISHED: ' + tunnelUrl);
    try { fs.writeFileSync(urlFile, tunnelUrl); } catch (e) {}
  }
}

cf.stdout.on('data', parseLine);
cf.stderr.on('data', parseLine);

cf.on('close', (code) => {
  try { fs.appendFileSync(logFile, `Exited with code ${code}\n`); } catch (e) {}
  console.log(`Cloudflare Tunnel process exited with code ${code}`);
});
