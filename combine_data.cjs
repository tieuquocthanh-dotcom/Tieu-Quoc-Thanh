const fs = require('fs');
const path = require('path');

const dataDir = './data';
const publicDir = './public';
const outputFile = path.join(publicDir, 'full_backup.json');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

const collections = [
  'appUsers',
  'chinaImports',
  'customers',
  'goodsReceipts',
  'inventory',
  'notes',
  'paymentMethods',
  'plannedOrders',
  'products',
  'sales',
  'savingsBooks',
  'shippers',
  'suppliers',
  'warehouses'
];

const backup = {
  version: "1.0",
  timestamp: new Date().toISOString(),
  data: {}
};

collections.forEach(collection => {
  const filePath = path.join(dataDir, `${collection}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      backup.data[collection] = data;
      console.log(`Successfully read ${collection}.json (${data.length} items)`);
    } catch (error) {
      console.error(`Error reading ${collection}.json:`, error.message);
    }
  } else {
    console.warn(`File ${collection}.json not found`);
  }
});

fs.writeFileSync(outputFile, JSON.stringify(backup, null, 2));
console.log(`Full backup created at ${outputFile}`);
