"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import Modal from "@/components/shared/Modal";

export default function TestModalPage() {
  // Only accessible in development/test environments
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [isFirstOpen, setIsFirstOpen] = useState(false);
  const [isSecondOpen, setIsSecondOpen] = useState(false);

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Modal Test Harness</h1>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setIsFirstOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Open Modal
        </button>
        <button
          type="button"
          onClick={() => setIsSecondOpen(true)}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Open Second Modal
        </button>
      </div>

      <p data-testid="modal-status" className="text-sm text-gray-600">
        First modal: {isFirstOpen ? "open" : "closed"} | Second modal:{" "}
        {isSecondOpen ? "open" : "closed"}
      </p>

      {/* Long content to test scroll lock */}
      <div data-testid="scroll-content" className="space-y-4">
        {Array.from({ length: 50 }, (_, i) => (
          <p key={i} className="text-sm text-gray-500">
            Scroll content line {i + 1}
          </p>
        ))}
      </div>

      <Modal
        isOpen={isFirstOpen}
        onClose={() => setIsFirstOpen(false)}
        title="First Modal"
      >
        <div className="space-y-4">
          <p data-testid="modal-children">This is the first modal content.</p>
          <div>
            <label
              htmlFor="test-input"
              className="block text-sm font-medium text-gray-900 mb-1"
            >
              Test Input
            </label>
            <input
              id="test-input"
              type="text"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Inner Button
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isSecondOpen}
        onClose={() => setIsSecondOpen(false)}
        title="Second Modal"
      >
        <p data-testid="second-modal-children">
          This is the second modal content.
        </p>
      </Modal>
    </div>
  );
}
