import { createDatabase, type FaderZeroDatabase } from '@/db/db';

export async function createTestDatabase(testName: string) {
  const databaseName = `faderzero-test-${testName}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const database = createDatabase(databaseName);
  await database.open();
  return database;
}

export async function destroyTestDatabase(database: FaderZeroDatabase) {
  database.close();
  await database.delete();
}
