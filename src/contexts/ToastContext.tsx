import React, { createContext, useCallback, useContext, useState } from "react";
import { Toast, type ToastVariant } from "@/features/auth/components/Toast";

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastApi {
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, variant: ToastVariant = "info", duration?: number) => {
    setToast({ id: Date.now(), message, variant, duration });
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback if provider missing — avoid crashing
    return { show: () => {} };
  }
  return ctx;
}
