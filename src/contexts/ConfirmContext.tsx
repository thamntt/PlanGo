import React, { createContext, useCallback, useContext, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/constants/colors";
import { useSettings } from "@/contexts/SettingsContext";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

interface ConfirmApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useSettings();
  const colors = useThemeColors(isDark);
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ id: Date.now(), resolve, ...opts });
    });
  }, []);

  const close = useCallback(
    (ok: boolean) => {
      if (!state) return;
      state.resolve(ok);
      setState(null);
    },
    [state],
  );

  const tint = state?.destructive ? "#EF4444" : colors.primary;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        visible={!!state}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => close(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.background, borderColor: colors.cardBorder },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.iconWrap, { backgroundColor: tint + "1A" }]}>
              <Ionicons
                name={state?.icon || (state?.destructive ? "trash-outline" : "help-circle-outline")}
                size={28}
                color={tint}
              />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{state?.title}</Text>
            {state?.message ? (
              <Text style={[styles.message, { color: colors.textSecondary }]}>{state.message}</Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                onPress={() => close(false)}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>
                  {state?.cancelText || "Hủy"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => close(true)}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  { backgroundColor: tint, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>
                  {state?.confirmText || (state?.destructive ? "Xóa" : "Đồng ý")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/**
 * Returns a `confirm(opts)` function. Always use this instead of `Alert.alert(...,
 * [{text:"Hủy"},{text:"Xóa"}])` — the system dialog looks dated and on web it
 * doesn't render reliably.
 *
 * Usage:
 *   const { confirm } = useConfirm();
 *   if (await confirm({ title: "Xóa bài viết?", destructive: true })) doDelete();
 */
export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to OS confirm on web if provider missing (shouldn't happen).
    return {
      confirm: async (opts) => {
        if (Platform.OS === "web") return window.confirm(`${opts.title}\n${opts.message || ""}`);
        return false;
      },
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center", marginTop: 4 },
  message: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { borderColor: "transparent" },
  btnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
