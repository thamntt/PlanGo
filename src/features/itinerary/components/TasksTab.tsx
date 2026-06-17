import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { TripTask } from "@/types";

type ThemeColors = {
  primary: string;
  accent: string;
  error: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
};

type FilterKey = "all" | "open" | "done";

const CAT_LABEL: Record<string, string> = {
  prep: "Chuẩn bị",
  during: "Trong chuyến",
  after: "Sau chuyến",
};

const CAT_COLOR: Record<string, string> = {
  prep: "#3B82F6",
  during: "#10B981",
  after: "#F59E0B",
};

const AVATAR_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

function hashColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type DueBucket =
  | "overdue"
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "later"
  | "noDate"
  | "done";

const BUCKET_META: Record<
  DueBucket,
  { label: string; icon: keyof typeof Ionicons.glyphMap; accent: string }
> = {
  overdue: { label: "Quá hạn", icon: "alert-circle", accent: "#EF4444" },
  today: { label: "Hôm nay", icon: "today", accent: "#F97316" },
  tomorrow: { label: "Ngày mai", icon: "sunny", accent: "#F59E0B" },
  thisWeek: { label: "Tuần này", icon: "calendar", accent: "#3B82F6" },
  later: { label: "Sau này", icon: "calendar-outline", accent: "#8B5CF6" },
  noDate: { label: "Không có hạn", icon: "infinite", accent: "#94A3B8" },
  done: { label: "Đã xong", icon: "checkmark-done-circle", accent: "#10B981" },
};

function bucketize(task: TripTask): DueBucket {
  if (task.isCompleted) return "done";
  if (!task.dueDate) return "noDate";
  const due = new Date(task.dueDate);
  if (isNaN(due.getTime())) return "noDate";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "thisWeek";
  return "later";
}

function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - now.getTime()) / 86_400_000);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff === -1) return "Hôm qua";
  if (diff > 1 && diff < 7) return `Còn ${diff} ngày`;
  if (diff < -1 && diff > -7) return `Trễ ${-diff} ngày`;
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Animated circular checkbox — Things 3 / Todoist style. Single Animated.View
 * with a scale + opacity transition between unchecked (empty circle) and
 * checked (filled with tick). Tap target stays at 36×36 even though the
 * visible circle is 22 — minimum touch target.
 */
