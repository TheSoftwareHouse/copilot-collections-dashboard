import { EntitySchema } from "typeorm";

export interface Department {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DepartmentEntity = new EntitySchema<Department>({
  name: "Department",
  tableName: "department",
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
  },
  indices: [
    {
      name: "UQ_department_name",
      columns: ["name"],
      unique: true,
    },
  ],
});
