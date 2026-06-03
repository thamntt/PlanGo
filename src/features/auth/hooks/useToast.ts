import { useState, useCallback } from "react";
import type { ToastVariant } from "../components/Toast";

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

/**
 * Single-toast manager. Call `show("...", "error")` to display, auto-dismisses
 * via the Toast component's internal timer.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, variant: ToastVariant = "info") => {
    setToast({ id: Date.now(), message, variant });
  }, []);

  const close = useCallback(() => setToast(null), []);

  return { toast, show, close };
}
