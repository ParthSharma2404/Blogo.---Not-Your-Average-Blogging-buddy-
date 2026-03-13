// Create this as debug.js in your backend folder
const path = require('path');

console.log('=== DEBUGGING ENVIRONMENT VARIABLES ===');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Try different .env locations
const locations = [
  '.env',                    // Current directory
  '../.env',                // Parent directory  
  '../../.env',             // Root directory
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env')
];

const fs = require('fs');

locations.forEach((loc, index) => {
  const fullPath = path.resolve(loc);
  const exists = fs.existsSync(fullPath);
  console.log(`${index + 1}. ${loc} -> ${fullPath} [${exists ? 'EXISTS' : 'NOT FOUND'}]`);
});

console.log('\n=== TRYING TO LOAD .ENV FILES ===');

// Try loading from different locations
locations.forEach((loc, index) => {
  try {
    require('dotenv').config({ path: loc });
    console.log(`${index + 1}. Tried loading from: ${loc}`);
    console.log(`   MONGODB_URI exists: ${!!process.env.MONGODB_URI}`);
    console.log(`   JWT_SECRET exists: ${!!process.env.JWT_SECRET}`);
  } catch (error) {
    console.log(`${index + 1}. Error loading from ${loc}: ${error.message}`);
  }
});