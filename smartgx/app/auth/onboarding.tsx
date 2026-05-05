import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { colors } from "../../src/theme/colors";
import { radius } from "../../src/theme/radius";
import { spacing } from "../../src/theme/spacing";

const slides = [
  "SmartGX automates your saving so good habits happen by default.",
  "SmartGX detects risky spending before it harms your cashflow.",
  "SmartGX helps prevent debt and future-money dependency.",
  "SmartGX rewards healthy financial behaviour with streaks and badges.",
];

export default function OnboardingScreen() {
  return (
    <ScreenShell title="Welcome to SmartGX">
      {slides.map((item) => (
        <Text key={item} style={styles.slide}>- {item}</Text>
      ))}
      <Pressable style={styles.button} onPress={() => router.replace("/auth/login")}>
        <Text style={styles.buttonText}>Continue to Login</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  slide: { color: colors.textPrimary, lineHeight: 22 },
  button: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  buttonText: { color: "#FFF", fontWeight: "700" },
});
