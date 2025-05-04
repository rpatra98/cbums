const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure output directory exists
const outputDir = path.join(__dirname, 'app', 'generated', 'prisma');
if (!fs.existsSync(outputDir)) {
  console.log('Creating output directory for Prisma client...');
  fs.mkdirSync(outputDir, { recursive: true });
}

// Clean previous Prisma client if it exists
try {
  console.log('Cleaning previous Prisma client...');
  execSync('npx rimraf node_modules/.prisma');
  execSync('npx rimraf app/generated/prisma');
} catch (error) {
  console.log('No previous Prisma client to clean');
}

// Generate Prisma client
try {
  console.log('Generating Prisma client...');
  execSync('npx prisma generate');
  console.log('Prisma client generated successfully!');
} catch (error) {
  console.error('Error generating Prisma client:', error.message);
  process.exit(1);
}

console.log('Setup complete!'); 