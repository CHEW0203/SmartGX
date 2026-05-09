import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import InAppToastHost from "../src/components/notifications/InAppToastHost";
import { colors } from "../src/theme/colors";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={styles.shell}>
        <StatusBar style="light" backgroundColor={colors.background} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: "fade",
          }}
        />
        <View style={styles.toastLayer} pointerEvents="box-none">
          <InAppToastHost />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  toastLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    pointerEvents: "box-none",
    zIndex: 9999,
  },
});
