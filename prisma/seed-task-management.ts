// prisma/seed-task-management.ts
// Seed file for Department, Designation, and Default KPIs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Task Management System seed...');

  try {
    // ============================================
    // 1. CREATE DEPARTMENTS
    // ============================================

    console.log('📁 Creating Departments...');

    const marketingDept = await prisma.department.upsert({
      where: { code: 'MKT' },
      update: {},
      create: {
        name: 'Marketing',
        code: 'MKT',
        description: 'Marketing and Recruitment Department'
      }
    });

    const salesDept = await prisma.department.upsert({
      where: { code: 'SLS' },
      update: {},
      create: {
        name: 'Sales',
        code: 'SLS',
        description: 'Sales Department'
      }
    });

    console.log('✅ Departments created:', { marketing: marketingDept.id, sales: salesDept.id });

    // ============================================
    // 2. CREATE DESIGNATIONS
    // ============================================

    console.log('💼 Creating Designations...');

    // Marketing Designations
    const appRecruiter = await prisma.designation.upsert({
      where: {
        departmentId_code: {
          departmentId: marketingDept.id,
          code: 'APP_REC'
        }
      },
      update: {},
      create: {
        name: 'Application Recruiter',
        code: 'APP_REC',
        departmentId: marketingDept.id,
        description: 'Handles application sourcing and recruiter outreach'
      }
    });

    const recruiter = await prisma.designation.upsert({
      where: {
        departmentId_code: {
          departmentId: marketingDept.id,
          code: 'REC'
        }
      },
      update: {},
      create: {
        name: 'Recruiter',
        code: 'REC',
        departmentId: marketingDept.id,
        description: 'Delivery/Talent Acquisition Recruiter'
      }
    });

    // Sales Designations
    const salesExec = await prisma.designation.upsert({
      where: {
        departmentId_code: {
          departmentId: salesDept.id,
          code: 'SALES_EXEC'
        }
      },
      update: {},
      create: {
        name: 'Sales Executive',
        code: 'SALES_EXEC',
        departmentId: salesDept.id,
        description: 'Sales Executive'
      }
    });

    console.log('✅ Designations created:', {
      appRecruiter: appRecruiter.id,
      recruiter: recruiter.id,
      salesExec: salesExec.id
    });

    // ============================================
    // 3. CREATE DEFAULT KPIS
    // ============================================

    console.log('📊 Creating Default KPIs...');

    // Application Recruiter KPIs
    const appRecruiterKPIs = [
      // Daily KPIs
      {
        metricName: 'Applications sourced',
        type: 'daily' as const,
        category: 'applications' as const,
        defaultTarget: 120,
        unit: 'applications'
      },
      {
        metricName: 'Recruiters contacted',
        type: 'daily' as const,
        category: 'calls' as const,
        defaultTarget: 30,
        unit: 'contacts'
      },
      // Weekly KPIs
      {
        metricName: 'Applications sourced',
        type: 'weekly' as const,
        category: 'applications' as const,
        defaultTarget: 600,
        unit: 'applications'
      },
      {
        metricName: 'Recruiters contacted',
        type: 'weekly' as const,
        category: 'calls' as const,
        defaultTarget: 150,
        unit: 'contacts'
      },
      // Monthly KPIs
      {
        metricName: 'Applications sourced',
        type: 'monthly' as const,
        category: 'applications' as const,
        defaultTarget: 2500,
        unit: 'applications',
        targetMin: 2400,
        targetMax: 2600
      },
      {
        metricName: 'Recruiters reach outs',
        type: 'monthly' as const,
        category: 'calls' as const,
        defaultTarget: 650,
        unit: 'reach outs',
        targetMin: 600,
        targetMax: 700
      }
    ];

    for (const kpi of appRecruiterKPIs) {
      await prisma.defaultKPI.upsert({
        where: {
          designationId_metricName_type: {
            designationId: appRecruiter.id,
            metricName: kpi.metricName,
            type: kpi.type
          }
        },
        update: kpi,
        create: {
          designationId: appRecruiter.id,
          ...kpi
        }
      });
    }

    // Recruiter KPIs
    const recruiterKPIs = [
      // Daily KPIs
      {
        metricName: 'Applications reviewed',
        type: 'daily' as const,
        category: 'applications' as const,
        defaultTarget: 120,
        unit: 'applications'
      },
      {
        metricName: 'Interviews scheduled',
        type: 'daily' as const,
        category: 'interviews' as const,
        defaultTarget: 1,
        unit: 'interview'
      },
      {
        metricName: 'Screening Calls',
        type: 'daily' as const,
        category: 'screenings' as const,
        defaultTarget: 1,
        unit: 'call'
      },
      {
        metricName: 'Client submission',
        type: 'daily' as const,
        category: 'submissions' as const,
        defaultTarget: 1,
        unit: 'submission'
      },
      // Weekly KPIs
      {
        metricName: 'Interviews',
        type: 'weekly' as const,
        category: 'interviews' as const,
        defaultTarget: 5,
        unit: 'interviews'
      },
      {
        metricName: 'Submissions',
        type: 'weekly' as const,
        category: 'submissions' as const,
        defaultTarget: 5,
        unit: 'submissions'
      },
      {
        metricName: 'Screening Calls',
        type: 'weekly' as const,
        category: 'screenings' as const,
        defaultTarget: 5,
        unit: 'calls'
      },
      // Monthly KPIs
      {
        metricName: 'Placements',
        type: 'monthly' as const,
        category: 'placements' as const,
        defaultTarget: 1,
        unit: 'placement'
      },
      {
        metricName: 'Screening Calls',
        type: 'monthly' as const,
        category: 'screenings' as const,
        defaultTarget: 22,
        unit: 'calls',
        targetMin: 20,
        targetMax: 25
      },
      {
        metricName: 'Interviews',
        type: 'monthly' as const,
        category: 'interviews' as const,
        defaultTarget: 22,
        unit: 'interviews',
        targetMin: 20,
        targetMax: 25
      },
      {
        metricName: 'Submissions',
        type: 'monthly' as const,
        category: 'submissions' as const,
        defaultTarget: 22,
        unit: 'submissions',
        targetMin: 20,
        targetMax: 25
      }
    ];

    for (const kpi of recruiterKPIs) {
      await prisma.defaultKPI.upsert({
        where: {
          designationId_metricName_type: {
            designationId: recruiter.id,
            metricName: kpi.metricName,
            type: kpi.type
          }
        },
        update: kpi,
        create: {
          designationId: recruiter.id,
          ...kpi
        }
      });
    }

    // Sales Executive KPIs
    const salesExecKPIs = [
      // Daily KPIs
      {
        metricName: 'Leads generated',
        type: 'daily' as const,
        category: 'calls' as const,
        defaultTarget: 12,
        unit: 'leads'
      },
      {
        metricName: 'Calls made',
        type: 'daily' as const,
        category: 'calls' as const,
        defaultTarget: 50,
        unit: 'calls'
      },
      // Weekly KPIs
      {
        metricName: 'Qualified leads',
        type: 'weekly' as const,
        category: 'calls' as const,
        defaultTarget: 40,
        unit: 'leads',
        targetMin: 30,
        targetMax: 50
      },
      {
        metricName: 'Demos / meetings',
        type: 'weekly' as const,
        category: 'meetings' as const,
        defaultTarget: 6,
        unit: 'meetings',
        targetMin: 5,
        targetMax: 8
      },
      // Monthly KPIs
      {
        metricName: 'Upfront revenue target',
        type: 'monthly' as const,
        category: 'closures' as const,
        defaultTarget: 100000,
        unit: '₹'
      },
      {
        metricName: 'Closures',
        type: 'monthly' as const,
        category: 'closures' as const,
        defaultTarget: 8,
        unit: 'deals'
      }
    ];

    for (const kpi of salesExecKPIs) {
      await prisma.defaultKPI.upsert({
        where: {
          designationId_metricName_type: {
            designationId: salesExec.id,
            metricName: kpi.metricName,
            type: kpi.type
          }
        },
        update: kpi,
        create: {
          designationId: salesExec.id,
          ...kpi
        }
      });
    }

    console.log('✅ Default KPIs created successfully!');

    // ============================================
    // 4. DISPLAY SUMMARY
    // ============================================

    const departments = await prisma.department.findMany({ include: { designations: { include: { defaultKPIs: true } } } });

    console.log('\n📋 SEED SUMMARY:');
    console.log('================');
    
    departments.forEach(dept => {
      console.log(`\n📁 ${dept.name} (${dept.code})`);
      dept.designations.forEach(designation => {
        console.log(`  💼 ${designation.name} (${designation.code})`);
        console.log(`    📊 ${designation.defaultKPIs.length} default KPIs`);
        
        const dailyKPIs = designation.defaultKPIs.filter(k => k.type === 'daily');
        const weeklyKPIs = designation.defaultKPIs.filter(k => k.type === 'weekly');
        const monthlyKPIs = designation.defaultKPIs.filter(k => k.type === 'monthly');
        
        console.log(`      Daily: ${dailyKPIs.length}, Weekly: ${weeklyKPIs.length}, Monthly: ${monthlyKPIs.length}`);
      });
    });

    console.log('\n🎉 Task Management System seed completed successfully!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
