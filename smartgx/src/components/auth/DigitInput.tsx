import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/radius";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";

interface DigitInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  secure?: boolean;
  autoFocus?: boolean;
  /** When false, digits cannot be entered or focused (e.g. before OTP is sent). */
  editable?: boolean;
}

export const DigitInput = ({
  value,
  onChange,
  length = 6,
  secure = true,
  autoFocus = true,
  editable = true,
}: DigitInputProps) => {
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable
      style={[styles.container, !editable && styles.containerDisabled]}
      disabled={!editable}
      onPress={() => editable && inputRef.current?.focus()}
    >
      <View style={styles.dotsRow}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                filled ? styles.boxFilled : styles.boxEmpty,
                i === value.length && styles.boxActive,
              ]}
            >
              {filled ? (
                <Text style={styles.dotChar}>{secure ? "•" : value[i]}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) =>
          onChange(t.replace(/[^0-9]/g, "").slice(0, length))
        }
        keyboardType="numeric"
        maxLength={length}
        style={styles.hidden}
        autoFocus={editable && autoFocus}
        editable={editable}
        caretHidden
        secureTextEntry={false}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.md,
  },
  containerDisabled: {
    opacity: 0.55,
  },
  dotsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  boxEmpty: {
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  boxActive: {
    borderColor: colors.aiInsight,
  },
  dotChar: {
    color: colors.textPrimary,
    fontSize: typography.heading,
    fontWeight: "700",
  },
  hidden: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
});
