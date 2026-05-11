export { getAiConfig, isAiEndpointConfigured, type AiConfig } from "./ai.config";
export {
  callSmartGxAi,
  invokeSmartGxAiStructured,
  invokeAssistantChat,
  testSmartGxAiConnection,
  type AiStructuredRequest,
  type AssistantChatMessage,
  type AssistantRemoteOutcome,
  type SmartGxAiFeature,
  type SmartGxAiResponse,
} from "./ai.client";
export {
  getAssistantReply,
  getAssistantReplyDetailed,
  findLocalAssistantAnswer,
  ASSISTANT_QUICK_FAQ,
  type AssistantReplySource,
} from "./assistant.service";
