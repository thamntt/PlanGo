import React, { createContext, useContext, useRef, useCallback, useState } from "react";
import { Animated } from "react-native";

interface TabBarContextValue {
  translateY: Animated.Value;
  onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => void;
  show: () => void;
}

const TabBarContext = createContext<TabBarContextValue | null>(null);

const HIDE_DISTANCE = 100; // tab bar slide-out distance
const HIDE_THRESHOLD = 14; // px scroll delta before reacting

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const lastDir = useRef<"up" | "down" | null>(null);
  const [visible, setVisible] = useState(true);

  const animate = useCallback(
    (toVisible: boolean) => {
      Animated.timing(translateY, {
        toValue: toVisible ? 0 : HIDE_DISTANCE,
        duration: 220,
        useNativeDriver: true,
      }).start();
    },
    [translateY],
  );

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      if (Math.abs(dy) < HIDE_THRESHOLD) return;
      if (y < 10) {
        if (lastDir.current !== "up") {
          setVisible(true);
          animate(true);
          lastDir.current = "up";
        }
        lastY.current = y;
        return;
      }
      const dir = dy > 0 ? "down" : "up";
      if (dir !== lastDir.current) {
        lastDir.current = dir;
        const next = dir === "up";
        setVisible(next);
        animate(next);
      }
      lastY.current = y;
    },
    [animate],
  );

  const show = useCallback(() => {
    if (!visible) {
      setVisible(true);
      animate(true);
      lastDir.current = "up";
    }
  }, [visible, animate]);

  return (
    <TabBarContext.Provider value={{ translateY, onScroll, show }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  const ctx = useContext(TabBarContext);
  if (!ctx) {
    return {
      translateY: new Animated.Value(0),
      onScroll: () => {},
      show: () => {},
    } as TabBarContextValue;
  }
  return ctx;
}
