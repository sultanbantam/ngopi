import { prisma } from './src/utils/prisma';
async function main() {
  const users = await prisma.user.findMany();
  console.log('Users in DB:', users.length);
  users.forEach((u: any) => console.log(u.id, u.username));
}
main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
