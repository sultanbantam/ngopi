const path = require('path');
const os = require('os');
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function main() {
  await ssh.connect({
    host: '62.169.23.77',
    username: 'root',
    privateKeyPath: path.join(os.homedir(), '.ssh', 'id_ed25519')
  });
  console.log('Connected to VPS!');

  const remoteBase = '/opt/ngopi/backend';

  console.log('Uploading updated chess pro files and dependencies...');
  
  await ssh.putFile(
    path.join(__dirname, 'package.json'),
    `${remoteBase}/package.json`
  );
  await ssh.putFile(
    path.join(__dirname, 'prisma/schema.prisma'),
    `${remoteBase}/prisma/schema.prisma`
  );
  await ssh.putFile(
    path.join(__dirname, 'src/utils/pointsManager.ts'),
    `${remoteBase}/src/utils/pointsManager.ts`
  );
  await ssh.putFile(
    path.join(__dirname, 'src/services/chessPro.service.ts'),
    `${remoteBase}/src/services/chessPro.service.ts`
  );
  await ssh.putFile(
    path.join(__dirname, 'src/routes/chessPro.routes.ts'),
    `${remoteBase}/src/routes/chessPro.routes.ts`
  );
  await ssh.putFile(
    path.join(__dirname, 'src/index.ts'),
    `${remoteBase}/src/index.ts`
  );
  await ssh.putFile(
    path.join(__dirname, 'src/services/points.service.ts'),
    `${remoteBase}/src/services/points.service.ts`
  );
  await ssh.putFile(
    path.join(__dirname, 'src/ht/htManager.service.ts'),
    `${remoteBase}/src/ht/htManager.service.ts`
  );
  await ssh.putFile(
    path.join(__dirname, 'src/routes/ht.routes.ts'),
    `${remoteBase}/src/routes/ht.routes.ts`
  );

  console.log('Installing stockfish & chess.js on VPS...');
  const npmRes = await ssh.execCommand('npm install stockfish chess.js --save', { cwd: remoteBase });
  console.log('npm install result:\n', npmRes.stdout || npmRes.stderr);

  console.log('Running prisma generate on VPS...');
  const prismaRes = await ssh.execCommand('npx prisma generate', { cwd: remoteBase });
  console.log('prisma generate result:\n', prismaRes.stdout || prismaRes.stderr);

  console.log('Restarting PM2 ngopi-api...');
  const restartRes = await ssh.execCommand('pm2 restart ngopi-api', { cwd: remoteBase });
  console.log('Restart result:\n', restartRes.stdout || restartRes.stderr);

  // Wait 3 seconds
  await new Promise(r => setTimeout(r, 3000));

  console.log('Checking PM2 logs after restart...');
  const logRes = await ssh.execCommand('pm2 logs ngopi-api --lines 25 --nostream');
  console.log(logRes.stdout || logRes.stderr);

  ssh.dispose();
  console.log('VPS update complete!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
