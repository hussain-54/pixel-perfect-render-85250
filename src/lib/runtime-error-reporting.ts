type RuntimeErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type RuntimeEvents = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: RuntimeErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __runtimeEvents?: RuntimeEvents;
    __reportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
    /** @deprecated Legacy Lovable editor hooks — kept optional for preview compatibility */
    __lovableEvents?: RuntimeEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

/** Report a caught React boundary error to optional host telemetry hooks. */
export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const payloadContext = {
    source: "react_error_boundary",
    route: window.location.pathname,
    ...context,
  };
  const options: RuntimeErrorOptions = {
    mechanism: "react_error_boundary",
    handled: false,
    severity: "error",
  };

  window.__runtimeEvents?.captureException?.(error, payloadContext, options);
  window.__lovableEvents?.captureException?.(error, payloadContext, options);

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const report = {
    message,
    ...(stack !== undefined && { stack }),
    filename: window.location.pathname,
  };
  window.__reportRuntimeError?.(report);
  window.__lovableReportRuntimeError?.(report);
}

/** @deprecated Use reportRuntimeError */
export const reportLovableError = reportRuntimeError;
