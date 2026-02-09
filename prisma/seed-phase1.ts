import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Phase 1 seed...');

  // ============================================
  // 1. CREATE DEPARTMENTS
  // ============================================
  console.log('📂 Creating departments...');
  
  const marketingDept = await prisma.department.create({
    data: {
      name: 'Marketing',
      code: 'MKT',
      description: 'Marketing and business development',
      isActive: true
    }
  });

  const salesDept = await prisma.department.create({
    data: {
      name: 'Sales',
      code: 'SLS',
      description: 'Sales and revenue generation',
      isActive: true
    }
  });

  const recruitmentDept = await prisma.department.create({
    data: {
      name: 'Recruitment',
      code: 'RCT',
      description: 'Talent acquisition and recruitment',
      isActive: true
    }
  });

  console.log(`✓ Created ${3} departments`);

  // ============================================
  // 2. CREATE DESIGNATIONS
  // ============================================
  console.log('👔 Creating designations...');

  // Marketing Designations
  const appRecruiterMkt = await prisma.designation.create({
    data: {
      name: 'Application Recruiter (Marketing)',
      code: 'APP_RCT_MKT',
      departmentId: marketingDept.id,
      description: 'Responsible for sourcing applications and contacting recruiters',
      isActive: true
    }
  });

  // Recruitment Designations
  const recruiterDelivery = await prisma.designation.create({
    data: {
      name: 'Recruiter (Delivery/Talent Acquisition)',
      code: 'RCT_DELIVERY',
      departmentId: recruitmentDept.id,
      description: 'Handles application review, interviews, and client submissions',
      isActive: true
    }
  });

  // Sales Designations
  const salesExecutive = await prisma.designation.create({
    data: {
      name: 'Sales Executive',
      code: 'SLS_EXEC',
      departmentId: salesDept.id,
      description: 'Handles lead generation, calls, demos, and closures',
      isActive: true
    }
  });

  console.log(`✓ Created ${3} designations`);

  // ============================================
  // 3. CREATE DEFAULT KPIs FOR EACH DESIGNATION
  // ============================================
  console.log('📊 Creating default KPIs...');

  // KPIs for Application Recruiter (Marketing)
  await prisma.defaultKPI.createMany({
    data: [
      {
        designationId: appRecruiterMkt.id,
        metricName: 'Applications Sourced',
        type: 'daily',
        category: 'applications',
        defaultTarget: 120,
        unit: 'applications',
        description: 'Daily target for sourcing applications'
      },
      {
        designationId: appRecruiterMkt.id,
        metricName: 'Recruiters Contacted',
        type: 'daily',
        category: 'calls',
        defaultTarget: 30,
        unit: 'recruiters',
        description: 'Daily target for recruiter outreach'
      },
      {
        designationId: appRecruiterMkt.id,
        metricName: 'Applications Sourced',
        type: 'weekly',
        category: 'applications',
        defaultTarget: 600,
        unit: 'applications',
        description: 'Weekly target for sourcing applications'
      },
      {
        designationId: appRecruiterMkt.id,
        metricName: 'Recruiters Contacted',
        type: 'weekly',
        category: 'calls',
        defaultTarget: 150,
        unit: 'recruiters',
        description: 'Weekly target for recruiter outreach'
      },
      {
        designationId: appRecruiterMkt.id,
        metricName: 'Applications Sourced',
        type: 'monthly',
        category: 'applications',
        defaultTarget: 2500,
        targetMin: 2400,
        targetMax: 2600,
        unit: 'applications',
        description: 'Monthly target range for sourcing applications'
      },
      {
        designationId: appRecruiterMkt.id,
        metricName: 'Recruiters Contacted',
        type: 'monthly',
        category: 'calls',
        defaultTarget: 650,
        targetMin: 600,
        targetMax: 700,
        unit: 'recruiters',
        description: 'Monthly target range for recruiter outreach'
      }
    ]
  });

  // KPIs for Recruiter (Delivery)
  await prisma.defaultKPI.createMany({
    data: [
      {
        designationId: recruiterDelivery.id,
        metricName: 'Applications Reviewed',
        type: 'daily',
        category: 'applications',
        defaultTarget: 120,
        unit: 'applications',
        description: 'Daily target for reviewing applications'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Interviews Scheduled',
        type: 'daily',
        category: 'interviews',
        defaultTarget: 1,
        unit: 'interviews',
        description: 'Daily target for scheduling interviews'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Screening Calls',
        type: 'daily',
        category: 'screenings',
        defaultTarget: 1,
        unit: 'calls',
        description: 'Daily target for screening calls'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Client Submissions',
        type: 'daily',
        category: 'submissions',
        defaultTarget: 1,
        unit: 'submissions',
        description: 'Daily target for client submissions'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Interviews',
        type: 'weekly',
        category: 'interviews',
        defaultTarget: 5,
        unit: 'interviews',
        description: 'Weekly target for interviews'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Client Submissions',
        type: 'weekly',
        category: 'submissions',
        defaultTarget: 5,
        unit: 'submissions',
        description: 'Weekly target for submissions'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Screening Calls',
        type: 'weekly',
        category: 'screenings',
        defaultTarget: 5,
        unit: 'calls',
        description: 'Weekly target for screening calls'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Placements',
        type: 'monthly',
        category: 'placements',
        defaultTarget: 1,
        unit: 'placements',
        description: 'Monthly target for successful placements'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Screening Calls',
        type: 'monthly',
        category: 'screenings',
        defaultTarget: 20,
        unit: 'calls',
        description: 'Monthly target for screening calls'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Interviews',
        type: 'monthly',
        category: 'interviews',
        defaultTarget: 20,
        unit: 'interviews',
        description: 'Monthly target for interviews'
      },
      {
        designationId: recruiterDelivery.id,
        metricName: 'Client Submissions',
        type: 'monthly',
        category: 'submissions',
        defaultTarget: 20,
        unit: 'submissions',
        description: 'Monthly target for submissions'
      }
    ]
  });

  // KPIs for Sales Executive
  await prisma.defaultKPI.createMany({
    data: [
      {
        designationId: salesExecutive.id,
        metricName: 'Leads Generated',
        type: 'daily',
        category: 'applications',
        defaultTarget: 12,
        unit: 'leads',
        description: 'Daily target for lead generation'
      },
      {
        designationId: salesExecutive.id,
        metricName: 'Calls Made',
        type: 'daily',
        category: 'calls',
        defaultTarget: 50,
        unit: 'calls',
        description: 'Daily target for sales calls'
      },
      {
        designationId: salesExecutive.id,
        metricName: 'Qualified Leads',
        type: 'weekly',
        category: 'applications',
        defaultTarget: 40,
        unit: 'leads',
        description: 'Weekly target for qualified leads'
      },
      {
        designationId: salesExecutive.id,
        metricName: 'Demos/Meetings',
        type: 'weekly',
        category: 'meetings',
        defaultTarget: 6,
        unit: 'meetings',
        description: 'Weekly target for demos and meetings'
      },
      {
        designationId: salesExecutive.id,
        metricName: 'Deals Closed',
        type: 'monthly',
        category: 'closures',
        defaultTarget: 3,
        targetMin: 2,
        targetMax: 5,
        unit: 'deals',
        description: 'Monthly target for closed deals'
      }
    ]
  });

  console.log(`✓ Created default KPIs for all designations`);

  // ============================================
  // 4. UPDATE EXISTING EMPLOYEES (OPTIONAL)
  // ============================================
  console.log('👥 Updating existing employees...');

  // Example: Assign departments and designations to existing employees
  // This is optional - you can do this manually through the UI later
  
  // Find an existing employee and assign them a designation
  const existingEmployee = await prisma.employee.findFirst();
  
  if (existingEmployee) {
    await prisma.employee.update({
      where: { id: existingEmployee.id },
      data: {
        departmentId: marketingDept.id,
        designationId: appRecruiterMkt.id
      }
    });
    console.log(`✓ Updated employee: ${existingEmployee.firstName} ${existingEmployee.lastName}`);
  }

  console.log('✅ Phase 1 seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });