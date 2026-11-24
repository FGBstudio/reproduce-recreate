import * as Sentry from "@sentry/react";
import { Capacitor } from "@capacitor/core";
import { isSupabaseConfigured } from "@/lib/supabase";

const SENSITIVE_KEY_RE =
  /^(authorization|x-api-key|apikey|api_key|x-supabase-auth|cookie|set-cookie|password|token|access_token|refresh_token|secret)$/i;
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const API_KEY_PARAM_RE =
  /((?:apikey|api_key|access_token|refresh_token|token)=)([^&\s"']+)/gi;
const SUPABASE_KEY_RE = /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+/g;

let initialized = false;

function scrubString(value: string): string {
  return value
    .replace(JWT_RE, "[Filtered JWT]")
    .replace(BEARER_RE, "Bearer [Filtered]")
    .replace(API_KEY_PARAM_RE, "$1[Filtered]")
    .replace(SUPABASE_KEY_RE, "[Filtered Key]");
}

function scrubUnknown(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object" || depth > 5) return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = "[Filtered]";
    } else {
      out[k] = scrubUnknown(v, depth + 1, seen);
    }
  }
  return out;
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.message) {
    event.message = scrubString(event.message);
  }

  if (event.request) {
    if (event.request.headers) {
      event.request.headers = scrubUnknown(event.request.headers) as Record<
        string,
        string
      >;
    }
    if (event.request.cookies) {
      event.request.cookies = { filtered: "[Filtered]" };
    }
    if (typeof event.request.query_string === "string") {
      event.request.query_string = scrubString(event.request.query_string);
    } else if (event.request.query_string) {
      event.request.query_string = scrubUnknown(
        event.request.query_string,
      ) as Record<string, string>;
    }
    if (event.request.url) {
      event.request.url = scrubString(event.request.url);
    }
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex) => ({
      ...ex,
      value: ex.value ? scrubString(ex.value) : ex.value,
    }));
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubString(crumb.message) : crumb.message,
      data: crumb.data
        ? (scrubUnknown(crumb.data) as Record<string, unknown>)
        : crumb.data,
    }));
  }

  if (event.extra) {
    event.extra = scrubUnknown(event.extra) as Record<string, unknown>;
  }

  if (event.contexts) {
    event.contexts = scrubUnknown(event.contexts) as Sentry.Contexts;
  }

  return event;
}

/**
 * Initialize Sentry error tracking for production builds only.
 * Disabled in dev, demo mode, or when VITE_SENTRY_DSN is unset.
 */
export function initSentry(): void {
  if (initialized) return;

  const isDemoMode =
    import.meta.env.VITE_DEMO_MODE === "true" || !isSupabaseConfigured;
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

  if (!import.meta.env.PROD || isDemoMode || !dsn) {
    return;
  }

  const release =
    typeof __APP_RELEASE__ !== "undefined" && __APP_RELEASE__
      ? __APP_RELEASE__
      : import.meta.env.VITE_SENTRY_RELEASE || undefined;

  const environment =
    import.meta.env.VITE_SENTRY_ENVIRONMENT ||
    (import.meta.env.PROD ? "production" : "development");

  Sentry.init({
    dsn,
    release,
    environment,
    // @sentry/react v11 defaults all dataCollection flags to true; disable automatic
    // PII/IP/cookie/query/body collection and keep only user-agent for OS/device parsing.
    dataCollection: {
      userInfo: false,
      cookies: false,
      urlQueryParams: false,
      httpBodies: [],
      httpHeaders: {
        request: { allow: ["user-agent"] },
        response: false,
      },
    },
    transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
    beforeSend(event) {
      return scrubEvent(event);
    },
  });

  const platform = Capacitor.isNativePlatform()
    ? Capacitor.getPlatform()
    : "web";
  Sentry.setTag("platform", platform);

  initialized = true;
}

export function captureSentryException(
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  if (!initialized) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}

export function setSentryUser(userId: string | null): void {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
