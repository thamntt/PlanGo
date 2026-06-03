/**
 * Pure formatting + ID helpers. No side effects, no I/O.
 */

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function formatVND(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " ₫";
}

export function parseVND(str: string): number {
  const cleaned = str.replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}
