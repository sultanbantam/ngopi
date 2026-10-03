import bcrypt from 'bcryptjs';
import { prisma } from '../src/utils/prisma';
import { ECOSYSTEM_PLATFORMS } from '../src/data/ecosystem';

const seedPassword = async (raw: string) => bcrypt.hash(raw, 10);

const main = async () => {
  const csPassword = process.env.CS_SEED_PASSWORD || 'bamboocs123';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'bambooadmin123';

  const csAgent = await prisma.user.upsert({
    where: { username: 'bamboo_cs' },
    update: {
      display_name: 'NgopiCS',
      role: 'agent',
      status: 'Online 24/7 untuk bantuan ekosistem Bambu',
      is_online: true,
    },
    create: {
      username: 'bamboo_cs',
      password_hash: await seedPassword(csPassword),
      display_name: 'NgopiCS',
      role: 'agent',
      status: 'Online 24/7 untuk bantuan ekosistem Bambu',
      is_online: true,
    },
  });

  await prisma.user.upsert({
    where: { username: 'bamboo_admin' },
    update: {
      display_name: 'Bamboo Admin',
      role: 'admin',
      status: 'CS hub administrator',
    },
    create: {
      username: 'bamboo_admin',
      password_hash: await seedPassword(adminPassword),
      display_name: 'Bamboo Admin',
      role: 'admin',
      status: 'CS hub administrator',
    },
  });

  for (const platformSeed of ECOSYSTEM_PLATFORMS) {
    const platform = await prisma.platform.upsert({
      where: { name: platformSeed.name },
      update: {
        display_name: platformSeed.display_name,
        description: platformSeed.description,
        website_url: platformSeed.website_url,
        icon: platformSeed.icon,
        support_agent_id: csAgent.id,
      },
      create: {
        name: platformSeed.name,
        display_name: platformSeed.display_name,
        description: platformSeed.description,
        website_url: platformSeed.website_url,
        icon: platformSeed.icon,
        support_agent_id: csAgent.id,
      },
    });

    for (const faqSeed of platformSeed.faqs) {
      await prisma.faq.upsert({
        where: {
          platform_id_question: {
            platform_id: platform.id,
            question: faqSeed.question,
          },
        },
        update: {
          answer: faqSeed.answer,
          keywords: faqSeed.keywords,
        },
        create: {
          platform_id: platform.id,
          question: faqSeed.question,
          answer: faqSeed.answer,
          keywords: faqSeed.keywords,
        },
      });
    }
  }

  const faqCount = ECOSYSTEM_PLATFORMS.reduce((total, platform) => total + platform.faqs.length, 0);
  console.log(`Seeded ${ECOSYSTEM_PLATFORMS.length} platforms and ${faqCount} FAQs.`);
};

main()
  .catch((error) => {
    console.error('CS Hub seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });