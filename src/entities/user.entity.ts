import { EntitySchema } from "typeorm";

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserEntity = new EntitySchema<User>({
  name: "User",
  tableName: "app_user",
  columns: {
    id: {
      type: "int",
      primary: true,
      generated: "increment",
    },
    username: {
      type: "varchar",
      length: 255,
      unique: true,
    },
    passwordHash: {
      type: "varchar",
      length: 255,
    },
    role: {
      type: "varchar",
      length: 20,
      default: "user",
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
