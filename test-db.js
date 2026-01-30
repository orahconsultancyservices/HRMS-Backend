// test-db.js in backend directory
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@'));
    
    // Test raw query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('Test query result:', result);
    
    // Test if Employee table exists
    const tables = await prisma.$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `;
    console.log('📊 Existing tables:', tables);
    
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error.message);
    console.error('Full error:', error);
    
    // Common fixes
    console.log('\n🔧 Possible solutions:');
    console.log('1. Check if database server is running');
    console.log('2. Verify DATABASE_URL in .env file');
    console.log('3. Check if your IP is whitelisted (for cloud databases)');
    console.log('4. Verify SSL settings for Aiven database');
    
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();