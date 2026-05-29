import { describe, it, expect } from "vitest";
import {
  createTripInputSchema,
  updateTripInputSchema,
  listTripsQuerySchema,
} from "../schema";

describe("trips/schema", () => {
  describe("createTripInputSchema", () => {
    it("accepts a minimal valid input", () => {
      const result = createTripInputSchema.safeParse({
        title: "Hà Nội",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const result = createTripInputSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.flatten().fieldErrors;
        expect(fields.title).toBeDefined();
        expect(fields.startDate).toBeDefined();
        expect(fields.endDate).toBeDefined();
      }
    });

    it("coerces numeric strings for positive ints", () => {
      const result = createTripInputSchema.safeParse({
        title: "X",
        startDate: "2026-06-01",
        endDate: "2026-06-02",
        ownerId: "42",
        numPeople: "3",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ownerId).toBe(42);
        expect(result.data.numPeople).toBe(3);
      }
    });
  });

  describe("updateTripInputSchema", () => {
    it("accepts a partial update", () => {
      const result = updateTripInputSchema.safeParse({ status: "completed" });
      expect(result.success).toBe(true);
    });

    it("accepts nested expenses array", () => {
      const result = updateTripInputSchema.safeParse({
        expenses: [{ title: "Ăn trưa", amount: 100000 }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("listTripsQuerySchema", () => {
    it("transforms ownerId string into number", () => {
      const result = listTripsQuerySchema.safeParse({ ownerId: "7" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.ownerId).toBe(7);
    });

    it("allows empty query", () => {
      expect(listTripsQuerySchema.safeParse({}).success).toBe(true);
    });
  });
});
