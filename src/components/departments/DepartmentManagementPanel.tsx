"use client";

import Link from "next/link";
import { createDepartmentSchema } from "@/lib/validations/department";
import { useEntityCrud } from "@/lib/hooks/useEntityCrud";
import { UsageStatusIndicator } from "@/components/usage/UsageStatusIndicator";
import EditableTextCell from "@/components/shared/EditableTextCell";
import EntityCreateModal from "@/components/shared/EntityCreateModal";
import EntityLoadingState from "@/components/shared/EntityLoadingState";
import EntityErrorState from "@/components/shared/EntityErrorState";

interface DepartmentRecord {
  id: number;
  name: string;
  seatCount: number;
  usagePercent: number;
  createdAt: string;
  updatedAt: string;
}

export default function DepartmentManagementPanel() {
  const crud = useEntityCrud<DepartmentRecord>({
    apiPath: "/api/departments",
    listKey: "departments",
    entityLabel: "department",
    createSchema: createDepartmentSchema,
  });

  if (crud.isLoading) {
    return <EntityLoadingState label="departments" />;
  }

  if (crud.fetchError) {
    return <EntityErrorState message={crud.fetchError} onRetry={crud.refetch} />;
  }

  return (
    <div className="space-y-6">
      {/* Delete error banner */}
      {crud.deleteError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          {crud.deleteError}
        </div>
      )}

      {/* Add department button */}
      <button
        type="button"
        onClick={() => {
          crud.setShowCreateForm(true);
          crud.setDeleteError(null);
        }}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Add Department
      </button>

      {/* Create department modal */}
      <EntityCreateModal
        entityLabel="Department"
        showCreateForm={crud.showCreateForm}
        resetCreateForm={crud.resetCreateForm}
        createServerError={crud.createServerError}
        createName={crud.createName}
        setCreateName={crud.setCreateName}
        createFieldErrors={crud.createFieldErrors}
        isCreating={crud.isCreating}
        handleCreate={crud.handleCreate}
      />

      {/* Department list */}
      {crud.entities.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            No departments found. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <caption className="sr-only">Departments</caption>
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Seats
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Usage %
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Created
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {crud.entities.map((dept) => (
                <tr key={dept.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="inline-flex items-center gap-2">
                          <UsageStatusIndicator percent={dept.usagePercent} />
                          <EditableTextCell
                            value={dept.name}
                            onSave={async (newValue) => {
                              if (!newValue) {
                                throw new Error("Department name cannot be empty");
                              }
                              await crud.updateName(dept.id, newValue);
                            }}
                            ariaLabel={`Edit name for department ${dept.name}`}
                          />
                          <Link
                            href={`/usage/departments/${dept.id}`}
                            aria-label="View department usage"
                            className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                          >
                            →
                          </Link>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {dept.seatCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">
                        {Math.round(dept.usagePercent)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(dept.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {crud.confirmDeleteId === dept.id ? (
                          <div className="inline-flex flex-col items-end gap-2">
                            {dept.seatCount > 0 && (
                              <span className="text-sm text-amber-600 font-medium">
                                This department has {dept.seatCount} seat(s)
                                assigned. They will be unassigned.
                              </span>
                            )}
                            <span className="inline-flex items-center gap-2">
                              <span className="text-sm text-gray-600">
                                Are you sure?
                              </span>
                              <button
                                type="button"
                                onClick={() => crud.handleDelete(dept.id)}
                                disabled={crud.isDeleting}
                                className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {crud.isDeleting ? "Deleting…" : "Yes, delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => crud.setConfirmDeleteId(null)}
                                className="text-sm font-medium text-gray-600 hover:text-gray-800"
                              >
                                No
                              </button>
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              crud.setConfirmDeleteId(dept.id);
                              crud.setDeleteError(null);
                            }}
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
