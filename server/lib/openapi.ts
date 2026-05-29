/**
 * OpenAPI spec generator. Schemas here are intentionally simpler than the
 * runtime Zod validators — many of those use `.transform()` chains which the
 * openapi generator can't represent. The schemas below describe the wire
 * format documented for API consumers; the runtime validators normalize input.
 */
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ── Common ──
const errorResponseSchema = z.object({
  status: z.number(),
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
}).openapi("ErrorResponse");

function ok(description = "OK") {
  return { description };
}

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const idParam = z.object({ id: z.string().describe("Numeric resource ID") });

// ── Auth ──
const loginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string(),
});
const registerSchema = z.object({
  userName: z.string().optional(),
  username: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["auth"],
  summary: "Log in. Returns user + JWT token.",
  request: { body: { content: { "application/json": { schema: loginSchema } } } },
  responses: {
    200: ok(),
    401: { description: "Invalid credentials", content: { "application/json": { schema: errorResponseSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  tags: ["auth"],
  summary: "Create a new account. Returns user + JWT token.",
  request: { body: { content: { "application/json": { schema: registerSchema } } } },
  responses: { 201: ok("Created"), 409: { description: "Email already exists" } },
});

// ── Trips ──
const tripCreateSchema = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.string().or(z.number()).optional(),
  numPeople: z.number().int().positive().optional(),
  status: z.enum(["draft", "active", "completed"]).optional(),
  destination: z.string().optional(),
  destinationId: z.number().int().positive().optional(),
  ownerId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional(),
  preferences: z.array(z.string()).optional(),
  days: z.array(z.unknown()).optional(),
});
const tripUpdateSchema = tripCreateSchema.partial().extend({
  expenses: z.array(z.unknown()).optional(),
  invitationToken: z.string().optional(),
  sharePermission: z.enum(["viewer", "editor"]).optional(),
});

registry.registerPath({
  method: "get",
  path: "/api/trips",
  tags: ["trips"],
  summary: "List trips (optionally by ownerId or memberId).",
  request: {
    query: z.object({
      ownerId: z.string().optional(),
      memberId: z.string().optional(),
    }),
  },
  responses: { 200: ok() },
});

registry.registerPath({
  method: "get",
  path: "/api/trips/{id}",
  tags: ["trips"],
  summary: "Get a trip including nested days/items/expenses/members.",
  request: { params: idParam },
  responses: { 200: ok(), 404: { description: "Trip not found" } },
});

registry.registerPath({
  method: "post",
  path: "/api/trips",
  tags: ["trips"],
  summary: "Create a trip (optionally with nested days/activities).",
  request: { body: { content: { "application/json": { schema: tripCreateSchema } } } },
  responses: { 201: ok("Created"), 400: { description: "Validation failed" } },
});

registry.registerPath({
  method: "put",
  path: "/api/trips/{id}",
  tags: ["trips"],
  summary: "Update trip + nested days/items/expenses (transactional).",
  request: { params: idParam, body: { content: { "application/json": { schema: tripUpdateSchema } } } },
  responses: { 200: ok() },
});

registry.registerPath({
  method: "delete",
  path: "/api/trips/{id}",
  tags: ["trips"],
  request: { params: idParam },
  responses: { 200: ok() },
});

registry.registerPath({
  method: "get", path: "/api/trips/{tripId}/days", tags: ["trips"],
  request: { params: z.object({ tripId: z.string() }) },
  responses: { 200: ok() },
});
registry.registerPath({
  method: "post", path: "/api/trips/{tripId}/days", tags: ["trips"],
  request: { params: z.object({ tripId: z.string() }) },
  responses: { 201: ok("Created") },
});
registry.registerPath({
  method: "get", path: "/api/days/{dayId}/items", tags: ["trips"],
  request: { params: z.object({ dayId: z.string() }) },
  responses: { 200: ok() },
});
registry.registerPath({
  method: "post", path: "/api/days/{dayId}/items", tags: ["trips"],
  request: { params: z.object({ dayId: z.string() }) },
  responses: { 201: ok("Created") },
});
registry.registerPath({
  method: "get", path: "/api/trips/{tripId}/expenses", tags: ["trips"],
  request: { params: z.object({ tripId: z.string() }) },
  responses: { 200: ok() },
});
registry.registerPath({
  method: "post", path: "/api/trips/{tripId}/expenses", tags: ["trips"],
  request: { params: z.object({ tripId: z.string() }) },
  responses: { 201: ok("Created") },
});

// ── Itinerary AI ──
const generateInputSchema = z.object({
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  budget: z.string().or(z.number()).optional(),
  totalBudget: z.number().optional(),
  numPeople: z.number().int().positive().optional(),
  preferences: z.array(z.string()).optional(),
});

registry.registerPath({
  method: "post",
  path: "/api/generate-itinerary",
  tags: ["itinerary"],
  summary: "Generate a Vietnam travel itinerary via Gemini → OpenAI fallback + SerpAPI enrichment. Rate-limited.",
  request: { body: { content: { "application/json": { schema: generateInputSchema } } } },
  responses: {
    200: ok("Returns { days, provider }"),
    429: { description: "Rate limit exceeded" },
    501: { description: "AI provider not configured" },
    502: { description: "Both Gemini and OpenAI failed" },
  },
});

// ── Destinations ──
const destinationCreateSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  latitude: z.string().or(z.number()).optional(),
  longitude: z.string().or(z.number()).optional(),
  destinationTypeId: z.number().int().positive().optional(),
  category: z.string().optional(),
  googlePlaceId: z.string().optional(),
});

