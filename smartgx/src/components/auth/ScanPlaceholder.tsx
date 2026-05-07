import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

export type ScanType = "card_front" | "card_back" | "selfie";

interface ScanPlaceholderProps {
  type: ScanType;
  scanned: boolean;
  onSimulate: () => void;
  onRetake: () => void;
  label: string;
}

const ICONS: Record<ScanType, string> = {
  card_front: "🪪",
  card_back: "🪪",
  selfie: "🤳",
};

const HINTS: Record<ScanType, string> = {
  card_front: "Place the front of your MyKad\nwithin the frame",
  card_back: "Place the back of your MyKad\nwithin the frame",
  selfie: "Position your face\nwithin the oval frame",
};

export const ScanPlaceholder = ({
  type,
  scanned,
  onSimulate,
  onRetake,
  label,
}: ScanPlaceholderProps) => {
  const isOval = type === "selfie";

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.frame, isOval && styles.oval, scanned && styles.frameScanned]}>
        {scanned ? (
          <View style={styles.successInner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Scan simulated</Text>
          </View>
        ) : (
          <View style={styles.idleInner}>
            <Text style={styles.icon}>{ICONS[type]}</Text>
            <Text style={styles.hint}>{HINTS[type]}</Text>
          </View>
        )}
      </View>
      <View style={styles.buttons}>
        {scanned ? (
          <Pressable style={styles.retake} onPress={onRetake}>
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.simulate} onPress={onSimulate}>
            <Text style={styles.simulateText}>Simulate Successful Scan</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.disclaimer}>
        Prototype only. No real document is captured or processed.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
    alignItems: "center",
  },
  label: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.subheading,
    alignSelf: "flex-start",
  },
  frame: {
    width: "90%",
    aspectRatio: 1.586,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    borderStyle: "dashed",
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  oval: {
    aspectRatio: 0.8,
    borderRadius: 999,
    width: "60%",
  },
  frameScanned: {
    borderColor: colors.success,
    borderStyle: "solid",
  },
  idleInner: {
    alignItems: "center",
    gap: spacing.sm,
  },
  icon: {
    fontSize: 40,
  },
  hint: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  successInner: {
    alignItems: "center",
    gap: spacing.sm,
  },
  successIcon: {
    fontSize: 40,
    color: colors.success,
  },
  successText: {
    color: colors.success,
    fontWeight: "700",
  },
  buttons: {
    width: "90%",
  },
  simulate: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  simulateText: {
    color: colors.primary,
    fontWeight: "700",
  },
  retake: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  retakeText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  disclaimer: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: "center",
    lineHeight: 18,
  },
});
