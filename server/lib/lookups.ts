import { storage } from "../storage";

/** Resolve a POI type name (e.g. "attraction") to its DB id */
export async function resolvePoiTypeId(typeName: string | undefined): Promise<number | undefined> {
  if (!typeName) return undefined;
  const types = await storage.getPoiTypes();
  const found = types.find((t: any) => t.typeName === typeName);
  return found?.poitypeId;
}

/** Resolve an expense type name (Vi or En) to its DB id */
export async function resolveExpenseTypeId(
  typeName: string | undefined,
): Promise<number | undefined> {
  if (!typeName) return undefined;
  const types = await storage.getExpenseTypes();
  const typeMap: Record<string, string> = {
    transport: "Di chuyển",
    shopping: "Mua sắm",
    food: "Ăn uống",
    sightseeing: "Tham quan",
    other: "Khác",
  };
  const translated = typeMap[typeName] || typeName;
  const found = types.find(
    (t: any) =>
      t.name === translated ||
      t.name === typeName ||
      t.description === translated ||
      t.description === typeName,
  );
  return found?.expenseTypeId;
}
