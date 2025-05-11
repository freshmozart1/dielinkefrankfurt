/**
 * Optimized build script for Vercel deployment with Neon PostgreSQL
 */
const db = require('./db');

console.log('🔧 Running Vercel build script for Prisma with PostgreSQL...');
console.log(`🔍 Environment: ${db.IS_VERCEL ? 'Vercel' : 'Local'}`);

async function main() {
  try {
    // Validate environment and DATABASE_URL
    if (!db.validateEnvironment()) {
      process.exit(1);
    }
    
    // Ensure schema is properly configured
    if (!db.validateSchema()) {
      process.exit(1);
    }
    
    // If in Vercel, reset the database if needed
    if (db.IS_VERCEL) {
      await db.resetDatabase();
    }
    
    // Reset and recreate migrations
    db.resetMigrations();
    
    // Deploy schema to database
    if (!db.deploySchema()) {
      process.exit(1);
    }
    
    console.log('✅ Prisma setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during Prisma setup:', error);
    process.exit(1);
  }
}

// Run the main function
main();