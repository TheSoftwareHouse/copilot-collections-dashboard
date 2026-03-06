"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
} from "@/lib/validations/user";
import Modal from "@/components/shared/Modal";

interface UserRecord {
  id: number;
  username: string;
  createdAt: string;
  updatedAt: string;
}

type FieldErrors = Partial<Record<keyof CreateUserInput, string[]>>;

export default function UserManagementPanel() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrors>({});
  const [createServerError, setCreateServerError] = useState<string | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);

  // Edit form state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [editServerError, setEditServerError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users);
    } catch {
      setFetchError("Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function resetCreateForm() {
    setCreateUsername("");
    setCreatePassword("");
    setCreateFieldErrors({});
    setCreateServerError(null);
    setShowCreateForm(false);
  }

  function startEdit(user: UserRecord) {
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditPassword("");
    setEditFieldErrors({});
    setEditServerError(null);
    setConfirmDeleteId(null);
    setDeleteError(null);
  }

  function cancelEdit() {
    setEditingUserId(null);
    setEditUsername("");
    setEditPassword("");
    setEditFieldErrors({});
    setEditServerError(null);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateFieldErrors({});
    setCreateServerError(null);

    const parsed = createUserSchema.safeParse({
      username: createUsername,
      password: createPassword,
    });
    if (!parsed.success) {
      setCreateFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        resetCreateForm();
        await fetchUsers();
        return;
      }

      if (response.status === 409) {
        const data = await response.json();
        setCreateServerError(data.error || "Username already exists");
        return;
      }

      if (response.status === 400) {
        const data = await response.json();
        if (data.details) {
          setCreateFieldErrors(data.details as FieldErrors);
        } else {
          setCreateServerError(data.error || "Validation failed");
        }
        return;
      }

      setCreateServerError("An unexpected error occurred. Please try again.");
    } catch {
      setCreateServerError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditFieldErrors({});
    setEditServerError(null);

    const originalUser = users.find((u) => u.id === editingUserId);
    const payload: Record<string, string> = {};
    if (editUsername !== originalUser?.username) payload.username = editUsername;
    if (editPassword) payload.password = editPassword;

    const parsed = updateUserSchema.safeParse(payload);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      setEditFieldErrors(flat.fieldErrors as FieldErrors);
      if (flat.formErrors.length > 0) {
        setEditServerError(flat.formErrors[0]);
      }
      return;
    }

    setIsEditing(true);
    try {
      const response = await fetch(`/api/users/${editingUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 200) {
        cancelEdit();
        await fetchUsers();
        return;
      }

      if (response.status === 409) {
        const data = await response.json();
        setEditServerError(data.error || "Username already exists");
        return;
      }

      if (response.status === 400) {
        const data = await response.json();
        if (data.details) {
          setEditFieldErrors(data.details as FieldErrors);
        } else {
          setEditServerError(data.error || "Validation failed");
        }
        return;
      }

      if (response.status === 404) {
        setEditServerError("User not found. They may have been deleted.");
        return;
      }

      setEditServerError("An unexpected error occurred. Please try again.");
    } catch {
      setEditServerError(
        "Network error. Please check your connection and try again."
      );
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDelete(userId: number) {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (response.status === 200) {
        setConfirmDeleteId(null);
        await fetchUsers();
        return;
      }

      if (response.status === 403) {
        const data = await response.json();
        setDeleteError(data.error || "Cannot delete your own account");
        setConfirmDeleteId(null);
        return;
      }

      if (response.status === 404) {
        setDeleteError("User not found. They may have already been deleted.");
        setConfirmDeleteId(null);
        await fetchUsers();
        return;
      }

      setDeleteError("An unexpected error occurred. Please try again.");
      setConfirmDeleteId(null);
    } catch {
      setDeleteError(
        "Network error. Please check your connection and try again."
      );
      setConfirmDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading users…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          {fetchError}
        </div>
        <button
          type="button"
          onClick={fetchUsers}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delete error banner */}
      {deleteError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
        >
          {deleteError}
        </div>
      )}

      {/* Add user button */}
      <button
        type="button"
        onClick={() => {
          setShowCreateForm(true);
          setDeleteError(null);
        }}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Add User
      </button>

      {/* Create user modal */}
      <Modal isOpen={showCreateForm} onClose={resetCreateForm} title="Add New User">
        {createServerError && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
          >
            {createServerError}
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="create-username"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Username
            </label>
            <input
              id="create-username"
              name="username"
              type="text"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              autoComplete="off"
              aria-describedby={
                createFieldErrors.username
                  ? "create-username-error"
                  : undefined
              }
              aria-invalid={!!createFieldErrors.username}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {createFieldErrors.username && (
              <p
                id="create-username-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {createFieldErrors.username[0]}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="create-password"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Password
            </label>
            <input
              id="create-password"
              name="password"
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              autoComplete="new-password"
              aria-describedby={
                createFieldErrors.password
                  ? "create-password-error"
                  : undefined
              }
              aria-invalid={!!createFieldErrors.password}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {createFieldErrors.password && (
              <p
                id="create-password-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {createFieldErrors.password[0]}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating…" : "Create User"}
            </button>
            <button
              type="button"
              onClick={resetCreateForm}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* User list */}
      {users.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">
            No users found. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <caption className="sr-only">Application users</caption>
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Username
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
              {users.map((user) => (
                <tr key={user.id}>
                  {editingUserId === user.id ? (
                    <td colSpan={3} className="px-6 py-4">
                      {editServerError && (
                        <div
                          role="alert"
                          className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200"
                        >
                          {editServerError}
                        </div>
                      )}
                      <form
                        onSubmit={handleEdit}
                        className="space-y-4"
                        noValidate
                      >
                        <div>
                          <label
                            htmlFor="edit-username"
                            className="block text-sm font-medium text-gray-900 mb-1"
                          >
                            Username
                          </label>
                          <input
                            id="edit-username"
                            name="username"
                            type="text"
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            autoComplete="off"
                            aria-describedby={
                              editFieldErrors.username
                                ? "edit-username-error"
                                : undefined
                            }
                            aria-invalid={!!editFieldErrors.username}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {editFieldErrors.username && (
                            <p
                              id="edit-username-error"
                              className="mt-1 text-sm text-red-600"
                              role="alert"
                            >
                              {editFieldErrors.username[0]}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="edit-password"
                            className="block text-sm font-medium text-gray-900 mb-1"
                          >
                            Password{" "}
                            <span className="font-normal text-gray-500">
                              (leave empty to keep current)
                            </span>
                          </label>
                          <input
                            id="edit-password"
                            name="password"
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            autoComplete="new-password"
                            aria-describedby={
                              editFieldErrors.password
                                ? "edit-password-error"
                                : undefined
                            }
                            aria-invalid={!!editFieldErrors.password}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {editFieldErrors.password && (
                            <p
                              id="edit-password-error"
                              className="mt-1 text-sm text-red-600"
                              role="alert"
                            >
                              {editFieldErrors.password[0]}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="submit"
                            disabled={isEditing}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isEditing ? "Saving…" : "Save Changes"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {confirmDeleteId === user.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              Are you sure?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(user.id)}
                              disabled={isDeleting}
                              className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isDeleting ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-3">
                            <button
                              type="button"
                              onClick={() => startEdit(user)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(user.id);
                                setDeleteError(null);
                                cancelEdit();
                              }}
                              className="text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
