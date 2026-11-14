import 'server-only';
import { randomUUID } from 'node:crypto';
import { ApiErrorCode } from '@inkwell/contracts';
const windows = new Map<number, { start: number; count: number }>();
/** Closed fields only. Never pass a request, URL, user identifier or exception. */
export function reportFailure(status: number, code: unknown) {
  const parsed = ApiErrorCode.safeParse(code);
  const event = {
    event: 'inkwell.request_failure',
    at: new Date().toISOString(),
    requestId: randomUUID(),
    status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503,
    code: parsed.success ? parsed.data : 'SERVICE_UNAVAILABLE',
  };
  const category = event.status >= 500 ? 5 : event.status === 429 ? 429 : 4;
  const start = Math.floor(Date.now() / 60000),
    maximum = category === 5 ? 60 : category === 429 ? 6 : 12;
  let window = windows.get(category);
  if (!window || window.start !== start) {
    window = { start, count: 0 };
    windows.set(category, window);
  }
  if (window.count++ < maximum) {
    try {
      console.error(JSON.stringify(event));
    } catch {
      /* Logging cannot break a safe response. */
    }
  }
  return event.requestId;
}
