import { storage } from "../../storage";
import { errors } from "../../lib/errors";
import type { CreateDestinationInput, UpdateDestinationInput, ListDestinationsQuery } from "./schema";

async function enrichDestination(d: any) {
  const types = await storage.getDestinationTypes();
  const typeMap = types.reduce((acc: any, t: any) => {
    acc[t.destinationtypeId] = t.typeName;
    return acc;
  }, {});
  return {
    ...d,
    id: (d.destinationId || d.id)?.toString(),
    category: d.destinationTypeId ? typeMap[d.destinationTypeId] || "Khác" : "Khác",
  };
}

export async function listDestinations(query: ListDestinationsQuery) {
  const items = await storage.getDestinations(
    query.typeId ? { destinationTypeId: query.typeId } : undefined,
  );
  return Promise.all(items.map(enrichDestination));
}

export async function getDestinationById(id: number) {
  const dest = await storage.getDestination(id);
  if (!dest) throw errors.notFound("Destination");
  return dest;
}

export async function createDestination(input: CreateDestinationInput) {
  const dest = await storage.createDestination(input);
  return enrichDestination(dest);
}

export async function updateDestination(id: number, input: UpdateDestinationInput) {
  const dest = await storage.updateDestination(id, input);
  if (!dest) throw errors.notFound("Destination");
  return enrichDestination(dest);
}

export async function deleteDestination(id: number) {
  const ok = await storage.deleteDestination(id);
  if (!ok) throw errors.notFound("Destination");
}

// ── Types ──
export async function listDestinationTypes() {
  return storage.getDestinationTypes();
}
export async function createDestinationType(input: any) {
  return storage.createDestinationType(input);
}
export async function updateDestinationType(id: number, input: any) {
  const item = await storage.updateDestinationType(id, input);
  if (!item) throw errors.notFound("Type");
  return item;
}
export async function deleteDestinationType(id: number) {
  const ok = await storage.deleteDestinationType(id);
  if (!ok) throw errors.notFound("Type");
}
