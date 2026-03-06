"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { MONTH_NAMES } from "@/lib/constants";
import { formatName } from "@/lib/format-helpers";
import Modal from "@/components/shared/Modal";
import AddMembersForm from "@/components/teams/AddMembersForm";
import BackfillHistoryForm from "@/components/teams/BackfillHistoryForm";

interface MemberRecord {
  seatId: number;
  githubUsername: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
}

interface TeamMembersPanelProps {
  teamId: number;
  teamName: string;
  onClose: () => void;
}

export default function TeamMembersPanel({
  teamId,
  teamName,
  onClose,
}: TeamMembersPanelProps) {
  // Member list state
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Mode state (add members / backfill history)
  const [activeMode, setActiveMode] = useState<'add' | 'backfill' | null>(null);

  // Remove state
  const [confirmRemoveSeatId, setConfirmRemoveSeatId] = useState<number | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeMode, setRemoveMode] = useState<null | "choose" | "purge-confirm">(null);
  const [purgeImpactMonths, setPurgeImpactMonths] = useState<number | null>(null);
  const [isPurgeImpactLoading, setIsPurgeImpactLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }
      const data = await response.json();
      setMembers(data.members);
      setMonth(data.month);
      setYear(data.year);
    } catch {
      setFetchError("Failed to load team members. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  /** Refresh member list silently without showing the loading spinner.
   *  Used after backfill so the BackfillHistoryForm stays mounted and
   *  can display its success message. */
  const refreshMembersSilently = useCallback(async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (!response.ok) return;
      const data = await response.json();
      setMembers(data.members);
      setMonth(data.month);
      setYear(data.year);
    } catch {
      // Silently ignore — the stale list is still usable and the user can
      // switch tabs or reopen the panel to trigger a full refresh.
    }
  }, [teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleRemove(seatId: number, mode: "retire" | "purge" = "retire") {
    setRemoveError(null);
    if (mode === "purge") {
      setIsPurging(true);
    } else {
      setIsRemoving(true);
    }
    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: [seatId], mode }),
      });

      if (response.ok) {
        cancelRemoveFlow();
        await fetchMembers();
        return;
      }

      setRemoveError("Failed to remove member. Please try again.");
      cancelRemoveFlow();
    } catch {
      setRemoveError("Network error. Please check your connection and try again.");
      cancelRemoveFlow();
    } finally {
      setIsRemoving(false);
      setIsPurging(false);
    }
  }

  function cancelRemoveFlow() {
    setConfirmRemoveSeatId(null);
    setRemoveMode(null);
    setPurgeImpactMonths(null);
    setIsPurgeImpactLoading(false);
  }

  async function handlePurgeClick(seatId: number) {
    setRemoveMode("purge-confirm");
    setIsPurgeImpactLoading(true);
    setPurgeImpactMonths(null);
    setRemoveError(null);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/members/purge-impact?seatId=${seatId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setPurgeImpactMonths(data.months);
      } else {
        setRemoveError("Failed to load purge impact. Please try again.");
        setRemoveMode("choose");
      }
    } catch {
      setRemoveError("Network error. Please check your connection and try again.");
      setRemoveMode("choose");
    } finally {
      setIsPurgeImpactLoading(false);
    }
  }

  const existingMemberSeatIds = useMemo(() => members.map((m) => m.seatId), [members]);

  function handleMembersAdded() {
    setActiveMode(null);
    fetchMembers();
  }

  function handleMembersBackfilled() {
    refreshMembersSilently();
  }

  const monthLabel =
    month !== null && year !== null
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : "";

  if (isLoading) {
    return (
      <Modal isOpen={true} onClose={onClose} title={`Members of ${teamName}`} size="large">
        <p className="text-sm text-gray-500">Loading members…</p>
      </Modal>
    );
  }

  if (fetchError) {
    return (
      <Modal isOpen={true} onClose={onClose} title={`Members of ${teamName}`} size="large">
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          {fetchError}
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={fetchMembers}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={`Members of ${teamName}`} size="large">
      {monthLabel && (
        <p className="text-sm text-gray-500 mb-4">
          Members for {monthLabel}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => setActiveMode(activeMode === 'add' ? null : 'add')}
          className={`rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            activeMode === 'add'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Add Members
        </button>
        <button
          type="button"
          onClick={() => setActiveMode(activeMode === 'backfill' ? null : 'backfill')}
          className={`rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            activeMode === 'backfill'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Backfill History
        </button>
      </div>

      {/* Add Members form */}
      {activeMode === 'add' && (
        <AddMembersForm
          teamId={teamId}
          existingMemberSeatIds={existingMemberSeatIds}
          onMembersAdded={handleMembersAdded}
        />
      )}

      {/* Backfill History form */}
      {activeMode === 'backfill' && (
        <BackfillHistoryForm
          teamId={teamId}
          onMembersBackfilled={handleMembersBackfilled}
        />
      )}

      {/* Remove error banner */}
      {removeError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          {removeError}
        </div>
      )}

      {/* Member list */}
      {members.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            This team has no members for {monthLabel || "the current month"}.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <caption className="sr-only">Team members</caption>
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  GitHub Username
                </th>
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.seatId}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {member.githubUsername}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatName(member.firstName, member.lastName)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {confirmRemoveSeatId === member.seatId ? (
                      <span className="inline-flex items-center gap-2 flex-wrap justify-end">
                        {removeMode === "purge-confirm" ? (
                          <>
                            {isPurgeImpactLoading ? (
                              <span className="text-sm text-gray-500">Loading impact…</span>
                            ) : (
                              <span className="text-sm text-gray-600">
                                This will remove {member.githubUsername} from {purgeImpactMonths ?? 0} month{purgeImpactMonths === 1 ? "" : "s"} of team history.
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemove(member.seatId, "purge")}
                              disabled={isPurging || isPurgeImpactLoading}
                              className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPurging ? "Purging…" : "Confirm Purge"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelRemoveFlow}
                              className="text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRemove(member.seatId, "retire")}
                              disabled={isRemoving}
                              className="text-sm font-medium text-yellow-700 hover:text-yellow-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRemoving ? "Removing…" : "Retire"}
                            </button>
                            <span className="text-xs text-gray-400">current month only</span>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => handlePurgeClick(member.seatId)}
                              disabled={isRemoving}
                              className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Purge
                            </button>
                            <span className="text-xs text-gray-400">all months</span>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={cancelRemoveFlow}
                              className="text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRemoveSeatId(member.seatId);
                          setRemoveMode("choose");
                          setRemoveError(null);
                          setPurgeImpactMonths(null);
                        }}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
