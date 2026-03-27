/**
 * 通知ストア。module singleton パターン。
 * トースト通知の追加・削除・タイムアウト管理を行う。
 */
import { ref } from "vue";

interface Notification {
  id: number;
  type: "error" | "info";
  message: string;
}

/** info 通知の自動消去時間（ms） */
const INFO_AUTO_DISMISS_MS = 5000;

let nextId = 0;
const notifications = ref<Notification[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function add(type: Notification["type"], message: string) {
  const id = nextId++;
  notifications.value.push({ id, type, message });

  if (type === "info") {
    const timer = setTimeout(() => dismiss(id), INFO_AUTO_DISMISS_MS);
    timers.set(id, timer);
  }
}

function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  notifications.value = notifications.value.filter((n) => n.id !== id);
}

export function useNotificationStore() {
  return {
    notifications,
    error: (message: string) => add("error", message),
    info: (message: string) => add("info", message),
    dismiss,
  };
}
