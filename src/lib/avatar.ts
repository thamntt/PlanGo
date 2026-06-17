/**
 * Shared avatar utilities. Use these everywhere we render a user avatar so
 * the same person looks the same on every screen — previously each call
 * site had its own `hashColor` with a different palette, so a user's
 * fallback initial would show up as indigo on one screen and orange on
 * another, making users think "the DB doesn't store images".
 */
export const AVATAR_PALETTE = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

/**
 * Stable color for a user id (or any string). Same input → same output, so
 * the fallback initial avatar is consistent across screens.
 */
export function avatarColorFor(seed: string | number | null | undefined): string {
  const s = String(seed ?? "");
  if (!s) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/**
 * The first character of a name, uppercased, with a "?" fallback. Centralised
 * so all "initial avatar" renderers use the same logic and don't crash on
 * empty/null names.
 */
export function avatarInitial(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}
