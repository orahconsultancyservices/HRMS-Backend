// backend/prisma/seed-roles.ts
// Seed script to assign roles and team lead relationships

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting role and team lead assignment seed...');

  try {
    // Get all employees
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        position: true,
        department: true
      }
    });

    console.log(`Found ${employees.length} active employees`);

    // Determine role and team lead assignment
    const updates = [];

    for (const emp of employees) {
      const pos = (emp.position || '').toLowerCase();
      
      // Determine role
      let role = 'employee';
      if (emp.employeeId === 'ADMIN001' || emp.firstName === 'Admin') {
        role = 'admin';
      } else if (
        pos.includes('team lead') ||
        pos.includes('team leader') ||
        pos.includes(' tl') ||
        pos === 'tl' ||
        pos.includes('lead recruiter') ||
        pos.includes('senior lead')
      ) {
        role = 'teamlead';
      }

      updates.push({
        id: emp.id,
        employee: emp,
        role,
        reportTo: null // Will be assigned below for non-leads
      });
    }

    // Assignment logic
    // Find first team lead in each department or overall
    let primaryTeamLead: any = null;
    
    for (const update of updates) {
      if (update.role === 'teamlead') {
        primaryTeamLead = update;
        break;
      }
    }

    if (!primaryTeamLead) {
      console.warn('⚠️  No team lead found. Using first employee as default.');
      if (updates.length > 0) {
        primaryTeamLead = updates[0];
        primaryTeamLead.role = 'teamlead';
      }
    }

    // Assign team lead
    if (primaryTeamLead) {
      console.log(`👔 Assigned ${primaryTeamLead.employee.firstName} ${primaryTeamLead.employee.lastName} as Team Lead`);

      // Update team lead to have teamlead role
      await prisma.employee.update({
        where: { id: primaryTeamLead.id },
        data: {
          role: 'teamlead',
          reportTo: null  // Team leads don't report to anyone
        }
      });

      // Assign other employees to report to this team lead
      for (const update of updates) {
        if (update.id !== primaryTeamLead.id && update.role === 'employee') {
          await prisma.employee.update({
            where: { id: update.id },
            data: {
              role: 'employee',
              reportTo: primaryTeamLead.id
            }
          });
        } else if (update.role !== 'admin' && update.id !== primaryTeamLead.id) {
          // Other team leads don't report to anyone
          await prisma.employee.update({
            where: { id: update.id },
            data: {
              role: 'teamlead',
              reportTo: null
            }
          });
        } else if (update.role === 'admin') {
          await prisma.employee.update({
            where: { id: update.id },
            data: {
              role: 'admin',
              reportTo: null
            }
          });
        }
      }

      // Count assignments
      const teamMembers = await prisma.employee.findMany({
        where: {
          reportTo: primaryTeamLead.id,
          isActive: true
        },
        select: { id: true, firstName: true, lastName: true }
      });

      console.log(`👥 Assigned ${teamMembers.length} employees to report to ${primaryTeamLead.employee.firstName}`);
      
      if (teamMembers.length > 0) {
        console.log('Team members:');
        teamMembers.forEach(tm => {
          console.log(`  - ${tm.firstName} ${tm.lastName}`);
        });
      }
    }

    console.log('✅ Role and team lead assignment completed successfully!');
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
