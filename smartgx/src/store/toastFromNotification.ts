import { mapNotificationTypeToToast, useToastStore } from "./toastStore";

export function pushToastFromNotification(input: {
  id: string;
  title: string;
  message: string;
  type: string;
  linkedScreen?: string;
}) {
  useToastStore.getState().enqueue({
    id: input.id,
    title: input.title,
    message: input.message,
    type: mapNotificationTypeToToast(input.type),
    linkedScreen: input.linkedScreen,
  });
}
