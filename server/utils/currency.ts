export function parseCurrencyToNumeric(val: any): string | number | undefined {
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9]/g, "");
    if (cleaned === "") return undefined;
    return cleaned;
  }

  return val;
}
