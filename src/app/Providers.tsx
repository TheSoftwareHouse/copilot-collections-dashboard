"use client";

import { ModalProvider } from "@/components/shared/ModalProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}
