import { z } from 'zod';

export const ApiErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'REVISION_CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export const ApiError = z.object({
  error: z.object({ code: ApiErrorCode, message: z.string(), requestId: z.uuid() }),
});

export const HealthResponse = z.object({
  data: z.object({ status: z.enum(['ok', 'ready']), version: z.literal('0.6.0') }),
});

export const ServerEnvironment = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/ }).optional(),
});

export type ApiError = z.infer<typeof ApiError>;
export type HealthResponse = z.infer<typeof HealthResponse>;
