"use client";

import { useState } from "react";
import Link from "next/link";
import { createTeamSchema } from "@/lib/validations/team";
import { useEntityCrud } from "@/lib/hooks/useEntityCrud";
import TeamMembersPanel from "@/components/teams/TeamMembersPanel";
import { UsageStatusIndicator } from "@/components/usage/UsageStatusIndicator";
import EditableTextCell from "@/components/shared/EditableTextCell";
import EntityCreateModal from "@/components/shared/EntityCreateModal";
import EntityLoadingState from "@/components/shared/EntityLoadingState";
import EntityErrorState from "@/components/shared/EntityErrorState";

interface TeamRecord {
  id: number;
  name: string;
  memberCount: number;
  usagePercent: number;
  createdAt: string;
  updatedAt: string;
}

export default function TeamManagementPanel() {
  const crud = useEntityCrud<TeamRecord>({
    apiPath: "/api/teams",
    listKey: "teams",
    entityLabel: "team",
    createSchema: createTeamSchema,
  });

  // Member management state
  const [managingMembersTeam, setManagingMembersTeam] = useState<TeamRecord | null>(null);

  function openMembers(team: TeamRecord) {
    setManagingMembersTeam(team);
    crud.setConfirmDeleteId(null);
    crud.setDeleteError(null);
  }

  if (crud.isLoading) {
    return <EntityLoadingState label="teams" />;
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

      {/* Add team button */}
      <button
        type="button"
        onClick={() => {
          crud.setShowCreateForm(true);
          crud.setDeleteError(null);
        }}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Add Team
      </button>

      {/* Create team modal */}
      <EntityCreateModal
        entityLabel="Team"
        showCreateForm={crud.showCreateForm}
        resetCreateForm={crud.resetCreateForm}
        createServerError={crud.createServerError}
        createName={crud.createName}
        setCreateName={crud.setCreateName}
        createFieldErrors={crud.createFieldErrors}
        isCreating={crud.isCreating}
        handleCreate={crud.handleCreate}
      />

      {/* Team list */}
      {crud.entities.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            No teams found. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <caption className="sr-only">Teams</caption>
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
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Members
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
              {crud.entities.map((team) => (
                <tr key={team.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="inline-flex items-center gap-2">
                          <UsageStatusIndicator percent={team.usagePercent} />
                          <EditableTextCell
                            value={team.name}
                            onSave={async (newValue) => {
                              if (!newValue) {
                                throw new Error("Team name cannot be empty");
                              }
                              await crud.updateName(team.id, newValue);
                            }}
                            ariaLabel={`Edit name for team ${team.name}`}
                          />
                          <Link
                            href={`/usage/teams/${team.id}`}
                            aria-label="View team usage"
                            className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                          >
                            →
                          </Link>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">
                        {team.memberCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">
                        {Math.round(team.usagePercent)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(team.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {crud.confirmDeleteId === team.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              Are you sure?
                            </span>
                            <button
                              type="button"
                              onClick={() => crud.handleDelete(team.id)}
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
                        ) : (
                          <span className="inline-flex gap-3">
                            <button
                              type="button"
                              onClick={() => openMembers(team)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              Members
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                crud.setConfirmDeleteId(team.id);
                                crud.setDeleteError(null);
                              }}
                              className="text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Team members panel */}
      {managingMembersTeam && (
        <TeamMembersPanel
          teamId={managingMembersTeam.id}
          teamName={managingMembersTeam.name}
          onClose={() => setManagingMembersTeam(null)}
        />
      )}
    </div>
  );
}
