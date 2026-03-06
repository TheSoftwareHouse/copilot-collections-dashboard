import Modal from "@/components/shared/Modal";

type FieldErrors = Partial<Record<"name", string[]>>;

interface EntityCreateModalProps {
  entityLabel: string;
  showCreateForm: boolean;
  resetCreateForm: () => void;
  createServerError: string | null;
  createName: string;
  setCreateName: (name: string) => void;
  createFieldErrors: FieldErrors;
  isCreating: boolean;
  handleCreate: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export default function EntityCreateModal({
  entityLabel,
  showCreateForm,
  resetCreateForm,
  createServerError,
  createName,
  setCreateName,
  createFieldErrors,
  isCreating,
  handleCreate,
}: EntityCreateModalProps) {
  return (
    <Modal
      isOpen={showCreateForm}
      onClose={resetCreateForm}
      title={`Add New ${entityLabel}`}
    >
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
            htmlFor="create-name"
            className="block text-sm font-medium text-gray-900 mb-1"
          >
            {entityLabel} Name
          </label>
          <input
            id="create-name"
            name="name"
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            autoComplete="off"
            aria-describedby={
              createFieldErrors.name ? "create-name-error" : undefined
            }
            aria-invalid={!!createFieldErrors.name}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {createFieldErrors.name && (
            <p
              id="create-name-error"
              className="mt-1 text-sm text-red-600"
              role="alert"
            >
              {createFieldErrors.name[0]}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating…" : `Create ${entityLabel}`}
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
  );
}
