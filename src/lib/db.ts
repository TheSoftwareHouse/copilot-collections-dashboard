import { AppDataSource } from "./data-source";

const globalForDb = globalThis as unknown as {
  _dataSourceInitPromise: Promise<typeof AppDataSource> | undefined;
};

export async function getDb() {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  if (!globalForDb._dataSourceInitPromise) {
    globalForDb._dataSourceInitPromise = AppDataSource.initialize().catch(
      (err) => {
        globalForDb._dataSourceInitPromise = undefined;
        throw err;
      }
    );
  }

  return globalForDb._dataSourceInitPromise;
}
