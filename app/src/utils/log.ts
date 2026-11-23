/** Warnings that help while developing but should not spam production logs or leak error details on user devices. */
export function devWarn(...args: unknown[]): void {
  if (__DEV__) console.warn(...args);
}
