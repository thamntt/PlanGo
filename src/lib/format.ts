/**
 * Pure formatting + ID helpers. No side effects, no I/O.
 */

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function formatVND(amount: number): string {
  // CRITICAL: round to integer first. VND has no sub-đồng denomination, and
  // letting a float through ("19683.8") produces "19.683.8 ₫" which reads as
  // "19 triệu 683 nghìn 8 đồng" instead of the correct "19 nghìn 684 đồng" —
  // a 1000× misreading. Always Math.round before grouping.
  const n = Math.round(amount);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " ₫";
}

/**
 * Compact VND formatter — preserves enough precision so totals match the user's
 * manual sum, just shorter than the full thousand-separated form.
 *
 *   formatVNDCompact(50_000)        → "50K"
 *   formatVNDCompact(350_000)       → "350K"
 *   formatVNDCompact(1_234_567)     → "1.23M"
 *   formatVNDCompact(3_770_000)     → "3.77M"
 *   formatVNDCompact(12_500_000)    → "12.5M"
 *   formatVNDCompact(35_000_000)    → "35M"
 *   formatVNDCompact(120_500_000)   → "120.5M"
 *   formatVNDCompact(1_500_000_000) → "1.5B"
 *
 * Tiers:
 *   < 1K      → integer (sub-1K never used in real life)
 *   1K-10K    → 1 decimal (e.g. 1.5K)
 *   10K-1M    → integer (e.g. 50K, 500K — entered round in real life)
 *   1M-10M    → 2 decimals (e.g. 1.23M) — most travel expenses live here
 *   10M-100M  → 1 decimal (e.g. 12.5M)
 *   100M-1B   → 1 decimal (e.g. 120.5M)
 *   1B+       → 1 decimal (e.g. 1.5B)
 *
 * Trims trailing zeros so 1.50M → "1.5M", 12.0M → "12M".
 */
export function formatVNDCompact(amount: number): string {
  const n = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const trim = (s: string) => s.replace(/\.?0+$/, "");
  if (n < 1_000) return `${sign}${Math.round(n)}`;
  if (n < 1_000_000) {
    const v = n / 1_000;
    return `${sign}${v < 10 ? trim(v.toFixed(1)) : Math.round(v)}K`;
  }
  if (n < 1_000_000_000) {
    const v = n / 1_000_000;
    if (v < 10) return `${sign}${trim(v.toFixed(2))}M`;
    return `${sign}${trim(v.toFixed(1))}M`;
  }
  const v = n / 1_000_000_000;
  return `${sign}${trim(v.toFixed(1))}B`;
}

/**
 * Round an amount UP to the nearest unit (default 1.000đ) for split-by-person
 * calculations. Vietnamese practice: nobody hands out 642đ in change.
 *
 *   roundVNDForSplit(308_642)        → 309_000  (round up to 1K)
 *   roundVNDForSplit(308_642, 5_000) → 310_000  (round up to 5K)
 *
 * Use for per-person amounts in expense splits; the rounding loss is borne by
 * the payer (or distributed via the highest-share recipient).
 */
export function roundVNDForSplit(amount: number, denomination = 1_000): number {
  if (denomination <= 0) return Math.round(amount);
  return Math.ceil(amount / denomination) * denomination;
}

/**
 * Full VND with thousand separator + `₫` suffix — explicit alias of `formatVND`
 * for places that need to communicate "this is the exact amount, not rounded"
 * (settlement receipts, expense detail, final balance).
 */
export const formatVNDExact = formatVND;

/**
 * Display VND rounded to nearest 1.000đ (Vietnamese standard for bills + summaries).
 *
 *   formatVNDRounded(1_234_567)  → "1.235.000 ₫"
 *   formatVNDRounded(50_499)     → "50.000 ₫"
 *   formatVNDRounded(50_500)     → "51.000 ₫"
 *   formatVNDRounded(1_500_000)  → "1.500.000 ₫"
 *   formatVNDRounded(50)         → "0 ₫"
 *
 * Use for hero numbers, totals, budget summaries — anywhere user expects
 * a "clean" amount without trailing 3 random digits. Don't use for individual
 * expense items the user entered (those are already round). Don't use for
 * settlement amounts (those need to be exact for transfer).
 *
 * Pass `denomination` to round to a different unit (e.g. 5_000 for "to nearest 5K").
 */
export function formatVNDRounded(amount: number, denomination = 1_000): string {
  const rounded = Math.round(amount / denomination) * denomination;
  return formatVND(rounded);
}

export function parseVND(str: string): number {
  const cleaned = str.replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}