registry.registerPath({ method: "get", path: "/api/destinations", tags: ["destinations"], request: { query: z.object({ typeId: z.string().optional() }) }, responses: { 200: ok() } });
registry.registerPath({ method: "get", path: "/api/destinations/{id}", tags: ["destinations"], request: { params: idParam }, responses: { 200: ok() } });
registry.registerPath({ method: "post", path: "/api/destinations", tags: ["destinations"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: destinationCreateSchema } } } }, responses: { 201: ok("Created") } });
registry.registerPath({ method: "put", path: "/api/destinations/{id}", tags: ["destinations"], security: [{ bearerAuth: [] }], request: { params: idParam, body: { content: { "application/json": { schema: destinationCreateSchema.partial() } } } }, responses: { 200: ok() } });
registry.registerPath({ method: "delete", path: "/api/destinations/{id}", tags: ["destinations"], security: [{ bearerAuth: [] }], request: { params: idParam }, responses: { 200: ok() } });

registry.registerPath({ method: "get", path: "/api/destination-types", tags: ["destinations"], responses: { 200: ok() } });

// ── POIs ──
const poiCreateSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  destinationId: z.number().int().positive().optional(),
  type: z.string().optional(),
  latitude: z.string().or(z.number()).optional(),
  longitude: z.string().or(z.number()).optional(),
  address: z.string().nullable().optional(),
  googlePlaceId: z.string().optional(),
  openHours: z.string().optional(),
});
registry.registerPath({ method: "get", path: "/api/pois", tags: ["pois"], request: { query: z.object({ destinationId: z.string().optional() }) }, responses: { 200: ok() } });
registry.registerPath({ method: "get", path: "/api/pois/{id}", tags: ["pois"], request: { params: idParam }, responses: { 200: ok() } });
registry.registerPath({ method: "post", path: "/api/pois", tags: ["pois"], request: { body: { content: { "application/json": { schema: poiCreateSchema } } } }, responses: { 201: ok("Created") } });
registry.registerPath({ method: "put", path: "/api/pois/{id}", tags: ["pois"], request: { params: idParam, body: { content: { "application/json": { schema: poiCreateSchema.partial() } } } }, responses: { 200: ok() } });
registry.registerPath({ method: "delete", path: "/api/pois/{id}", tags: ["pois"], security: [{ bearerAuth: [] }], request: { params: idParam }, responses: { 200: ok() } });

// ── Reviews ──
const reviewCreateSchema = z.object({
  userId: z.number().int().positive(),
  tripId: z.number().int().positive().optional(),
  itemId: z.number().int().positive().optional(),
  rating: z.number().min(0).max(5),
  comment: z.string().nullable().optional(),
});
registry.registerPath({ method: "get", path: "/api/reviews", tags: ["reviews"], request: { query: z.object({ tripId: z.string().optional(), itemId: z.string().optional(), destinationId: z.string().optional() }) }, responses: { 200: ok() } });
registry.registerPath({ method: "post", path: "/api/reviews", tags: ["reviews"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: reviewCreateSchema } } } }, responses: { 201: ok("Created") } });
registry.registerPath({ method: "put", path: "/api/reviews/{id}", tags: ["reviews"], security: [{ bearerAuth: [] }], request: { params: idParam, body: { content: { "application/json": { schema: reviewCreateSchema.partial() } } } }, responses: { 200: ok() } });
registry.registerPath({ method: "delete", path: "/api/reviews/{id}", tags: ["reviews"], security: [{ bearerAuth: [] }], request: { params: idParam, query: z.object({ userId: z.string(), type: z.enum(["trip", "item"]).optional() }) }, responses: { 200: ok() } });

