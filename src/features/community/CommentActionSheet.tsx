import React from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { useThemeColors } from "@/constants/colors";

type ThemeColors = ReturnType<typeof useThemeColors>;

export interface ActionItem {
  key: string;
  label: string;
  icon:
    | keyof typeof Ionicons.glyphMap
    | { lib: "mci"; name: keyof typeof MaterialCommunityIcons.glyphMap };
  destructive?: boolean;
  onPress: () => void;
}

export function CommentActionSheet({
  visible,
  onClose,
  actions,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  actions: ActionItem[];
  colors: ThemeColors;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.cardBorder },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          {actions.map((a, i) => {
            const tint = a.destructive ? "#EF4444" : colors.text;
            return (
              <Pressable
                key={a.key}
                onPress={() => {
                  a.onPress();
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderTopColor: colors.divider,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                {typeof a.icon === "string" ? (
                  <Ionicons name={a.icon} size={20} color={tint} />
                ) : (
                  <MaterialCommunityIcons name={a.icon.name} size={20} color={tint} />
                )}
                <Text style={[styles.label, { color: tint }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cancel: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
