import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../src/components/common/ScreenShell";
import { colors } from "../src/theme/colors";

export default function CampaignsScreen() {
  return (
    <ScreenShell title="Campaigns" subtitle="Browse active challenges from your SmartGX dashboard.">
      <View style={s.box}>
        <Text style={s.body}>Open the home carousel to view each campaign, or use the link below.</Text>
        <Pressable style={s.btn} onPress={() => router.push("/dashboard" as never)}>
          <Text style={s.btnText}>Go to Dashboard</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const s = StyleSheet.create({
  box: { gap: 12, paddingVertical: 8 },
  body: { color: colors.textSecondary, lineHeight: 20 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: "#FFF", fontWeight: "800" },
});