// ── Share ──
const shareSchema = z.object({
  tripId: z.number().int().positive().optional(),
  shareCode: z.string().optional(),
  role: z.enum(["viewer", "editor"]).optional(),
  sharePermission: z.enum(["viewer", "editor"]).optional(),
});
registry.registerPath({ method: "post", path: "/api/share", tags: ["share"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: shareSchema } } } }, responses: { 200: ok() } });
registry.registerPath({ method: "get", path: "/api/share/{code}", tags: ["share"], request: { params: z.object({ code: z.string() }) }, responses: { 200: ok(), 404: { description: "Share code not found" } } });
registry.registerPath({
  method: "post", path: "/api/share/join", tags: ["share"], security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ shareCode: z.string(), userId: z.number().int().positive(), role: z.enum(["viewer", "editor"]).optional() }) } } } },
  responses: { 200: ok() },
});
registry.registerPath({
  method: "patch", path: "/api/share/companion", tags: ["share"], security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ shareCode: z.string(), userId: z.number().int().positive(), role: z.enum(["viewer", "editor"]) }) } } } },
  responses: { 200: ok() },
});
registry.registerPath({
  method: "delete", path: "/api/share/companion", tags: ["share"], security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: z.object({ shareCode: z.string(), userId: z.number().int().positive() }) } } } },
  responses: { 200: ok() },
});

// ── Notifications ──
registry.registerPath({ method: "get", path: "/api/notifications", tags: ["notifications"], request: { query: z.object({ userId: z.string().optional() }) }, responses: { 200: ok() } });
registry.registerPath({ method: "patch", path: "/api/notifications/mark-read", tags: ["notifications"], security: [{ bearerAuth: [] }], request: { body: { content: { "application/json": { schema: z.object({ userId: z.number().int().positive() }) } } } }, responses: { 200: ok() } });

// ── Lookups ──
registry.registerPath({ method: "get", path: "/api/expense-types", tags: ["lookups"], responses: { 200: ok() } });
registry.registerPath({ method: "get", path: "/api/preferences", tags: ["lookups"], responses: { 200: ok() } });

// ── Places (external proxy, rate-limited) ──
registry.registerPath({ method: "get", path: "/api/places/search", tags: ["places"], request: { query: z.object({ query: z.string(), language: z.string().optional() }) }, responses: { 200: ok() } });
registry.registerPath({ method: "get", path: "/api/places/details/{placeId}", tags: ["places"], request: { params: z.object({ placeId: z.string() }) }, responses: { 200: ok() } });
registry.registerPath({ method: "get", path: "/api/places/geocode", tags: ["places"], request: { query: z.object({ address: z.string() }) }, responses: { 200: ok() } });
registry.registerPath({ method: "get", path: "/api/places/directions", tags: ["places"], request: { query: z.object({ origin: z.string(), destination: z.string(), vehicle: z.string().optional() }) }, responses: { 200: ok() } });

// ── Admin / Health ──
registry.registerPath({ method: "get", path: "/api/admin/stats", tags: ["admin"], security: [{ bearerAuth: [] }], summary: "Admin dashboard stats.", responses: { 200: ok(), 401: { description: "Unauthorized" }, 403: { description: "Admin only" } } });
registry.registerPath({ method: "get", path: "/api/health", tags: ["health"], summary: "Readiness — pings the DB.", responses: { 200: ok("Healthy"), 503: { description: "Degraded" } } });
registry.registerPath({ method: "get", path: "/api/status", tags: ["health"], summary: "Liveness.", responses: { 200: ok() } });

export function getOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "PlanGo API",
      version: "1.0.0",
      description:
        "REST API for PlanGo — Vietnam travel planning with AI itinerary generation. Auth uses JWT Bearer tokens issued by `/api/auth/login`.",
    },
    servers: [{ url: "http://localhost:5001", description: "Local dev" }],
  });
}
