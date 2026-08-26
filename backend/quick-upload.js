require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const os = require('os');
const ssh = new NodeSSH();

async function main() {
  try {
    await ssh.connect({
      host: process.env.SSH_HOST || '62.169.23.77',
      username: process.env.SSH_USER || 'root',
      privateKeyPath: path.join(os.homedir(), '.ssh', 'id_ed25519'),
      readyTimeout: 60000
    });
    console.log('Connected to server!');
    
    const remoteBase = '/root/BaMbooChain/bamboochat/backend';

    console.log('Uploading message.routes.ts...');
    await ssh.putFile(path.join(__dirname, 'src/routes/message.routes.ts'), `${remoteBase}/src/routes/message.routes.ts`);

    console.log('Uploading message.controller.ts...');
    await ssh.putFile(path.join(__dirname, 'src/controllers/message.controller.ts'), `${remoteBase}/src/controllers/message.controller.ts`);

    console.log('Uploading .env...');
    await ssh.putFile(path.join(__dirname, '.env'), `${remoteBase}/.env`);

    console.log('Restarting PM2...');
    const pm2Res = await ssh.execCommand('pm2 restart bamboochat-api', { cwd: remoteBase });
    console.log('PM2:', pm2Res.stdout || pm2Res.stderr);

    console.log('\n✅ Upload and deploy selesai!');
    ssh.dispose();
  } catch (err) {
    console.error('SSH Error:', err);
    ssh.dispose();
  }
}
main();
