/**
 * SmartGX AI — Expo client configuration
 *
 * Only the backend proxy URL is public. Never put Gemini or other provider
 * secrets in EXPO_PUBLIC_* variables.
 */

export interface AiConfig {
  /** POST base URL for SmartGX AI proxy, e.g. http://localhost:3001/api/ai */
  endpoint: string;
  /** True when EXPO_PUBLIC_SMARTGX_AI_ENDPOINT is a valid http(s) URL. */
  enabled: boolean;
  /** Alias for enabled — remote proxy configured. */
  remoteAiEnabled: boolean;
  /** When true, features use local/rule-based output if the proxy fails. */
  fallbackEnabled: boolean;
}

export function getAiConfig(): AiConfig {
  const endpoint = (process.env.EXPO_PUBLIC_SMARTGX_AI_ENDPOINT ?? "").trim();
  const endpointOk = endpoint.startsWith("http://") || endpoint.startsWith("https://");

  return {
    endpoint,
    enabled: endpointOk,
    remoteAiEnabled: endpointOk,
    fallbackEnabled: true,
  };
}

/** True when a SmartGX AI proxy URL is configured (no secrets). */
export function isAiEndpointConfigured(): boolean {
  return getAiConfig().enabled;
}
