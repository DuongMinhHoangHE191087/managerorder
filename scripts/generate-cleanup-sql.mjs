import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findLatestBackup() {
  const backupDir = resolve(__dirname, '../backup');
  const files = readdirSync(backupDir).filter(f => f.startsWith('db_backup_') && f.endsWith('.json'));
  if (files.length === 0) return null;
  files.sort();
  return resolve(backupDir, files[files.length - 1]);
}

function run() {
  const backupPath = findLatestBackup();
  if (!backupPath) {
    console.error('❌ No backup file found in backup/ directory!');
    process.exit(1);
  }

  console.log(`📖 Reading backup: ${backupPath}`);
  const db = JSON.parse(readFileSync(backupPath, 'utf-8'));

  const testProducts = [];
  const testCustomers = new Set();
  const testProviders = [];
  const testOrders = new Set();
  const testPurchaseOrders = [];

  // 1. Identify Products
  for (const p of db.products || []) {
    if (p.name && p.name.toLowerCase().includes('smoke product')) {
      testProducts.push(p);
    }
  }

  // 2. Identify Customers & Customer Contacts
  const testCustomerIds = new Set();
  for (const c of db.customers || []) {
    const fn = c.full_name || '';
    if (
      fn.toLowerCase().includes('smoke customer') ||
      fn.toLowerCase().includes('sepay test') ||
      fn.toLowerCase().includes('webhook test') ||
      fn.toLowerCase().includes('toggle test')
    ) {
      testCustomerIds.add(c.id);
      testCustomers.add(c);
    }
  }

  for (const cc of db.customer_contacts || []) {
    const val = cc.value || '';
    if (
      val.toLowerCase().includes('test') ||
      val.toLowerCase().includes('sepay-test') ||
      val.toLowerCase().includes('sepay-toggle-test') ||
      val.toLowerCase().includes('test-webhook-connection') ||
      val.toLowerCase().includes('@example.test')
    ) {
      testCustomerIds.add(cc.customer_id);
    }
  }

  // Back-populate customers found via contacts
  for (const c of db.customers || []) {
    if (testCustomerIds.has(c.id) && ![...testCustomers].some(x => x.id === c.id)) {
      testCustomers.add(c);
    }
  }

  // 3. Identify Providers
  const testProviderIds = new Set();
  for (const p of db.providers || []) {
    if (p.name && p.name.toLowerCase().includes('smoke provider')) {
      testProviders.push(p);
      testProviderIds.add(p.id);
    }
  }

  // 4. Identify Orders & Purchase Orders
  for (const o of db.orders || []) {
    const sn = o.sales_note || '';
    const oc = o.order_code || '';
    if (
      testCustomerIds.has(o.customer_id) ||
      sn.toLowerCase().includes('smoke flow') ||
      sn.toLowerCase().includes('thanh toan test') ||
      sn.toLowerCase().includes('dl-testwebhook') ||
      sn.toLowerCase().includes('dl-a588a4') ||
      sn.toLowerCase().includes('dl-e4e082') ||
      sn.toLowerCase().includes('dl-51d8cb') ||
      sn.toLowerCase().includes('dl-1e54d9') ||
      oc.toLowerCase().includes('ord-test')
    ) {
      testOrders.add(o);
    }
  }

  for (const po of db.purchase_orders || []) {
    const note = po.notes || '';
    if (testProviderIds.has(po.provider_id) || note.toLowerCase().includes('smoke purchase order')) {
      testPurchaseOrders.push(po);
    }
  }

  // Write individual SQL deletion scripts
  const sqlLines = [];
  sqlLines.push('-- ========================================================');
  sqlLines.push('-- DRAFT SQL CLEANUP SCRIPT (INDIVIDUAL LINE-BY-LINE DELETIONS)');
  sqlLines.push(`-- Source Backup: ${backupPath}`);
  sqlLines.push('-- ========================================================\n');
  sqlLines.push('BEGIN;\n');

  // order_items
  if (testOrders.size > 0) {
    sqlLines.push('-- 1. ORDER ITEMS TO DELETE:');
    for (const o of testOrders) {
      sqlLines.push(`DELETE FROM order_items WHERE order_id = '${o.id}'; -- linked to Order ${o.order_code || o.id}`);
    }
    sqlLines.push('');

    // license_keys
    sqlLines.push('-- 2. LICENSE KEYS TO DELETE:');
    for (const o of testOrders) {
      sqlLines.push(`DELETE FROM license_keys WHERE order_id = '${o.id}';`);
    }
    sqlLines.push('');

    // orders
    sqlLines.push('-- 3. ORDERS TO DELETE:');
    for (const o of testOrders) {
      sqlLines.push(`DELETE FROM orders WHERE id = '${o.id}'; -- Code: ${o.order_code || 'N/A'}, Sales Note: "${o.sales_note || ''}"`);
    }
    sqlLines.push('');
  }

  // purchase_orders
  if (testPurchaseOrders.length > 0) {
    sqlLines.push('-- 4. PURCHASE ORDERS TO DELETE:');
    for (const po of testPurchaseOrders) {
      sqlLines.push(`DELETE FROM purchase_orders WHERE id = '${po.id}'; -- Note: "${po.notes || ''}"`);
    }
    sqlLines.push('');
  }

  // customer_contacts
  if (testCustomers.size > 0) {
    sqlLines.push('-- 5. CUSTOMER CONTACTS TO DELETE:');
    for (const c of testCustomers) {
      sqlLines.push(`DELETE FROM customer_contacts WHERE customer_id = '${c.id}'; -- Contact of ${c.full_name}`);
    }
    sqlLines.push('');

    // customers
    sqlLines.push('-- 6. CUSTOMERS TO DELETE:');
    for (const c of testCustomers) {
      sqlLines.push(`DELETE FROM customers WHERE id = '${c.id}'; -- Name: ${c.full_name}`);
    }
    sqlLines.push('');
  }

  // providers
  if (testProviders.length > 0) {
    sqlLines.push('-- 7. PROVIDERS TO DELETE:');
    for (const p of testProviders) {
      sqlLines.push(`DELETE FROM providers WHERE id = '${p.id}'; -- Name: ${p.name}`);
    }
    sqlLines.push('');
  }

  // products
  if (testProducts.length > 0) {
    sqlLines.push('-- 8. PRODUCTS TO DELETE:');
    for (const p of testProducts) {
      sqlLines.push(`DELETE FROM products WHERE id = '${p.id}'; -- Name: "${p.name}"`);
    }
    sqlLines.push('');
  }

  sqlLines.push('COMMIT;');

  const sqlContent = sqlLines.join('\n');
  const sqlPath = resolve(__dirname, '../backup/cleanup_individual_rows.sql');
  writeFileSync(sqlPath, sqlContent, 'utf-8');

  console.log(`\n==================================================`);
  console.log(`📊 ANALYSIS SUMMARY:`);
  console.log(`   - Test Products: ${testProducts.length}`);
  console.log(`   - Test Customers: ${testCustomers.size}`);
  console.log(`   - Test Providers: ${testProviders.length}`);
  console.log(`   - Test Orders: ${testOrders.size}`);
  console.log(`   - Test Purchase Orders: ${testPurchaseOrders.length}`);
  console.log(`\n💾 Individual SQL script written to:\n   ${sqlPath}`);
  console.log(`==================================================`);
}

run();
