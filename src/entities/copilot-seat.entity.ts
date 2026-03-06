import { EntitySchema } from "typeorm";
import { SeatStatus } from "./enums";

export interface CopilotSeat {
  id: number;
  githubUsername: string;
  githubUserId: number;
  status: SeatStatus;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  departmentId: number | null;
  assignedAt: Date | null;
  lastActivityAt: Date | null;
  lastActivityEditor: string | null;
  planType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const CopilotSeatEntity = new EntitySchema<CopilotSeat>({
  name: "CopilotSeat",
  tableName: "copilot_seat",
  columns: {
    id: {
      type: "int",
      primary: true,
      generated: "increment",
    },
    githubUsername: {
      type: "varchar",
      length: 255,
      unique: true,
    },
    githubUserId: {
      type: "int",
    },
    status: {
      type: "enum",
      enum: SeatStatus,
      default: SeatStatus.ACTIVE,
    },
    firstName: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    lastName: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    department: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    departmentId: {
      type: "int",
      nullable: true,
    },
    assignedAt: {
      type: "timestamptz",
      nullable: true,
    },
    lastActivityAt: {
      type: "timestamptz",
      nullable: true,
    },
    lastActivityEditor: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    planType: {
      type: "varchar",
      length: 50,
      nullable: true,
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
  indices: [
    {
      name: "IDX_copilot_seat_status",
      columns: ["status"],
    },
  ],
});
