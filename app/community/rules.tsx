import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSettings } from "@/contexts/SettingsContext";
import { useThemeColors } from "@/constants/colors";

interface Rule {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  title: string;
  desc: string;
}

const RULES: Rule[] = [
  {
    icon: "heart-multiple",
    color: "#EF4444",
    title: "Tôn trọng nhau",
    desc: "Không xúc phạm, kỳ thị, miệt thị bất kỳ ai. Phản biện ý kiến, đừng tấn công cá nhân. Mọi người đến đây để giúp nhau lên kế hoạch du lịch — không phải để cãi nhau.",
  },
  {
    icon: "shield-check",
    color: "#10B981",
    title: "Nội dung trung thực",
    desc: 'Chia sẻ trải nghiệm thật, đánh giá theo cảm nhận thật. Không bịa thông tin về địa điểm, dịch vụ. Nếu bài là quảng cáo có hợp tác, hãy ghi rõ "Có tài trợ" để minh bạch.',
  },
  {
    icon: "block-helper",
    color: "#F59E0B",
    title: "Không spam",
    desc: "Không đăng nhiều bài giống nhau, không spam link affiliate / link bán hàng, không tag bừa địa điểm để câu view. Mỗi bài viết nên mang giá trị thực cho người đọc.",
  },
  {
    icon: "alert-octagon",
    color: "#DC2626",
    title: "Không nội dung độc hại",
    desc: "Cấm tuyệt đối: nội dung tình dục, bạo lực, phá hoại di sản, hướng dẫn vi phạm pháp luật, hate speech, tin giả ảnh hưởng nghiêm trọng (vd sai hướng dẫn an toàn).",
  },
  {
    icon: "account-lock",
    color: "#A855F7",
    title: "Bảo vệ quyền riêng tư",
    desc: "Không đăng thông tin cá nhân của người khác (số điện thoại, địa chỉ nhà, ảnh) khi chưa được phép. Khi review nhân viên dịch vụ, không nêu tên đầy đủ.",
  },
  {
    icon: "copyright",
    color: "#0EA5E9",
    title: "Tôn trọng bản quyền",
    desc: "Ảnh, văn bản phải là của bạn hoặc ghi rõ nguồn. Không sao chép nguyên bài viết của trang khác. Trích dẫn đúng cách khi tham khảo.",
  },
  {
    icon: "comment-question",
    color: "#3B82F6",
    title: "Hỏi đáp có chất lượng",
    desc: 'Câu hỏi cần cụ thể (thời gian, ngân sách, sở thích). Câu trả lời nên có lý do/dẫn chứng. Chủ thớt nên đánh dấu "câu trả lời được chọn" khi vấn đề giải quyết — giúp người sau tìm nhanh.',
  },
];

const ENFORCEMENT = [
  { label: "Vi phạm nhẹ", action: "Cảnh báo, yêu cầu sửa nội dung", color: "#F59E0B" },
  {
    label: "Vi phạm rõ ràng",
    action: "Xóa bài / câu trả lời, gửi thông báo lý do",
    color: "#EF4444",
  },
  {
    label: "Tái phạm nhiều lần",
    action: "Hạn chế đăng bài tạm thời (3-30 ngày)",
    color: "#DC2626",
  },
  { label: "Vi phạm nghiêm trọng", action: "Khóa tài khoản vĩnh viễn", color: "#7C2D12" },
];

export default function CommunityRulesScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + webTopInset + 8 }]}
        >
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)/community")
            }
            style={[
              styles.floatBtn,
              { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.3)" },
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          <View style={styles.heroBody}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="book-open-page-variant" size={32} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Quy tắc cộng đồng</Text>
            <Text style={styles.heroSub}>
              7 điều cần ghi nhớ để PlanGo là nơi tin cậy cho mọi người đi du lịch
            </Text>
          </View>
        </LinearGradient>

        {/* Rules list */}
        <View style={{ paddingHorizontal: 16, marginTop: 18, gap: 12 }}>
          {RULES.map((r, idx) => (
            <View
              key={r.title}
              style={[
                styles.ruleCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
            >
              <View style={[styles.ruleIcon, { backgroundColor: r.color + "1F" }]}>
                <MaterialCommunityIcons name={r.icon} size={20} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ruleTitle, { color: colors.text }]}>
                  {idx + 1}. {r.title}
                </Text>
                <Text style={[styles.ruleDesc, { color: colors.textSecondary }]}>{r.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Enforcement */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Khi vi phạm thì sao?</Text>
          <Text style={[styles.sectionHelp, { color: colors.textSecondary }]}>
            Team PlanGo xem xét mọi báo cáo. Quyết định dựa trên mức độ vi phạm, không tự động xóa.
          </Text>
          <View
            style={[
              styles.enforceTable,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {ENFORCEMENT.map((e, idx) => (
              <View
                key={e.label}
                style={[
                  styles.enforceRow,
                  idx < ENFORCEMENT.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.divider,
                  },
                ]}
              >
                <View style={[styles.enforceDot, { backgroundColor: e.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.enforceLabel, { color: colors.text }]}>{e.label}</Text>
                  <Text style={[styles.enforceAction, { color: colors.textSecondary }]}>
                    {e.action}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Report info */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Báo cáo thế nào?</Text>
          <View
            style={[
              styles.infoBox,
              { backgroundColor: colors.primary + "0F", borderColor: colors.primary + "33" },
            ]}
          >
            <Ionicons name="flag-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Mỗi bài viết / câu trả lời đều có nút{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>Báo cáo</Text> (icon 3 chấm). Khi nhận
              được báo cáo, team sẽ xem nội dung trong vòng 24h và quyết định.
              {"\n\n"}
              Báo cáo sai sự thật nhiều lần sẽ giảm độ tin cậy của tài khoản bạn — hãy báo cáo có
              trách nhiệm.
            </Text>
          </View>
        </View>

        {/* Closing note */}
        <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
          <View
            style={[
              styles.closeBox,
              { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
            ]}
          >
            <MaterialCommunityIcons name="hand-heart" size={22} color={colors.primary} />
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>
              Cảm ơn bạn đã đọc đến cuối. Cộng đồng PlanGo tin tưởng vào lòng tốt của mọi người —
              bạn là một phần làm nên điều đó.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  floatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroBody: { alignItems: "center", marginTop: 14, gap: 6 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginTop: 8 },
  heroSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 19,
  },

  ruleCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  ruleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  ruleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 6 },
  sectionHelp: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 10 },

  enforceTable: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  enforceRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  enforceDot: { width: 10, height: 10, borderRadius: 5 },
  enforceLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  enforceAction: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  closeBox: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  closeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
    fontStyle: "italic",
  },
});
