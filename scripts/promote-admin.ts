#!/usr/bin/env npx ts-node

/**
 * Promote User to SuperAdmin Script
 *
 * Usage: npx ts-node scripts/promote-admin.ts <email>
 *
 * This script promotes a user to superAdmin status, granting them access to:
 * - Admin control panel at /admin
 * - User management
 * - Organization settings
 * - AI provider configuration
 * - System settings
 *
 * Example:
 *   npx ts-node scripts/promote-admin.ts admin@example.com
 *
 * Safety: Will fail if user doesn't exist, never demotes existing admins
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main execution function
 */
async function promoteUserToAdmin() {
  // Get email from command line argument
  const email = process.argv[2];

  // Validate input
  if (!email) {
    console.error('❌ Error: Email argument required');
    console.error('Usage: npx ts-node scripts/promote-admin.ts <email>');
    console.error('Example: npx ts-node scripts/promote-admin.ts admin@example.com');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`❌ Error: Invalid email format: ${email}`);
    process.exit(1);
  }

  // Create Prisma client
  const prisma = new PrismaClient();

  try {
    console.log(`\n🔍 Looking for user with email: ${email}`);

    // Find the user by email (using findFirst since email has compound unique constraint with providerName)
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
      },
    });

    // Check if user exists
    if (!user) {
      console.error(`\n❌ Error: User with email "${email}" not found`);
      console.error('\nTo create a new user:');
      console.error('1. Sign up at the application');
      console.error('2. Then run this script to promote them to admin\n');
      process.exit(1);
    }

    // Check if already admin
    if (user.isSuperAdmin) {
      console.log(`\n✅ User ${email} is already a superAdmin\n`);
      process.exit(0);
    }

    console.log(`\n📋 User Details:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || '(not set)'}`);
    console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
    console.log(`   Status: Regular User\n`);

    // Promote to admin
    console.log(`⚡ Promoting ${email} to superAdmin status...`);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isSuperAdmin: true },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
      },
    });

    console.log(`\n✅ SUCCESS! User promoted to superAdmin\n`);
    console.log(`📊 Updated User:`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Status: 🔐 SuperAdmin\n`);

    console.log(`🚀 Next Steps:`);
    console.log(`   1. Log in with ${email}`);
    console.log(`   2. Navigate to /admin to access the admin panel`);
    console.log(`   3. Configure AI providers, manage users, and system settings\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during promotion:\n', error);
    process.exit(1);
  } finally {
    // Close database connection
    await prisma.$disconnect();
  }
}

// Run the script
promoteUserToAdmin();
