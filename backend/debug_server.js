require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const os = require('os');

async function main() {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: '62.169.23.77',
      username: 'root',
      privateKeyPath: path.join(os.homedir(), '.ssh', 'id_ed25519'),
      readyTimeout: 30000,
    });
    console.log('Connected!\n');

    // Check PM2 logs for errors
    console.log('=== PM2 LOGS (last 30 lines) ===');
    const logs = await ssh.execCommand('pm2 logs bamboochat-api --nostream --lines 30');
    console.log(logs.stdout || logs.stderr);

    // Check if the new message controller is deployed
    console.log('\n=== Message Controller Check ===');
    const checkFile = await ssh.execCommand('grep -n "nextCursor\\|hasMore\\|cursor" /root/BaMbooChain/bamboochat/backend/src/controllers/message.controller.ts | head -5');
    console.log(checkFile.stdout || 'File not found or no matches');

    // Quick API test
    console.log('\n=== API Test ===');
    const apiTest = await ssh.execCommand('curl -s http://localhost:3000/api/health');
    console.log('Health:', apiTest.stdout);

    ssh.dispose();
  } catch (err) {
    console.error('Error:', err.message);
    ssh.dispose();
  }
}
main();
