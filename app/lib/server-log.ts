import "server-only";

type LogLevel = "info" | "warn" | "error";

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: String(error),
  };
}

function write(level: LogLevel, event: string, context?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(context ?? {}),
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, context?: Record<string, unknown>) {
  write("info", event, context);
}

export function logWarn(event: string, context?: Record<string, unknown>) {
  write("warn", event, context);
}

export function logError(event: string, error: unknown, context?: Record<string, unknown>) {
  write("error", event, {
    ...(context ?? {}),
    error: normalizeError(error),
  });
}
