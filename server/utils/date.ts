export function parseDateStringToISO(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;

  const match = dateStr.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}
