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

type UserEventListener = (event: string, data: any) => void;
const eventSubscribers = new Map<string, Set<UserEventListener>>();

export function subscribeToUserEvents(userId: string, listener: UserEventListener): () => void {
  let set = eventSubscribers.get(userId);
  if (!set) {
    set = new Set();
    eventSubscribers.set(userId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) eventSubscribers.delete(userId);
  };
}

export function broadcastUserEvent(userId: string, event: string, data: any) {
  const set = eventSubscribers.get(userId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event, data);
    } catch {}
  }
}

