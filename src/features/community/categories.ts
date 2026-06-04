import type { Ionicons } from "@expo/vector-icons";

type IoniconName = keyof typeof Ionicons.glyphMap;

export interface CategoryMeta {
  label: string;
  color: string;
  icon: IoniconName;
}

export const BLOG_CATEGORIES: Record<string, CategoryMeta> = {
  guide: { label: "Hướng dẫn", color: "#0891B2", icon: "book" },
  review: { label: "Review", color: "#10B981", icon: "star" },
  food: { label: "Ẩm thực", color: "#F97316", icon: "restaurant" },
  tips: { label: "Mẹo hay", color: "#8B5CF6", icon: "bulb" },
  tip: { label: "Mẹo hay", color: "#8B5CF6", icon: "bulb" },
  experience: { label: "Trải nghiệm", color: "#EC4899", icon: "compass" },
  story: { label: "Trải nghiệm", color: "#EC4899", icon: "compass" },
};

export const FORUM_CATEGORIES: Record<string, CategoryMeta> = {
  question: { label: "Câu hỏi", color: "#3B82F6", icon: "help-circle" },
  discussion: { label: "Thảo luận", color: "#A855F7", icon: "chatbubbles" },
  tip: { label: "Mẹo", color: "#10B981", icon: "bulb" },
  recommendation: { label: "Gợi ý", color: "#F59E0B", icon: "sparkles" },
};

export function getBlogCategory(key?: string | null): CategoryMeta | null {
  if (!key) return null;
  return BLOG_CATEGORIES[key] || null;
}

export function getForumCategory(key?: string | null): CategoryMeta | null {
  if (!key) return null;
  return FORUM_CATEGORIES[key] || null;
}
