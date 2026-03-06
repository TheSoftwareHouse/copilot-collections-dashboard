import { EntitySchema } from "typeorm";

export interface Session {
  id: number;
  token: string;
  userId: number;
  expiresAt: Date;
  refreshToken: string | null;
  createdAt: Date;
}

export const SessionEntity = new EntitySchema<Session>({
  name: "Session",
  tableName: "session",
  columns: {
    id: {
      type: "int",
      primary: true,
      generated: "increment",
    },
    token: {
      type: "varchar",
      length: 64,
      unique: true,
    },
    userId: {
      type: "int",
    },
    expiresAt: {
      type: "timestamptz",
    },
    refreshToken: {
      type: "text",
      nullable: true,
    },
    createdAt: {
      type: "timestamptz",
      createDate: true,
    },
  },
  indices: [
    {
      name: "IDX_session_userId",
      columns: ["userId"],
    },
  ],
});
