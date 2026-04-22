/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tokenPath = path.join(__dirname, '..', 'token.txt');
const token = fs.readFileSync(tokenPath, 'utf8').trim();

// read account_id from env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const accountIdMatch = envContent.match(/TELEGRAM_BOT_ACCOUNT_ID=(.*)/);
const accountId = accountIdMatch ? accountIdMatch[1].trim() : "test-account";

console.log('Running autocannon load test on dashboard stats endpoint...');
try {
  const output = execSync(`npx autocannon -c 50 -d 15 -H "Cookie: access_token=${token}" -H "x-account-id: ${accountId}" http://localhost:3000/api/dashboard/stats?days=30`, { encoding: 'utf8' });
  console.log(output);
  
  console.log('\nRunning autocannon load test on platform metrics endpoint...');
  const output2 = execSync(`npx autocannon -c 30 -d 10 -H "Cookie: access_token=${token}" -H "x-account-id: ${accountId}" http://localhost:3000/api/settings/platform/metrics?range=30d`, { encoding: 'utf8' });
  console.log(output2);
} catch(e) {
  console.error('Error running autocannon:', e.stdout ? e.stdout.toString() : e);
}
