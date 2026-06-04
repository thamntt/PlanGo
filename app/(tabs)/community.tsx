import React, { useState, useMemo, useRef } from "react";
import { useScrollToTop } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";
import { useBlogPosts, type BlogPost } from "@/hooks/queries/use-blog";
import { useForumThreads, type ForumThread } from "@/hooks/queries/use-forum";
import { useAuth } from "@/contexts/AuthContext";
import { FilterMenuSheet, type FilterMode } from "@/features/community/FilterMenuSheet";
import { SearchOverlay } from "@/features/community/SearchOverlay";
import { useTabBar } from "@/contexts/TabBarContext";

type Tab = "blog" | "forum";
type ThemeColors = ReturnType<typeof useThemeColors>;

const CAT_LABEL: Record<string, string> = {
  guide: "Hướng dẫn",
  review: "Review",
  food: "Ẩm thực",
  tips: "Mẹo hay",
  experience: "Trải nghiệm",
  question: "Câu hỏi",
  discussion: "Thảo luận",
  tip: "Mẹo",
  recommendation: "Gợi ý",
};
const CAT_COLOR: Record<string, string> = {
  guide: "#0891B2",
  review: "#10B981",
  food: "#F97316",
  tips: "#8B5CF6",
  experience: "#EC4899",
  question: "#3B82F6",
  discussion: "#A855F7",
  tip: "#10B981",
  recommendation: "#F59E0B",
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m}p`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ngày`;
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const tabBar = useTabBar();
  const [tab, setTab] = useState<Tab>("blog");
  const [search, setSearch] = useState("");
  const [sortBlog, setSortBlog] = useState<"latest" | "popular" | "trending">("latest");
  const [sortForum, setSortForum] = useState<"latest" | "popular" | "unanswered">("latest");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const blogFilters = {
    sort: sortBlog,
    search: search || undefined,
    category: filterCategory || undefined,
    followingOnly: filterMode === "following",
    likedOnly: filterMode === "liked",
    bookmarkedOnly: filterMode === "bookmarked",
  };
  const forumFilters = {
    sort: sortForum,
    search: search || undefined,
    category: filterCategory || undefined,
    followingOnly: filterMode === "following",
  };

  // 'liked' / 'bookmarked' do not apply to forum — hide forum tab content in that case
  const forumDisabledInMode = filterMode === "liked" || filterMode === "bookmarked";

  const blogQuery = useBlogPosts(blogFilters);
  const forumQuery = useForumThreads(forumFilters);

  const blogCats = ["guide", "review", "food", "tips", "experience"];
  const forumCats = ["question", "discussion", "tip", "recommendation"];
  const cats = tab === "blog" ? blogCats : forumCats;

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── HERO ─── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + webTopInset + 12 }]}
      >
        <View style={styles.heroTop}>
          <Pressable onPress={() => setMenuOpen(true)} style={styles.heroIcon} hitSlop={8}>
            <Ionicons name="menu" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Cộng đồng PlanGo</Text>
            <Text style={styles.heroSubtitle}>Chia sẻ kinh nghiệm — hỏi đáp du lịch</Text>
          </View>
          <Pressable onPress={() => setSearchOpen(true)} style={styles.heroAction} hitSlop={6}>
            <Ionicons name="search" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Tab switcher in hero */}
        <View style={[styles.tabRow, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
          {(
            [
              { key: "blog", label: "Blog", icon: "newspaper" },
              { key: "forum", label: "Diễn đàn", icon: "chatbubbles" },
            ] as const
          ).map((tabInfo) => {
            const isActive = tab === tabInfo.key;
            return (
              <Pressable
                key={tabInfo.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTab(tabInfo.key);
                  setFilterCategory(null);
                }}
                style={[styles.tabBtn, isActive && { backgroundColor: "#fff" }]}
              >
                <Ionicons
                  name={tabInfo.icon}
                  size={15}
                  color={isActive ? colors.primary : "#fff"}
                />
                <Text style={[styles.tabBtnText, { color: isActive ? colors.primary : "#fff" }]}>
                  {tabInfo.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>

      {/* ─── BODY ─── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        onScroll={tabBar.onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={tab === "blog" ? blogQuery.isRefetching : forumQuery.isRefetching}
            onRefresh={() => (tab === "blog" ? blogQuery.refetch() : forumQuery.refetch())}
            tintColor={colors.primary}
          />
        }
      >
        {/* Active filter banner */}
        {filterMode !== "all" && (
          <View
            style={[
              styles.filterBanner,
              { backgroundColor: colors.primary + "12", borderColor: colors.primary + "44" },
            ]}
          >
            <Ionicons name="funnel" size={13} color={colors.primary} />
            <Text style={[styles.filterBannerText, { color: colors.primary }]}>
              {filterMode === "following" && "Đang xem: Người bạn theo dõi"}
              {filterMode === "liked" && "Đang xem: Bài bạn đã thích"}
              {filterMode === "bookmarked" && "Đang xem: Bài đã lưu"}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setFilterMode("all")} hitSlop={4}>
              <Ionicons name="close-circle" size={16} color={colors.primary} />
            </Pressable>
          </View>
        )}

        {/* Active search banner */}
        {!!search && (
          <View
            style={[
              styles.searchBanner,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <Text style={[styles.searchBannerText, { color: colors.text }]} numberOfLines={1}>
              {search}
            </Text>
            <Pressable onPress={() => setSearch("")} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        )}

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <FilterChip
            label="Tất cả"
            icon="apps"
            active={!filterCategory}
            color={colors.primary}
            onPress={() => setFilterCategory(null)}
            colors={colors}
          />
          {cats.map((c) => (
            <FilterChip
              key={c}
              label={CAT_LABEL[c] || c}
              icon="pricetag"
              active={filterCategory === c}
              color={CAT_COLOR[c] || colors.primary}
              onPress={() => setFilterCategory(filterCategory === c ? null : c)}
              colors={colors}
            />
          ))}
        </ScrollView>

        {/* Sort chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {tab === "blog"
            ? (["latest", "popular", "trending"] as const).map((s) => (
                <SortChip
                  key={s}
                  label={s === "latest" ? "Mới nhất" : s === "popular" ? "Nhiều like" : "Trending"}
                  active={sortBlog === s}
                  onPress={() => setSortBlog(s)}
                  colors={colors}
                />
              ))
            : (["latest", "popular", "unanswered"] as const).map((s) => (
                <SortChip
                  key={s}
                  label={
                    s === "latest" ? "Mới nhất" : s === "popular" ? "Nhiều vote" : "Chưa trả lời"
                  }
                  active={sortForum === s}
                  onPress={() => setSortForum(s)}
                  colors={colors}
                />
              ))}
        </ScrollView>

        {/* List */}
        {tab === "blog" ? (
          <BlogList
            query={blogQuery}
            colors={colors}
            onOpen={(p) =>
              router.push({ pathname: "/community/blog/[id]", params: { id: String(p.postId) } })
            }
          />
        ) : forumDisabledInMode ? (
          <View style={{ paddingVertical: 50, alignItems: "center", paddingHorizontal: 24 }}>
            <Ionicons name="information-circle-outline" size={40} color={colors.textTertiary} />
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_700Bold",
                color: colors.text,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              Bộ lọc này chỉ dành cho Blog
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_400Regular",
                color: colors.textTertiary,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {filterMode === "liked" && "Forum không có chức năng like — chuyển về Blog để xem"}
              {filterMode === "bookmarked" && "Forum không có bookmark — chuyển về Blog để xem"}
            </Text>
            <Pressable
              onPress={() => setTab("blog")}
              style={{
                marginTop: 14,
                backgroundColor: colors.primary,
                paddingHorizontal: 18,
                paddingVertical: 9,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" }}>
                Chuyển sang Blog
              </Text>
            </Pressable>
          </View>
        ) : (
          <ForumList
            query={forumQuery}
            colors={colors}
            onOpen={(t) =>
              router.push({ pathname: "/community/forum/[id]", params: { id: String(t.threadId) } })
            }
          />
        )}
      </ScrollView>

      {/* Floating create button */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(tab === "blog" ? "/community/blog/create" : "/community/forum/create");
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: insets.bottom + 90,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons
            name={tab === "blog" ? "create" : "chatbubble-ellipses"}
            size={20}
            color="#fff"
          />
          <Text style={styles.fabText}>{tab === "blog" ? "Đăng bài" : "Hỏi đáp"}</Text>
        </LinearGradient>
      </Pressable>

      <FilterMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        current={filterMode}
        onSelect={(m) => setFilterMode(m)}
        isLoggedIn={!!user}
      />

      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSubmit={(q) => setSearch(q)}
        placeholder={tab === "blog" ? "Tìm bài viết, tác giả, địa danh..." : "Tìm câu hỏi..."}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

function FilterChip({
  label,
  icon,
  active,
  color,
  onPress,
  colors,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  color: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? color : colors.card,
          borderColor: active ? color : colors.cardBorder,
        },
      ]}
    >
      <Ionicons name={icon} size={12} color={active ? "#fff" : color} />
      <Text style={[styles.chipText, { color: active ? "#fff" : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function SortChip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.sortChip,
        {
          backgroundColor: active ? colors.primary + "1A" : "transparent",
          borderColor: active ? colors.primary : colors.cardBorder,
        },
      ]}
    >
      <Text
        style={[styles.sortChipText, { color: active ? colors.primary : colors.textSecondary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BlogList({
  query,
  colors,
  onOpen,
}: {
  query: ReturnType<typeof useBlogPosts>;
  colors: ThemeColors;
  onOpen: (p: BlogPost) => void;
}) {
  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  const posts = query.data || [];
  if (posts.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialCommunityIcons
          name="newspaper-variant-outline"
          size={40}
          color={colors.textTertiary}
        />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Chưa có bài viết</Text>
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
          Hãy là người đầu tiên chia sẻ trải nghiệm của bạn
        </Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      {posts.map((p) => (
        <BlogPostCard key={p.postId} post={p} colors={colors} onPress={() => onOpen(p)} />
      ))}
    </View>
  );
}

function BlogPostCard({
  post,
  colors,
  onPress,
}: {
  post: BlogPost;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const catColor = CAT_COLOR[post.category || ""] || colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.blogCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {post.coverImage && (
        <View>
          <Image source={{ uri: post.coverImage }} style={styles.blogCover} contentFit="cover" />
          {post.category && (
            <View style={[styles.blogCatBadge, { backgroundColor: catColor }]}>
              <Text style={styles.blogCatBadgeText}>
                {CAT_LABEL[post.category] || post.category}
              </Text>
            </View>
          )}
        </View>
      )}
      <View style={styles.blogBody}>
        <Text style={[styles.blogTitle, { color: colors.text }]} numberOfLines={2}>
          {post.title}
        </Text>
        {post.excerpt && (
          <Text style={[styles.blogExcerpt, { color: colors.textSecondary }]} numberOfLines={2}>
            {post.excerpt}
          </Text>
        )}
        {post.destinationsList.length > 0 && (
          <View style={styles.destRow}>
            <Ionicons name="location" size={11} color={colors.textTertiary} />
            <Text style={[styles.destText, { color: colors.textTertiary }]} numberOfLines={1}>
              {post.destinationsList.map((d) => d.name).join(" · ")}
            </Text>
          </View>
        )}
        <View style={styles.blogMeta}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              router.push({ pathname: "/user/[id]", params: { id: String(post.authorId) } });
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            hitSlop={4}
          >
            {post.authorAvatar ? (
              <Image
                source={{ uri: post.authorAvatar }}
                style={styles.metaAvatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.metaAvatar,
                  {
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>
                  {post.authorName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.metaText, { color: colors.text }]} numberOfLines={1}>
              {post.authorName}
            </Text>
          </Pressable>
          <Text style={[styles.metaDot, { color: colors.textTertiary }]}>·</Text>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {timeAgo(post.publishedAt)}
          </Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="time-outline" size={11} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>{post.readMinutes}p</Text>
        </View>
        <View style={styles.statsRow}>
          <Stat
            icon="heart"
            value={post.likeCount}
            color={post.isLikedByViewer ? "#EF4444" : colors.textTertiary}
            colors={colors}
          />
          <Stat
            icon="chatbubble-ellipses"
            value={post.commentCount}
            color={colors.textTertiary}
            colors={colors}
          />
          <Stat icon="eye" value={post.viewCount} color={colors.textTertiary} colors={colors} />
          <View style={{ flex: 1 }} />
          {post.isBookmarkedByViewer && (
            <Ionicons name="bookmark" size={13} color={colors.primary} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ForumList({
  query,
  colors,
  onOpen,
}: {
  query: ReturnType<typeof useForumThreads>;
  colors: ThemeColors;
  onOpen: (t: ForumThread) => void;
}) {
  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  const threads = query.data || [];
  if (threads.length === 0) {
    return (
      <View style={styles.empty}>
        <MaterialCommunityIcons name="forum-outline" size={40} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Chưa có câu hỏi</Text>
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
          Hãy là người đầu tiên đặt câu hỏi cho cộng đồng
        </Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {threads.map((t) => (
        <ForumThreadCard key={t.threadId} thread={t} colors={colors} onPress={() => onOpen(t)} />
      ))}
    </View>
  );
}

function ForumThreadCard({
  thread,
  colors,
  onPress,
}: {
  thread: ForumThread;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const catColor = CAT_COLOR[thread.category || ""] || colors.primary;
  const isSolved = thread.status === "solved";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.threadCard,
        {
          backgroundColor: colors.card,
          borderColor: isSolved ? "#10B981" + "40" : colors.cardBorder,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      <View style={styles.threadHeader}>
        {thread.category && (
          <View style={[styles.threadCatChip, { backgroundColor: catColor + "1A" }]}>
            <Text style={[styles.threadCatText, { color: catColor }]}>
              {CAT_LABEL[thread.category] || thread.category}
            </Text>
          </View>
        )}
        {thread.destinationName && (
          <View style={[styles.threadCatChip, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="location" size={9} color={colors.textSecondary} />
            <Text style={[styles.threadCatText, { color: colors.textSecondary }]}>
              {thread.destinationName}
            </Text>
          </View>
        )}
        {isSolved && (
          <View style={[styles.threadCatChip, { backgroundColor: "#10B981" }]}>
            <Ionicons name="checkmark-circle" size={9} color="#fff" />
            <Text style={[styles.threadCatText, { color: "#fff" }]}>Đã giải đáp</Text>
          </View>
        )}
      </View>
      <Text style={[styles.threadTitle, { color: colors.text }]} numberOfLines={2}>
        {thread.title}
      </Text>
      <Text style={[styles.threadBody, { color: colors.textSecondary }]} numberOfLines={2}>
        {thread.body}
      </Text>
      <View style={styles.threadFooter}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            router.push({ pathname: "/user/[id]", params: { id: String(thread.authorId) } });
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          hitSlop={4}
        >
          {thread.authorAvatar ? (
            <Image
              source={{ uri: thread.authorAvatar }}
              style={styles.metaAvatar}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.metaAvatar,
                { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
              ]}
            >
              <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>
                {thread.authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.metaText, { color: colors.text }]} numberOfLines={1}>
            {thread.authorName}
          </Text>
        </Pressable>
        <Text style={[styles.metaDot, { color: colors.textTertiary }]}>·</Text>
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
          {timeAgo(thread.createdAt)}
        </Text>
        <View style={{ flex: 1 }} />
        <Stat icon="arrow-up" value={thread.upvotes} color={colors.textTertiary} colors={colors} />
        <Stat
          icon="chatbubble-outline"
          value={thread.replyCount}
          color={colors.textTertiary}
          colors={colors}
        />
      </View>
    </Pressable>
  );
}

function Stat({
  icon,
  value,
  color,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  color: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.statText, { color: color }]}>{value}</Text>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  heroSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },

  tabRow: { flexDirection: "row", padding: 4, borderRadius: 14, gap: 4 },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Search
  searchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
  },
  searchBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
  },
  filterBannerText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },

  // Chips
  chipsRow: { paddingHorizontal: 16, gap: 6, paddingVertical: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  sortRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  sortChipText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Blog card
  blogCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  blogCover: { width: "100%", height: 160 },
  blogCatBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  blogCatBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  blogBody: { padding: 14, gap: 6 },
  blogTitle: { fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 20 },
  blogExcerpt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  destRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  destText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  blogMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  metaAvatar: { width: 22, height: 22, borderRadius: 11 },
  metaText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaDot: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Thread card
  threadCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  threadHeader: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  threadCatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  threadCatText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  threadTitle: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 19, marginTop: 2 },
  threadBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  threadFooter: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },

  // States
  loading: { paddingVertical: 60, alignItems: "center" },
  empty: { paddingVertical: 60, alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 12 },
  emptySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" },

  // FAB
  fab: {
    position: "absolute",
    right: 16,
    borderRadius: 28,
    shadowColor: "#0891B2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 28,
  },
  fabText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
