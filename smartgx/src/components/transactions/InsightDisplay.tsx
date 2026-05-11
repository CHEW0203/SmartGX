import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { typography } from "../../theme/typography";
import { radius } from "../../theme/radius";
import type {
  TransactionInsightResult,
  TransactionInsightStructured,
} from "../../features/ai/transactionInsight.ai";

type Tone = "positive" | "warning" | "danger" | "neutral" | "info";

interface StatPoint {
  label: string;
  value: string;
  tone: Tone;
}

function toneColor(tone: Tone): string {
  switch (tone) {
    case "positive":
      return colors.success;
    case "warning":
      return colors.warning;
    case "danger":
      return colors.danger;
    case "info":
      return colors.primary;
    default:
      return colors.textPrimary;
  }
}

function riskTone(level: "low" | "medium" | "high"): Tone {
  if (level === "high") return "danger";
  if (level === "medium") return "warning";
  return "positive";
}

function buildSnapshotPoints(s: TransactionInsightStructured, result: TransactionInsightResult): StatPoint[] {
  const points: StatPoint[] = [];

  const summaryMatch = s.summary.match(/(?:spent|spending)[^.]*?(RM[\d,]+)/i);
  if (summaryMatch) {
    points.push({ label: "Spent this month", value: summaryMatch[1], tone: result.concernLevel === "low" ? "neutral" : "warning" });
  }

  if (s.topDrivers.length > 0) {
    points.push({ label: "Top category", value: s.topDrivers[0], tone: "warning" });
  }

  const balMatch = s.summary.match(/Main Account[^.]*?(RM[\d,]+)/i);
  if (balMatch) {
    points.push({ label: "Main Account balance", value: balMatch[1], tone: "info" });
  }

  return points;
}

function buildForecastPoints(s: TransactionInsightStructured): StatPoint[] {
  const points: StatPoint[] = [];
  const fc = s.monthEndForecast;

  if (fc.projectedExpense) {
    points.push({
      label: "Projected month-end spending",
      value: fc.projectedExpense,
      tone: riskTone(fc.cashflowRisk),
    });
  }

  if (fc.projectedRemainingBalance) {
    points.push({
      label: "Projected remaining balance",
      value: fc.projectedRemainingBalance,
      tone: riskTone(fc.cashflowRisk),
    });
  }

  const riskLabel =
    fc.cashflowRisk === "high" ? "Tight buffer"
    : fc.cashflowRisk === "medium" ? "Moderate pressure"
    : "Healthy";
  points.push({
    label: "Forecast status",
    value: riskLabel,
    tone: riskTone(fc.cashflowRisk),
  });

  if (fc.debtPressure !== "low") {
    points.push({
      label: "Debt pressure",
      value: fc.debtPressure === "high" ? "High" : "Moderate",
      tone: riskTone(fc.debtPressure),
    });
  }

  return points;
}

function buildRiskLines(s: TransactionInsightStructured): string[] {
  const lines: string[] = [];
  if (s.riskExplanation) {
    for (const sentence of s.riskExplanation.split(/(?<=\.)\s+/).filter(Boolean)) {
      lines.push(sentence.trim());
    }
  }
  return lines.slice(0, 3);
}

function buildActionLines(s: TransactionInsightStructured): string[] {
  return s.recommendedActions.slice(0, 4).map((a) => {
    const amt = a.suggestedAmount && a.suggestedAmount !== "—" ? ` (${a.suggestedAmount})` : "";
    return `${a.title}${amt}`;
  });
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={st.sectionHeader}>{title}</Text>;
}

function StatRow({ point }: { point: StatPoint }) {
  return (
    <View style={st.statRow}>
      <Text style={st.bullet}>•</Text>
      <Text style={st.statLabel}>{point.label}: </Text>
      <Text style={[st.statValue, { color: toneColor(point.tone) }]}>{point.value}</Text>
    </View>
  );
}

function BulletLine({ text, tone }: { text: string; tone?: Tone }) {
  return (
    <View style={st.bulletRow}>
      <Text style={st.bullet}>•</Text>
      <Text style={[st.bulletText, tone ? { color: toneColor(tone) } : undefined]}>
        <HighlightedText text={text} />
      </Text>
    </View>
  );
}

const RM_PATTERN = /RM[\d,]+(?:\.\d{1,2})?/g;
const CATEGORY_KEYWORDS = /\b(?:Food & Dining|Others|Transport|Shopping|Entertainment|Utilities|Groceries|Health|Education|Subscription)\b/gi;

