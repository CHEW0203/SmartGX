import { Redirect, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { VerificationItem } from "../src/components/auth/VerificationItem";
import { AppHeader } from "../src/components/common/AppHeader";
import { PrimaryButton } from "../src/components/common/PrimaryButton";
import { ScreenShell } from "../src/components/common/ScreenShell";
import { SmartCard } from "../src/components/common/SmartCard";
import { useAuth } from "../src/hooks/useAuth";
import { colors } from "../src/theme/colors";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

export default function ProfileScreen() {
  const { currentUser, logout } = useAuth();

  if (!currentUser) return <Redirect href="/auth/login" />;

  const onLogout = () => {
    logout();
    router.replace("/auth/login");
  };

  return (
    <ScreenShell>
      <View style={styles.container}>
        {/* Back to Dashboard */}
        <Pressable style={styles.backBtn} onPress={() => router.push("/dashboard" as never)}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18L9 12L15 6" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.backBtnText}>Home</Text>
        </Pressable>

        <AppHeader title="My Profile" subtitle="Account details and verification status." />
        <SmartCard>
          <Row label="Full name" value={currentUser.fullName} />
          <Row label="Email" value={currentUser.email} />
          <Row label="Mobile" value={currentUser.mobileNumber} />
          <Row label="Nationality" value={currentUser.nationality} />
        </SmartCard>
        <SmartCard>
          <Text style={styles.sectionTitle}>Verification</Text>
          <VerificationItem label="Mobile number" status={currentUser.mobileVerificationStatus} />
          <VerificationItem label="MyKad / NRIC" status={currentUser.identityVerificationStatus} />
          <VerificationItem label="Selfie" status={currentUser.selfieVerificationStatus} />
          <VerificationItem label="Security" status={currentUser.securitySetupStatus} />
          <VerificationItem label="Account" status={currentUser.accountActivationStatus} />
        </SmartCard>
        <PrimaryButton label="Logout" onPress={onLogout} variant="outline" />
      </View>
    </ScreenShell>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  backBtn:     { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 2 },
  backBtnText: { color: "#A78BFA", fontSize: 14, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  label: { color: colors.textSecondary },
  value: { color: colors.textPrimary, fontWeight: "600" },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
