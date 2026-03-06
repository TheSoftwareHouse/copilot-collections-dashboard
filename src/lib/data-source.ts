import { DataSource } from "typeorm";
import { allEntities, parseConnectionString } from "@/lib/data-source.shared";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const connectionConfig = parseConnectionString(databaseUrl);

export const AppDataSource = new DataSource({
  type: "postgres",
  host: connectionConfig.host,
  port: connectionConfig.port,
  username: connectionConfig.username,
  password: connectionConfig.password,
  database: connectionConfig.database,
  entities: allEntities,
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
});
