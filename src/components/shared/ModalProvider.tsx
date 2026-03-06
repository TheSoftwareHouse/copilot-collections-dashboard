"use client";

import { createContext, useContext, useRef, useCallback } from "react";

interface ModalContextValue {
  register: (onClose: () => void) => void;
  unregister: (onClose: () => void) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModalContext(): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModalContext must be used within a ModalProvider");
  }
  return context;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const currentCloseRef = useRef<(() => void) | null>(null);

  const register = useCallback((onClose: () => void) => {
    if (currentCloseRef.current && currentCloseRef.current !== onClose) {
      currentCloseRef.current();
    }
    currentCloseRef.current = onClose;
  }, []);

  const unregister = useCallback((onClose: () => void) => {
    if (currentCloseRef.current === onClose) {
      currentCloseRef.current = null;
    }
  }, []);

  return (
    <ModalContext.Provider value={{ register, unregister }}>
      {children}
    </ModalContext.Provider>
  );
}
