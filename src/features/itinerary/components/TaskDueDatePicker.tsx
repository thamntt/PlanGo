import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Build a 6×7 grid of day cells for the given month. Pads with previous /
 * next month days so every row is full — matches the Todoist / Apple Calendar
 * layout users expect.
 */
function buildMonthGrid(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(year, month);
  const firstDow = first.getDay(); // 0=CN..6=T7
  const total = daysInMonth(year, month);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) {
    const d = new Date(year, month, 1 - (firstDow - i));
    cells.push({ date: d, inMonth: false });
  }
  for (let d = 1; d <= total; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inMonth: false,
    });
  }
  return cells;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  // yyyy-mm-ddTHH:mm:00 — keep local timezone semantics (don't shift to UTC)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:00`;
}

function formatPretty(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  let dayPart = "";
  if (diff === 0) dayPart = "Hôm nay";
  else if (diff === 1) dayPart = "Ngày mai";
  else if (diff === -1) dayPart = "Hôm qua";
  else if (diff > 1 && diff < 7) dayPart = `Còn ${diff} ngày`;
  else if (diff < -1 && diff > -7) dayPart = `Trễ ${-diff} ngày`;
  else dayPart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `${dayPart} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Date + time picker built from primitives (no native module needed). Matches
 * the UX of Todoist / TickTick / Apple Reminders:
 *   1. Trigger row showing the current selection (or placeholder).
 *   2. Quick-pick chips for the most common targets.
 *   3. Inline month grid with prev/next arrows.
 *   4. Time row with hour + minute steppers.
 *
 * Stores back to the parent as an ISO-ish string (`yyyy-mm-ddTHH:mm:00`) so
 * the server can `new Date(...)` directly.
 */
export function TaskDueDatePicker({
  value,
  onChange,
  colors,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  colors: ThemeColors;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);

  // Calendar cursor (which month is shown). Defaults to the month of the
  // current value, or the current month if no value.
  const [viewYear, setViewYear] = useState(
    (selected || new Date()).getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    (selected || new Date()).getMonth(),
  );

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const today = new Date();

  const commitDayOnly = (d: Date) => {
    // Preserve current hour/minute when picking a new date.
    const hour = selected ? selected.getHours() : 9;
    const minute = selected ? selected.getMinutes() : 0;
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
    onChange(toISO(next));
  };

  // Time popup state — clock icon trigger opens this overlay with hour +
  // minute text inputs and a SA/CH (AM/PM) toggle. Mimics the lightweight
  // pickers in Google Calendar / Things 3 mobile.
  const [timePopup, setTimePopup] = useState(false);
  const [popupHour, setPopupHour] = useState<string>("");
  const [popupMin, setPopupMin] = useState<string>("");
  const [popupAmPm, setPopupAmPm] = useState<"AM" | "PM">("AM");

  const openTimePopup = () => {
    const base = selected || new Date();
    const h24 = base.getHours();
    const isPm = h24 >= 12;
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    setPopupHour(pad(h12));
    setPopupMin(pad(base.getMinutes()));
    setPopupAmPm(isPm ? "PM" : "AM");
    setTimePopup(true);
  };

  const commitTimePopup = () => {
    let h = parseInt(popupHour.replace(/\D/g, ""), 10);
    let m = parseInt(popupMin.replace(/\D/g, ""), 10);
    if (isNaN(h) || h < 1 || h > 12) h = 12;
    if (isNaN(m) || m < 0 || m > 59) m = 0;
    let h24 = h % 12;
    if (popupAmPm === "PM") h24 += 12;
    const base = selected || new Date();
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      h24,
      m,
    );
    onChange(toISO(next));
    setTimePopup(false);
  };

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.inputBg,
            borderColor: open ? colors.primary : colors.cardBorder,
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={selected ? colors.primary : colors.textTertiary}
        />
        <Text
          style={[
            styles.triggerText,
            { color: selected ? colors.text : colors.textSecondary },
          ]}
        >
          {selected ? formatPretty(selected) : "Chưa có hạn"}
        </Text>
        {selected && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            hitSlop={6}
            style={{ padding: 2 }}
          >
            <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {/* Month header */}
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => {
                let nextMonth = viewMonth - 1;
                let nextYear = viewYear;
                if (nextMonth < 0) {
                  nextMonth = 11;
                  nextYear -= 1;
                }
                setViewMonth(nextMonth);
                setViewYear(nextYear);
              }}
              hitSlop={8}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.text }]}>
              Tháng {viewMonth + 1}, {viewYear}
            </Text>
            <Pressable
              onPress={() => {
                let nextMonth = viewMonth + 1;
                let nextYear = viewYear;
                if (nextMonth > 11) {
                  nextMonth = 0;
                  nextYear += 1;
                }
                setViewMonth(nextMonth);
                setViewYear(nextYear);
              }}
              hitSlop={8}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Weekday strip */}
          <View style={styles.weekStrip}>
            {WEEKDAYS.map((w) => (
              <Text
                key={w}
                style={[styles.weekday, { color: colors.textTertiary }]}
              >
                {w}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {grid.map((cell, idx) => {
              const isToday = sameDay(cell.date, today);
              const isSelected = selected ? sameDay(cell.date, selected) : false;
              return (
                <Pressable
                  key={idx}
                  onPress={() => commitDayOnly(cell.date)}
                  style={[
                    styles.day,
                    isSelected && {
                      backgroundColor: colors.primary,
                    },
                    !isSelected && isToday && {
                      borderWidth: 1,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isSelected
                          ? "#fff"
                          : cell.inMonth
                            ? isToday
                              ? colors.primary
                              : colors.text
                            : colors.textTertiary,
                        fontFamily: isSelected || isToday
                          ? "Inter_700Bold"
                          : "Inter_500Medium",
                      },
                    ]}
                  >
                    {cell.date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Time trigger — clock icon + formatted time, opens a popup picker */}
          <Pressable
            onPress={openTimePopup}
            style={[
              styles.timeTrigger,
              { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
            ]}
          >
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
              Giờ
            </Text>
            <Text style={[styles.timeTriggerValue, { color: colors.text }]}>
              {selected
                ? (() => {
                    const h24 = selected.getHours();
                    const isPm = h24 >= 12;
                    let h12 = h24 % 12;
                    if (h12 === 0) h12 = 12;
                    return `${pad(h12)}:${pad(selected.getMinutes())} ${
                      isPm ? "CH" : "SA"
                    }`;
                  })()
                : "09:00 SA"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      <ClockTimePopup
        visible={timePopup}
        hour={popupHour}
        minute={popupMin}
        ampm={popupAmPm}
        setHour={setPopupHour}
        setMinute={setPopupMin}
        setAmPm={setPopupAmPm}
        onCancel={() => setTimePopup(false)}
        onCommit={commitTimePopup}
        colors={colors}
      />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Clock-face time popup — tap a number on the dial to pick the value. Two
// modes (Giờ / Phút); selecting an hour auto-switches to minute mode the
// way Android Material time pickers do. The text inputs stay below as an
// alternative for users who'd rather type.
// ──────────────────────────────────────────────────────────────────────────

function ClockTimePopup({
  visible,
  hour,
  minute,
  ampm,
  setHour,
  setMinute,
  setAmPm,
  onCancel,
  onCommit,
  colors,
}: {
  visible: boolean;
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
  setHour: (v: string) => void;
  setMinute: (v: string) => void;
  setAmPm: (v: "AM" | "PM") => void;
  onCancel: () => void;
  onCommit: () => void;
  colors: ThemeColors;
}) {
  const [mode, setMode] = React.useState<"hour" | "minute">("hour");

  React.useEffect(() => {
    if (visible) setMode("hour");
  }, [visible]);

  const SIZE = 260;
  const RADIUS = SIZE / 2 - 26;
  const CENTER = SIZE / 2;

  const hourNum = (() => {
    const n = parseInt(hour.replace(/\D/g, ""), 10);
    if (isNaN(n) || n < 1 || n > 12) return 12;
    return n;
  })();
  const minNum = (() => {
    const n = parseInt(minute.replace(/\D/g, ""), 10);
    if (isNaN(n) || n < 0 || n > 59) return 0;
    return n;
  })();

  // 12 positions for hour (1..12); 12 positions for minute (0,5,10,..55).
  const positions = Array.from({ length: 12 }, (_, idx) => {
    const angle = ((idx + 1) * 30 - 90) * (Math.PI / 180); // 12 at top
    const x = CENTER + RADIUS * Math.cos(angle);
    const y = CENTER + RADIUS * Math.sin(angle);
    const label = mode === "hour" ? `${idx + 1}` : `${((idx + 1) % 12) * 5}`;
    const value = mode === "hour" ? idx + 1 : ((idx + 1) % 12) * 5;
    const active =
      mode === "hour" ? hourNum === value : minNum === value;
    return { x, y, label, value, active };
  });

  // Active hand angle (in degrees, 0 = 12 o'clock, clockwise).
  const handAngle =
    mode === "hour"
      ? hourNum * 30
      : (minNum / 5) * 30;

  // End-of-hand coords.
  const handLen = RADIUS - 6;
  const handRad = ((handAngle - 90) * Math.PI) / 180;
  const handX = CENTER + handLen * Math.cos(handRad);
  const handY = CENTER + handLen * Math.sin(handRad);

  // Compute hand line length+rotation as a rectangle div for RN.
  const handDx = handX - CENTER;
  const handDy = handY - CENTER;
  const handLineLen = Math.hypot(handDx, handDy);
  const handLineDeg = (Math.atan2(handDy, handDx) * 180) / Math.PI;

  const setFromValue = (v: number) => {
    if (mode === "hour") {
      setHour(v.toString().padStart(2, "0"));
      setMode("minute");
    } else {
      setMinute(v.toString().padStart(2, "0"));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,23,42,0.55)",
          justifyContent: "center",
          alignItems: "center",
          padding: 22,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.timePopup,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={[styles.timePopupTitle, { color: colors.text }]}>
              Chọn giờ
            </Text>
          </View>

          {/* Big tappable time display — tap segment to switch mode. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginBottom: 10,
            }}
          >
            <Pressable onPress={() => setMode("hour")}>
              <Text
                style={[
                  styles.bigTime,
                  {
                    color: mode === "hour" ? colors.primary : colors.text,
                  },
                ]}
              >
                {hour.padStart(2, "0") || "12"}
              </Text>
            </Pressable>
            <Text style={[styles.bigTime, { color: colors.text }]}>:</Text>
            <Pressable onPress={() => setMode("minute")}>
              <Text
                style={[
                  styles.bigTime,
                  {
                    color: mode === "minute" ? colors.primary : colors.text,
                  },
                ]}
              >
                {minute.padStart(2, "0") || "00"}
              </Text>
            </Pressable>
            <View
              style={[
                styles.amPmToggle,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                  marginLeft: 8,
                  flexDirection: "row",
                },
              ]}
            >
              <Pressable
                onPress={() => setAmPm("AM")}
                style={[
                  styles.amPmBtn,
                  ampm === "AM" && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.amPmText,
                    { color: ampm === "AM" ? "#fff" : colors.textSecondary },
                  ]}
                >
                  SA
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAmPm("PM")}
                style={[
                  styles.amPmBtn,
                  ampm === "PM" && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.amPmText,
                    { color: ampm === "PM" ? "#fff" : colors.textSecondary },
                  ]}
                >
                  CH
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Clock face */}
          <View
            style={{
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE / 2,
              backgroundColor: colors.inputBg,
              alignSelf: "center",
              position: "relative",
            }}
          >
            {/* Hand line */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: CENTER,
                top: CENTER - 1.5,
                width: handLineLen,
                height: 3,
                backgroundColor: colors.primary,
                transform: [{ translateY: 0 }, { rotate: `${handLineDeg}deg` }],
                transformOrigin: "0% 50%",
                borderRadius: 2,
              }}
            />
            {/* Center dot */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: CENTER - 5,
                top: CENTER - 5,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.primary,
              }}
            />
            {/* Tip dot on selected number */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: handX - 16,
                top: handY - 16,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.primary + "30",
              }}
            />
            {/* Numbers */}
            {positions.map((p) => (
              <Pressable
                key={`${mode}-${p.value}`}
                onPress={() => setFromValue(p.value)}
                style={{
                  position: "absolute",
                  left: p.x - 18,
                  top: p.y - 18,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: p.active ? colors.primary : "transparent",
                }}
              >
                <Text
                  style={{
                    color: p.active ? "#fff" : colors.text,
                    fontSize: 14,
                    fontFamily: "Inter_700Bold",
                  }}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Text inputs as alternative — for users who prefer typing. */}
          <View style={[styles.timePopupRow, { marginTop: 14 }]}>
            <TextInput
              value={hour}
              onChangeText={(v) => setHour(v.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="HH"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.timePopupInputSmall,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                },
              ]}
            />
            <Text style={[styles.timePopupColon, { color: colors.text }]}>:</Text>
            <TextInput
              value={minute}
              onChangeText={(v) => setMinute(v.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="MM"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.timePopupInputSmall,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
                },
              ]}
            />
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_500Medium",
                color: colors.textTertiary,
                marginLeft: 6,
                flex: 1,
              }}
            >
              hoặc gõ thẳng
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 18,
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              onPress={onCancel}
              style={[styles.timePopupBtn, { backgroundColor: colors.inputBg }]}
            >
              <Text style={[styles.timePopupBtnText, { color: colors.text }]}>
                Huỷ
              </Text>
            </Pressable>
            <Pressable
              onPress={onCommit}
              style={[styles.timePopupBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.timePopupBtnText, { color: "#fff" }]}>
                Xong
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  triggerText: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  panel: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  monthArrow: { padding: 6, borderRadius: 8 },
  monthLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  weekStrip: { flexDirection: "row" },
  weekday: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  dayText: { fontSize: 13 },
  timeTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  timeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  timeTriggerValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },

  // Time popup
  timePopup: {
    width: "100%",
    maxWidth: 360,
    padding: 20,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timePopupTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  timePopupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  timePopupInput: {
    width: 64,
    height: 56,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  timePopupInputSmall: {
    width: 56,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  bigTime: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  timePopupColon: { fontSize: 22, fontFamily: "Inter_700Bold" },
  amPmToggle: {
    flexDirection: "column",
    marginLeft: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  amPmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  amPmText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  timePopupBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  timePopupBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
