import { EntitySchema } from "typeorm";

export interface GitHubApp {
  id: number;
  singletonKey: string;
  appId: number;
  appSlug: string;
  appName: string;
  privateKeyEncrypted: string;
  webhookSecretEncrypted: string;
  clientId: string;
  clientSecretEncrypted: string;
  htmlUrl: string;
  ownerId: number;
  ownerLogin: string;
  installationId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export const GitHubAppEntity = new EntitySchema<GitHubApp>({
  name: "GitHubApp",
  tableName: "github_app",
  columns: {
    id: {
      type: "int",
      primary: true,
      generated: "increment",
    },
    singletonKey: {
      type: "varchar",
      length: 10,
      default: "GLOBAL",
      unique: true,
    },
    appId: {
      type: "int",
    },
    appSlug: {
      type: "varchar",
      length: 255,
    },
    appName: {
      type: "varchar",
      length: 255,
    },
    privateKeyEncrypted: {
      type: "text",
    },
    webhookSecretEncrypted: {
      type: "text",
    },
    clientId: {
      type: "varchar",
      length: 255,
    },
    clientSecretEncrypted: {
      type: "text",
    },
    htmlUrl: {
      type: "varchar",
      length: 500,
    },
    ownerId: {
      type: "int",
    },
    ownerLogin: {
      type: "varchar",
      length: 255,
    },
    installationId: {
      type: "int",
      nullable: true,
      default: null,
    },
    createdAt: {
      type: "timestamptz",
      createDate: true,
    },
    updatedAt: {
      type: "timestamptz",
      updateDate: true,
    },
  },
});
