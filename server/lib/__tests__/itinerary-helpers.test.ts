import { describe, it, expect } from "vitest";
import {
  extractPlaceName,
  mapActivityTypeToExpenseId,
  mapExpenseIdToActivityType,
  mapToPreferenceNames,
} from "../itinerary-helpers";

describe("itinerary-helpers", () => {
  describe("extractPlaceName", () => {
    it("strips Vietnamese activity prefixes", () => {
      expect(extractPlaceName("Ăn sáng tại Bánh đa cua Bà Cụ")).toBe("Bánh đa cua Bà Cụ");
      expect(extractPlaceName("Tham quan Hoàng thành Thăng Long")).toBe("Hoàng thành Thăng Long");
    });

    it("returns trimmed original when no prefix matches", () => {
      expect(extractPlaceName("  Vịnh Hạ Long  ")).toBe("Vịnh Hạ Long");
    });
  });

  describe("mapActivityTypeToExpenseId / reverse", () => {
    it("maps food → 1 → food", () => {
      expect(mapActivityTypeToExpenseId("food")).toBe(1);
      expect(mapExpenseIdToActivityType(1)).toBe("food");
    });

    it("maps transport → 2 → transport", () => {
      expect(mapActivityTypeToExpenseId("transport")).toBe(2);
      expect(mapExpenseIdToActivityType(2)).toBe("transport");
    });

    it("returns null for missing input", () => {
      expect(mapActivityTypeToExpenseId(undefined)).toBeNull();
      expect(mapExpenseIdToActivityType(null)).toBeNull();
    });

    it("falls back to 'other' for unknown id", () => {
      expect(mapExpenseIdToActivityType(999)).toBe("other");
    });
  });

  describe("mapToPreferenceNames", () => {
    it("returns Ẩm thực for food type", () => {
      expect(mapToPreferenceNames("food")).toContain("Ẩm thực");
    });

    it("detects Biển from title text", () => {
      expect(mapToPreferenceNames("sightseeing", "Vịnh Hạ Long", undefined)).toContain("Biển");
    });

    it("deduplicates preferences", () => {
      const prefs = mapToPreferenceNames("sightseeing", "Văn miếu chùa", "lăng vua");
      const unique = new Set(prefs);
      expect(prefs.length).toBe(unique.size);
    });

    it("returns empty array for unknown input", () => {
      expect(mapToPreferenceNames(undefined, "abc", "xyz")).toEqual([]);
    });
  });
});
