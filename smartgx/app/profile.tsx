import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { ScreenShell } from "../src/components/common/ScreenShell";
import { useAuthStore } from "../src/store/authStore";
import { colors } from "../src/theme/colors";

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);

  return (
    <ScreenShell title="Profile" subtitle={user ? `${user.name} - ${user.email}` : "No active session"}>
      <Pressable
        onPress={() => {
          logout();
          router.replace("/auth/login");
        }}
      >
        <Text style={styles.logout}>Logout</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  logout: { color: colors.danger, fontWeight: "700" },
});
