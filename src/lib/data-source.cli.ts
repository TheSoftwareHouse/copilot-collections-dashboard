import "reflect-metadata";
import { DataSource } from "typeorm";
import { allEntities, parseConnectionString } from "./data-source.shared";

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
  migrations: ["migrations/*.ts"],
  synchronize: false,
  logging: false,
});