function HighlightedText({ text }: { text: string }) {
  const parts: { text: string; highlight: boolean }[] = [];
  let last = 0;

  const allMatches: { start: number; end: number }[] = [];
  for (const re of [RM_PATTERN, CATEGORY_KEYWORDS]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  allMatches.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const m of allMatches) {
    const prev = merged[merged.length - 1];
    if (prev && m.start <= prev.end) {
      prev.end = Math.max(prev.end, m.end);
    } else {
      merged.push({ ...m });
    }
  }

  for (const m of merged) {
    if (m.start > last) {
      parts.push({ text: text.slice(last, m.start), highlight: false });
    }
    parts.push({ text: text.slice(m.start, m.end), highlight: true });
    last = m.end;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), highlight: false });
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) =>
        p.highlight ? (
          <Text key={i} style={st.highlightText}>{p.text}</Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </>
  );
}

function StructuredDisplay({ structured, result }: { structured: TransactionInsightStructured; result: TransactionInsightResult }) {
  const snapshot = buildSnapshotPoints(structured, result);
  const forecast = buildForecastPoints(structured);
  const risks = buildRiskLines(structured);
  const actions = buildActionLines(structured);

  return (
    <View style={st.sections}>
      {snapshot.length > 0 && (
        <View style={st.section}>
          <SectionHeader title="Current Spending Snapshot" />
          {snapshot.map((p, i) => <StatRow key={i} point={p} />)}
        </View>
      )}

      {forecast.length > 0 && (
        <View style={st.section}>
          <SectionHeader title="One-Month Forecast" />
          {forecast.map((p, i) => <StatRow key={i} point={p} />)}
        </View>
      )}

      {risks.length > 0 && (
        <View style={st.section}>
          <SectionHeader title="Key Risk" />
          {risks.map((line, i) => (
            <BulletLine key={i} text={line} tone={result.concernLevel === "high" ? "danger" : "warning"} />
          ))}
        </View>
      )}

      {actions.length > 0 && (
        <View style={st.section}>
          <SectionHeader title="Recommended Action" />
          {actions.map((line, i) => <BulletLine key={i} text={line} />)}
        </View>
      )}

      {structured.priorityAction ? (
        <View style={st.priorityWrap}>
          <Text style={st.priorityLabel}>Priority:</Text>
          <Text style={st.priorityText}>{structured.priorityAction}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PlainTextDisplay({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  return (
    <View style={st.sections}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (/^\d+\.\s/.test(trimmed)) {
          return (
            <View key={i} style={st.bulletRow}>
              <Text style={st.bullet}>•</Text>
              <Text style={st.bulletText}>
                <HighlightedText text={trimmed.replace(/^\d+\.\s*/, "")} />
              </Text>
            </View>
          );
        }
        if (/^[-•]\s/.test(trimmed)) {
          return (
            <View key={i} style={st.bulletRow}>
              <Text style={st.bullet}>•</Text>
              <Text style={st.bulletText}>
                <HighlightedText text={trimmed.replace(/^[-•]\s*/, "")} />
              </Text>
            </View>
          );
        }
        if (/^(Priority|Recommended|Top drivers|Month-end|Cashflow|Debt):/i.test(trimmed)) {
          const colonIdx = trimmed.indexOf(":");
          return (
            <View key={i} style={st.bulletRow}>
              <Text style={st.sectionHeader}>{trimmed.slice(0, colonIdx + 1)}</Text>
              <Text style={st.bulletText}>
                <HighlightedText text={trimmed.slice(colonIdx + 1).trim()} />
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} style={st.bodyText}>
            <HighlightedText text={trimmed} />
          </Text>
        );
      })}
    </View>
  );
}

export interface InsightDisplayProps {
  result: TransactionInsightResult | null;
  fallbackText?: string;
}

export function InsightDisplay({ result, fallbackText }: InsightDisplayProps) {
  if (!result && !fallbackText) return null;

  if (result?.structured) {
    return <StructuredDisplay structured={result.structured} result={result} />;
  }

  const text = result?.displayBody ?? fallbackText ?? "";
  if (!text.trim()) return null;

  return <PlainTextDisplay text={text} />;
}

const st = StyleSheet.create({
  sections: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionHeader: {
    color: colors.aiInsight,
    fontSize: typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    paddingLeft: spacing.xs,
  },
  bullet: {
    color: colors.textMuted,
    fontSize: typography.body,
    marginRight: spacing.xs,
    lineHeight: 22,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  statValue: {
    fontSize: typography.body,
    fontWeight: "700",
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
  },
  bulletText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    lineHeight: 22,
    flex: 1,
  },
  bodyText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  highlightText: {
    color: colors.warning,
    fontWeight: "700",
  },
  priorityWrap: {
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  priorityLabel: {
    color: colors.aiInsight,
    fontSize: typography.caption,
    fontWeight: "700",
  },
  priorityText: {
    color: colors.textPrimary,
    fontSize: typography.caption,
    flex: 1,
  },
});
