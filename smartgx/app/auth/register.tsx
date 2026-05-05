import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { ScreenShell } from "../../src/components/common/ScreenShell";
import { useAuthStore } from "../../src/store/authStore";
import { colors } from "../../src/theme/colors";
import { radius } from "../../src/theme/radius";
import { spacing } from "../../src/theme/spacing";
import type { UserType } from "../../src/types/user";

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("1200");
  const [userType, setUserType] = useState<UserType>("student");

  const onRegister = () => {
    const result = register({
      name,
      email,
      password,
      monthlyIncome: Number(monthlyIncome || 0),
      userType,
    });

    if (!result.ok) {
      Alert.alert("Register failed", result.message);
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <ScreenShell title="Register" subtitle="Create your SmartGX demo profile">
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
      <TextInput style={styles.input} value={monthlyIncome} onChangeText={setMonthlyIncome} placeholder="Monthly income / allowance" keyboardType="numeric" />
      <Pressable style={styles.toggle} onPress={() => setUserType((prev) => (prev === "student" ? "fresh_graduate" : "student"))}>
        <Text style={styles.toggleText}>User type: {userType === "student" ? "Student" : "Fresh Graduate"} (tap to switch)</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={onRegister}>
        <Text style={styles.buttonText}>Register</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface },
  toggle: { borderRadius: radius.md, backgroundColor: colors.muted, padding: spacing.md },
  toggleText: { color: colors.textPrimary, fontWeight: "600" },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  buttonText: { color: "#FFF", fontWeight: "700" },
});
