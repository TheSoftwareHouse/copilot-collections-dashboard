import { EntitySchema } from "typeorm";
import { ApiMode } from "./enums";

export interface Configuration {
  id: number;
  singletonKey: string;
  apiMode: ApiMode;
  entityName: string;
  premiumRequestsPerSeat: number;
  createdAt: Date;
  updatedAt: Date;
}

export const ConfigurationEntity = new EntitySchema<Configuration>({
  name: "Configuration",
  tableName: "configuration",
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
    apiMode: {
      type: "enum",
      enum: ApiMode,
    },
    entityName: {
      type: "varchar",
      length: 255,
    },
    premiumRequestsPerSeat: {
      type: "int",
      default: 300,
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
