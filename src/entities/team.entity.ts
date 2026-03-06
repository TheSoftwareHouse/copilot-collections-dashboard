import { EntitySchema } from "typeorm";

export interface Team {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export const TeamEntity = new EntitySchema<Team>({
  name: "Team",
  tableName: "team",
  columns: {
    id: {
      type: "int",
      primary: true,
      generated: "increment",
    },
    name: {
      type: "varchar",
      length: 255,
    },
    createdAt: {
      type: "timestamptz",
      createDate: true,
    },
    updatedAt: {
      type: "timestamptz",
      updateDate: true,
    },
    deletedAt: {
      type: "timestamptz",
      nullable: true,
      default: null,
    },
  },
  indices: [
    {
      name: "UQ_team_name_active",
      columns: ["name"],
      unique: true,
      where: '"deletedAt" IS NULL',
    },
  ],
});
