import { AppNotification } from '../db/types';

type Subscriber = (payload: AppNotification) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribeToUser(userId: string, listener: Subscriber): () => void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) subscribers.delete(userId);
  };
}

export function publishToUser(userId: string, notification: AppNotification) {
  const set = subscribers.get(userId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(notification);
    } catch {}
  }
}
