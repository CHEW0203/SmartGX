import React from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "../../theme/colors";
import type { ToastPayload } from "../../store/toastStore";
import { useToastStore } from "../../store/toastStore";

const DISMISS_MS = 4000;
const SWIPE_THRESHOLD = 48;

function toastAccent(type: ToastPayload["type"]): string {
  switch (type) {
    case "success":
      return "#22C55E";
    case "reward":
    case "campaign":
      return "#A78BFA";
    case "warning":
      return "#FBBF24";
    case "risk":
      return "#F97316";
    case "danger":
      return "#EF4444";
    case "security":
      return "#38BDF8";
    default:
      return "#C4B5FD";
  }
}

function toastIcon(type: ToastPayload["type"]): string {
  switch (type) {
    case "success":
      return "✓";
    case "reward":
      return "★";
    case "campaign":
      return "◎";
    case "warning":
      return "!";
    case "risk":
      return "⚠";
    case "danger":
      return "!";
    case "security":
      return "🔒";
    default:
      return "i";
  }
}

export default function InAppToastHost() {
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const dequeue = useToastStore((s) => s.dequeue);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translate = React.useRef(new Animated.Value(-24)).current;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateOut = React.useCallback(
    (thenDismiss = true) => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translate, { toValue: -24, duration: 160, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && thenDismiss) dequeue();
      });
    },
    [opacity, translate, dequeue]
  );

  React.useEffect(() => {
    if (!current) return;
    opacity.setValue(0);
    translate.setValue(-24);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }),
    ]).start();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => animateOut(), DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, opacity, translate, animateOut]);

  const pan = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 || Math.abs(g.dx) > 10,
        onPanResponderRelease: (_, g) => {
          if (g.dy < -SWIPE_THRESHOLD || Math.abs(g.dx) > SWIPE_THRESHOLD * 1.2) {
            animateOut();
          }
        },
      }),
    [animateOut]
  );

  if (!current) return null;

  const accent = toastAccent(current.type);

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        toastStyles.wrap,
        {
          paddingTop: Math.max(insets.top + 6, 16),
          opacity,
          transform: [{ translateY: translate }],
          maxWidth: Dimensions.get("window").width - 28,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[toastStyles.card, { borderLeftColor: accent }]}
        onPress={() => {
          if (current.linkedScreen) {
            animateOut(false);
            router.push(current.linkedScreen as never);
            dequeue();
          }
        }}
      >
        <View style={[toastStyles.glyph, { borderColor: accent }]}>
          <Text style={[toastStyles.glyphText, { color: accent }]}>{toastIcon(current.type)}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={toastStyles.title} numberOfLines={2}>
            {current.title}
          </Text>
          <Text style={toastStyles.message} numberOfLines={3}>
            {current.message}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss notification toast"
          onPress={() => animateOut()}
          style={toastStyles.close}
          hitSlop={12}
        >
          <Text style={toastStyles.closeText}>×</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  wrap: { alignSelf: "stretch", alignItems: "center", paddingHorizontal: 14 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(22,16,41,0.94)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  glyph: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  glyphText: { fontWeight: "900", fontSize: 14 },
  title: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  message: { color: "#C7BDE4", fontSize: 12, lineHeight: 17 },
  close: { paddingHorizontal: 4, paddingVertical: 2 },
  closeText: { color: "#A898C8", fontSize: 18, fontWeight: "700" },
});

