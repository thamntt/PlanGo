import { storage } from '../server/storage';

async function check() {
  const types = await storage.getExpenseTypes();
  console.log('Expense Types:', JSON.stringify(types, null, 2));
  process.exit(0);
}

check();
