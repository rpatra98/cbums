const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const apiDirectory = path.join(__dirname, 'app', 'api');

async function processFile(filePath) {
  try {
    const content = await readFileAsync(filePath, 'utf8');
    
    // Check if the file needs to be updated
    if (content.includes('async function handler(req: NextRequest, context: { params: Record<string, string> })')) {
      console.log(`Fixing file: ${filePath}`);
      
      // Replace the pattern with the corrected one
      const updatedContent = content.replace(
        'async function handler(req: NextRequest, context: { params: Record<string, string> })',
        'async function handler(req: NextRequest, context?: { params: Record<string, string> })'
      );
      
      // Write the fixed content back to the file
      await writeFileAsync(filePath, updatedContent, 'utf8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

async function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // Recursively walk directories
      fixedCount += await walkDirectory(filePath);
    } else if (stats.isFile() && file.endsWith('.ts') && file.includes('route.ts')) {
      // Process .ts files that are routes
      const fixed = await processFile(filePath);
      if (fixed) fixedCount++;
    }
  }

  return fixedCount;
}

async function main() {
  console.log('Starting to fix API route files to make context optional...');
  const fixedCount = await walkDirectory(apiDirectory);
  console.log(`Fixed ${fixedCount} files.`);
}

main().catch(console.error); 