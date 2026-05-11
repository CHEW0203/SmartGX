/**
 * GXHealth screen only: one Gemini `gxhealth_analysis` call per focus session,
 * plus optional manual refresh. Does not run on every `useHealthData` recompute.
 */
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { GXHealthAnalysisContext, GXHealthAnalysisResult } from "../features/ai/gxhealth.ai";
import { enrichGxHealthWithAi } from "../features/ai/gxhealth.ai";

export type GxHealthAiRequestReason = "screen_focus" | "manual_refresh";

export interface UseGxHealthFocusedGeminiOptions {
  userId: string;
  peekGxHealthAnalysisContext: () => GXHealthAnalysisContext;
}

export function useGxHealthFocusedGemini({
  userId,
  peekGxHealthAnalysisContext,
}: UseGxHealthFocusedGeminiOptions): {
  geminiSnapshot: GXHealthAnalysisResult | null;
  refreshGxHealthGemini: () => void;
} {
  const [geminiSnapshot, setGeminiSnapshot] = useState<GXHealthAnalysisResult | null>(null);
  const peekRef = useRef(peekGxHealthAnalysisContext);
  peekRef.current = peekGxHealthAnalysisContext;

  const genRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastScoreForAiRef = useRef<number | null>(null);

  const buildRequestKey = useCallback(() => {
    try {
      const c = peekRef.current();
      return `${userId}|raw${c.score}|disp${Math.round(c.displayScore)}|main${Math.round(c.input.mainBalance)}`;
    } catch {
      return `${userId}|peek_error`;
    }
  }, [userId]);

  const runEnrichment = useCallback(
    async (reason: GxHealthAiRequestReason, sessionId: number) => {
      if (inFlightRef.current) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.log("[GXHealth AI] skip (in flight)", { reason, sessionId });
        }
        return;
      }
      inFlightRef.current = true;
      const requestKey = buildRequestKey();
      try {
        const ctxBase = peekRef.current();
        const extended: GXHealthAnalysisContext["extended"] = {
          ...ctxBase.extended,
          gxHealth: {
            ...ctxBase.extended.gxHealth,
            previousScore: lastScoreForAiRef.current != null ? Math.round(lastScoreForAiRef.current) : null,
            scoreChange:
              lastScoreForAiRef.current != null
                ? Math.round(ctxBase.displayScore - lastScoreForAiRef.current)
                : null,
          },
        };
        const ctx: GXHealthAnalysisContext = { ...ctxBase, extended };

        if (typeof __DEV__ !== "undefined" && __DEV__) {
          // eslint-disable-next-line no-console
          console.log("[GXHealth AI] request started", {
            feature: "gxhealth_analysis",
            reason,
            requestKey,
            sessionId,
          });
        }

        const enriched = await enrichGxHealthWithAi(ctx, { reason, requestKey });

        if (sessionId !== genRef.current) {
          if (typeof __DEV__ !== "undefined" && __DEV__) {
            // eslint-disable-next-line no-console
            console.log("[GXHealth AI] discard stale response", { requestKey, sessionId, gen: genRef.current });
          }
          return;
        }

        lastScoreForAiRef.current = ctxBase.displayScore;
        if (enriched) setGeminiSnapshot(enriched);
      } finally {
        inFlightRef.current = false;
      }
    },
    [buildRequestKey]
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        return () => {};
      }
      const sessionId = ++genRef.current;
      void runEnrichment("screen_focus", sessionId);
      return () => {
        genRef.current++;
        inFlightRef.current = false;
      };
    }, [runEnrichment, userId])
  );

  const refreshGxHealthGemini = useCallback(() => {
    if (!userId) return;
    const sessionId = ++genRef.current;
    void runEnrichment("manual_refresh", sessionId);
  }, [runEnrichment, userId]);

  return { geminiSnapshot, refreshGxHealthGemini };
}
