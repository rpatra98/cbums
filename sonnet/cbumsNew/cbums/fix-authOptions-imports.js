const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

async function processFile(filePath) {
  try {
    const content = await readFileAsync(filePath, 'utf8');
    
    // Check if the file needs to be updated
    if (content.includes('import { authOptions } from "@/lib/auth-options"')) {
      console.log(`Fixing file: ${filePath}`);
      
      // Replace the import statement
      const updatedContent = content.replace(
        'import { authOptions } from "@/app/api/auth/[...nextauth]/route"',
        'import { authOptions } from "@/lib/auth-options"'
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
    } else if (stats.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js'))) {
      // Process .ts, .tsx and .js files
      const fixed = await processFile(filePath);
      if (fixed) fixedCount++;
    }
  }

  return fixedCount;
}

async function main() {
  console.log('Starting to fix authOptions imports...');
  
  // Process both app and lib directories
  const appDirectory = path.join(__dirname, 'app');
  const fixedCountApp = await walkDirectory(appDirectory);
  
  const libDirectory = path.join(__dirname, 'lib');
  const fixedCountLib = await walkDirectory(libDirectory);
  
  // Also check files in the root directory
  const rootFiles = fs.readdirSync(__dirname).filter(f => 
    fs.statSync(path.join(__dirname, f)).isFile() && 
    (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js'))
  );
  
  let fixedCountRoot = 0;
  for (const file of rootFiles) {
    const fixed = await processFile(path.join(__dirname, file));
    if (fixed) fixedCountRoot++;
  }
  
  console.log(`Fixed ${fixedCountApp + fixedCountLib + fixedCountRoot} files.`);
}

main().catch(console.error); 