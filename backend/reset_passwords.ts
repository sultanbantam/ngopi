import { prisma } from './src/utils/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const newPassword = 'password123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const usernamesToReset = ['founder', 'sultan'];

  for (const username of usernamesToReset) {
    try {
      const user = await prisma.user.update({
        where: { username },
        data: { password_hash: hashedPassword }
      });
      console.log(`Password for user '${username}' has been reset to: ${newPassword}`);
    } catch (e) {
      console.log(`User '${username}' not found or error occurred.`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    // Wait for the adapter to flush
  });
