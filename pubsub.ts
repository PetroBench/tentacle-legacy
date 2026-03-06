import { createPubSub } from "graphql-yoga";

// Track active listener count to skip publishing when no subscribers
const listenerCounts: Record<string, number> = {};

class TrackedEventTarget extends EventTarget {
  addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    listenerCounts[type] = (listenerCounts[type] || 0) + 1;
    super.addEventListener(type, callback, options);
  }
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
    listenerCounts[type] = Math.max(0, (listenerCounts[type] || 0) - 1);
    super.removeEventListener(type, callback, options);
  }
}

export const pubsub = createPubSub({ eventTarget: new TrackedEventTarget() });

// Rate limiting state
const lastPublished: Record<string, number> = {};
const rateLimit = Deno.env.get("TENTACLE_PUBSUB_RATE_LIMIT") || 1000;

export function rateLimitedPublish(topic: string, payload: unknown) {
  // Skip entirely if no subscribers — avoids creating CustomEvent objects
  if (!listenerCounts[topic]) return;

  const now = performance.now();
  const lastTime = lastPublished[topic] || 0;
  if (now - lastTime < Number(rateLimit)) return;

  lastPublished[topic] = now;
  return pubsub.publish(topic, payload);
}
