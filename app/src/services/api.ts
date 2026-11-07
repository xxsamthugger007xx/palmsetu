/**
 * This file is intentionally left as a stub. It previously held an early,
 * now-superseded palm API client (pre-dating palmApi.ts) that was never
 * wired into any screen. Palm API calls now live in palmApi.ts, which
 * matches the current server/src/types/palm.ts shape exactly. Companion
 * chat and mood check-in calls live in assistantApi.ts / their own
 * feature-specific services. Kept as an empty module rather than deleted
 * so no import path breaks if something still references it.
 */
export {};