function CheckCircle({
  checked,
  accent,
  onToggle,
}: {
  checked: boolean;
  accent: string;
  onToggle: () => void;
}) {
  const anim = React.useRef(new Animated.Value(checked ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: checked ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [checked, anim]);
  return (
    <Pressable onPress={onToggle} hitSlop={8} style={styles.checkTouch}>
      <View style={[styles.checkCircle, { borderColor: accent }]}>
        <Animated.View
          style={[
            styles.checkFill,
            {
              backgroundColor: accent,
              opacity: anim,
              transform: [
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 1],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={{
            position: "absolute",
            opacity: anim,
            transform: [
              {
                scale: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
            ],
          }}
        >
          <Ionicons name="checkmark" size={14} color="#fff" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

/**
 * Tasks tab body — Todoist/Things 3-style with smart sections grouped by
 * due date (Overdue → Today → Tomorrow → This week → Later → No date →
 * Done). Quick-add input at the top adds a task in one keystroke without
 * opening the full modal. Tap a row to open the edit modal; tap the
 * checkbox to flip done state.
 */
export function TasksTab({
  tasks,
  isLoading,
  filter,
  setFilter,
  colors,
  canEdit,
  tripMembers,
  openCreate,
  openEdit,
  toggleComplete,
  onDelete,
  onClearCompleted,
}: {
  tasks: TripTask[];
  isLoading: boolean;
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  colors: ThemeColors;
  canEdit: boolean;
  tripMembers: { userId: string; userName: string; avatarUrl?: string | null }[];
  openCreate: () => void;
  openEdit: (task: TripTask) => void;
  toggleComplete: (task: TripTask) => void;
  onDelete: (task: TripTask) => void;
  onClearCompleted: () => void;
}) {
  const [showDone, setShowDone] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "open") return tasks.filter((t) => !t.isCompleted);
    if (filter === "done") return tasks.filter((t) => t.isCompleted);
    return tasks;
  }, [tasks, filter]);

  const buckets = useMemo(() => {
    const order: DueBucket[] = [
      "overdue",
      "today",
      "tomorrow",
      "thisWeek",
      "later",
      "noDate",
      "done",
    ];
    const map = new Map<DueBucket, TripTask[]>();
    for (const b of order) map.set(b, []);
    for (const t of filtered) map.get(bucketize(t))?.push(t);
    // Inside each bucket sort by orderIndex then createdAt for stable order.
    for (const [b, arr] of map.entries()) {
      arr.sort((a, b) => a.orderIndex - b.orderIndex);
      map.set(b, arr);
    }
    return order
      .map((b) => ({ key: b, meta: BUCKET_META[b], items: map.get(b) || [] }))
      .filter((s) => s.items.length > 0);
  }, [filtered]);

  const counts = useMemo(() => {
    const open = tasks.filter((t) => !t.isCompleted).length;
    const done = tasks.filter((t) => t.isCompleted).length;
    return { all: tasks.length, open, done };
  }, [tasks]);

  const renderTask = (task: TripTask, sectionAccent: string) => {
    const assignee = task.assigneeUserId
      ? tripMembers.find((m) => m.userId === task.assigneeUserId)
      : null;
    const due = formatDueDate(task.dueDate);
    const bucket = bucketize(task);
    const isOverdue = bucket === "overdue";

    return (
      <Pressable
        key={task.id}
        onPress={() => canEdit && openEdit(task)}
        onLongPress={() => canEdit && onDelete(task)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? colors.inputBg : colors.card,
            borderColor: colors.cardBorder,
            borderLeftColor: sectionAccent,
            borderLeftWidth: 3,
          },
        ]}
      >
        <CheckCircle
          checked={task.isCompleted}
          accent={task.isCompleted ? "#10B981" : sectionAccent}
          onToggle={() => canEdit && toggleComplete(task)}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={[
              styles.title,
              {
                color: task.isCompleted ? colors.textTertiary : colors.text,
                textDecorationLine: task.isCompleted ? "line-through" : "none",
              },
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {task.description ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
          {(assignee || due || task.category) && (
            <View style={styles.metaRow}>
              {task.category && (
                <View
                  style={[
                    styles.catChip,
                    { backgroundColor: (CAT_COLOR[task.category] || "#94A3B8") + "18" },
                  ]}
                >
                  <View
                    style={[
                      styles.catDot,
                      { backgroundColor: CAT_COLOR[task.category] || "#94A3B8" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.catText,
                      { color: CAT_COLOR[task.category] || colors.textSecondary },
                    ]}
                  >
                    {CAT_LABEL[task.category] || task.category}
                  </Text>
                </View>
              )}
              {due && (
                <View
                  style={[
                    styles.dueChip,
                    {
                      backgroundColor: isOverdue
                        ? colors.error + "18"
                        : colors.inputBg,
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={11}
                    color={isOverdue ? colors.error : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.dueText,
                      { color: isOverdue ? colors.error : colors.textSecondary },
                    ]}
                  >
                    {due}
                  </Text>
                </View>
              )}
              {assignee && (
                <View style={styles.assigneeChip}>
                  {assignee.avatarUrl ? (
                    <Image
                      source={{ uri: assignee.avatarUrl }}
                      style={styles.assigneeAvatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.assigneeAvatar,
                        { backgroundColor: hashColor(assignee.userId) },
                      ]}
                    >
                      <Text style={styles.assigneeInitial}>
                        {(assignee.userName || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[styles.assigneeText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {assignee.userName.split(" ").slice(-1)[0]}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Filter — 3 simple chips like TickTick */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {(
          [
            { key: "all" as FilterKey, label: "Tất cả", count: counts.all },
            { key: "open" as FilterKey, label: "Chưa xong", count: counts.open },
            { key: "done" as FilterKey, label: "Đã xong", count: counts.done },
          ] as const
        ).map((c) => {
          const active = filter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.inputBg,
                  borderColor: active ? colors.primary : colors.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? "#fff" : colors.textSecondary },
                ]}
              >
                {c.label}
                {c.count > 0 ? ` · ${c.count}` : ""}
              </Text>
            </Pressable>
          );
        })}
        {counts.done > 0 && canEdit && (
          <Pressable
            onPress={onClearCompleted}
            style={[styles.clearBtn, { borderColor: colors.cardBorder }]}
          >
            <Ionicons name="trash-bin-outline" size={12} color={colors.error} />
            <Text style={[styles.clearBtnText, { color: colors.error }]}>
              Dọn đã xong
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {isLoading ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>Đang tải...</Text>
      ) : filtered.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.inputBg }]}>
          <Ionicons name="sparkles-outline" size={42} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Mọi việc đã xong!
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Nhấn nút + ở góc dưới phải để thêm việc cần chuẩn bị, đặt vé, gọi điện…
          </Text>
        </View>
      ) : (
        buckets.map((section) => {
          const isDoneSection = section.key === "done";
          const collapsed = isDoneSection && !showDone;
          return (
            <View key={section.key} style={{ gap: 6 }}>
              <Pressable
                onPress={() => {
                  if (isDoneSection) setShowDone((v) => !v);
                }}
                style={styles.sectionHeader}
              >
                <Ionicons
                  name={section.meta.icon}
                  size={14}
                  color={section.meta.accent}
                />
                <Text
                  style={[styles.sectionHeaderText, { color: section.meta.accent }]}
                >
                  {section.meta.label.toUpperCase()} · {section.items.length}
                </Text>
                {isDoneSection && (
                  <Ionicons
                    name={collapsed ? "chevron-down" : "chevron-up"}
                    size={14}
                    color={section.meta.accent}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </Pressable>
              {!collapsed && (
                <View style={{ gap: 6 }}>
                  {section.items.map((t) => renderTask(t, section.meta.accent))}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Filter chips
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  clearBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Section headers (like Things 3 chapter titles)
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingVertical: 4,
    paddingRight: 4,
  },
  sectionHeaderText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },

  // Task row
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Animated checkbox
  checkTouch: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -7,
    marginLeft: -8,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  checkFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 11,
  },

  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 19 },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  dueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dueText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  assigneeChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  assigneeAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  assigneeInitial: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  assigneeText: { fontSize: 10, fontFamily: "Inter_500Medium", maxWidth: 80 },

  // Empty
  empty: { fontSize: 13, textAlign: "center", paddingVertical: 24 },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
