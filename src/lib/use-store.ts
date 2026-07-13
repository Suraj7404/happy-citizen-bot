import { useSyncExternalStore } from "react";
import { snapshot, subscribe } from "./mock-api";

/** Re-renders when the in-memory audit/review store changes. */
export function useAuditVersion() {
  return useSyncExternalStore(subscribe, () => snapshot.audit().length, () => 0);
}
export function useReviewVersion() {
  return useSyncExternalStore(subscribe, () => snapshot.review().length, () => 0);
}