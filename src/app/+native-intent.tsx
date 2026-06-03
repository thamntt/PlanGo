export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (path.startsWith('/join/')) {
    return path;
  }
  return '/';
}
