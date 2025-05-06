import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { UserRole } from './enums';

const prisma = new PrismaClient();

async function main() {
  // Check if SuperAdmin already exists
  const superAdminCount = await prisma.user.count({
    where: {
      role: UserRole.SUPERADMIN,
    },
  });

  if (superAdminCount === 0) {
    // Create initial SuperAdmin user
    const hashedPassword = await hash('superadmin123', 12);
    
    const superAdmin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@cbums.com',
        password: hashedPassword,
        role: UserRole.SUPERADMIN,
        coins: 1000000, // Initial coins set to 1 million
      },
    });

    console.log(`Created SuperAdmin user with id: ${superAdmin.id}`);
  } else {
    console.log('SuperAdmin user already exists, skipping creation');
  }

  console.log('Database seeding completed');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 