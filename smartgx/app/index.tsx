import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StatusBar, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/hooks/useAuth";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

export default function SplashScreen() {
  const { isAuthenticated } = useAuth();
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.68)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const dest: "/dashboard" | "/auth/register" = isAuthenticated
      ? "/dashboard"
      : "/auth/register";

    Animated.sequence([
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 1,
          duration: 620,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.2,
          duration: 620,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
    ]).start(() => {
      router.replace(dest);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Ambient glow behind the mark */}
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      <Animated.View style={[styles.glowCore, { opacity: glowOpacity }]} />

      <Animated.View
        style={[
          styles.content,
          { opacity: containerOpacity, transform: [{ scale }] },
        ]}
      >
        {/* SGX Monogram mark */}
        <View style={styles.mark}>
          <Text style={[styles.markLetter, styles.markS]}>S</Text>
          <Text style={[styles.markLetter, styles.markG]}>G</Text>
          <Text style={[styles.markLetter, styles.markX]}>X</Text>
        </View>

        {/* Brand name + tagline stagger in */}
        <Animated.View style={[styles.textBlock, { opacity: subtitleOpacity }]}>
          <Text style={styles.brandName}>SmartGX</Text>
          <Text style={styles.tagline}>AI-powered financial resilience</Text>
        </Animated.View>
      </Animated.View>

      {/* Bottom version label */}
      <Animated.Text style={[styles.version, { opacity: subtitleOpacity }]}>
        Prototype · v0.2
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.primarySoft,
  },
  glowCore: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#2D6CFF",
  },
  content: {
    alignItems: "center",
    gap: spacing.xxl,
  },
  mark: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  markLetter: {
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: -2,
    textShadowColor: "rgba(7, 11, 20, 0.95)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  markS: {
    color: "#68A8FF",
  },
  markG: {
    color: "#CBB7FF",
  },
  markX: {
    color: "#F8FAFF",
  },
  textBlock: {
    alignItems: "center",
    gap: spacing.xs,
  },
  brandName: {
    color: colors.textPrimary,
    fontSize: typography.subheading,
    fontWeight: "800",
    letterSpacing: 2,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: typography.caption,
    letterSpacing: 0.6,
  },
  version: {
    position: "absolute",
    bottom: spacing.xxl,
    color: colors.textMuted,
    fontSize: typography.caption,
    letterSpacing: 0.5,
  },
});
