import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { useAuthStore } from "../../src/store/authStore";
import { colors } from "../../src/theme/colors";
import { radius } from "../../src/theme/radius";
import { spacing } from "../../src/theme/spacing";

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("aina@freshgrad.my");
  const [password, setPassword] = useState("password123");

  const onLogin = () => {
    const result = login({ email, password });
    if (!result.ok) {
      Alert.alert("Login failed", result.message);
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <ScreenShell title="SmartGX" subtitle="AI-powered financial resilience for GXBank users">
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
      <Pressable style={styles.button} onPress={onLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onLogin}>
        <Text style={styles.secondaryText}>Use Fresh Grad Demo Account</Text>
      </Pressable>
      <View style={styles.row}>
        <Link href="/auth/register" style={styles.link}>Create account</Link>
        <Link href="/auth/onboarding" style={styles.link}>Onboarding</Link>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  buttonText: { color: "#FFF", fontWeight: "700" },
  secondaryButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    alignItems: "center",
  },
  secondaryText: { color: colors.primary, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  link: { color: colors.aiInsight, fontWeight: "600" },
});
