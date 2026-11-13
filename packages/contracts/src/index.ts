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
  'PRECONDITION_REQUIRED',
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

export const Email = z.string().trim().toLowerCase().email().max(254);
export const Password = z.string().min(12).max(128);
export const RegisterInput = z
  .object({ email: Email, password: Password, displayName: z.string().trim().min(1).max(80) })
  .strict();
export const LoginInput = z.object({ email: Email, password: z.string().min(1).max(128) });
export const EmailInput = z.object({ email: Email }).strict();
export const TokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export const ResetInput = TokenInput.extend({ password: Password });
export const ProjectInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().max(10000).default(''),
  })
  .strict();
export const ProjectPatch = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(10000).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const StoryInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    synopsis: z.string().max(10000).default(''),
    format: z.string().trim().max(80).default(''),
  })
  .strict();
export const StoryPatch = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    synopsis: z.string().max(10000).optional(),
    format: z.string().trim().max(80).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const AccountPatch = z.object({ displayName: z.string().trim().min(1).max(80) }).strict();
export const Id = z.uuid();
export const ListQuery = z
  .object({
    archived: z.enum(['true', 'false']).default('false'),
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const ProjectRecord = z.object({
  id: Id,
  title: z.string(),
  description: z.string(),
  version: z.number().int(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const StoryRecord = z.object({
  id: Id,
  projectId: Id,
  title: z.string(),
  synopsis: z.string(),
  format: z.string(),
  version: z.number().int(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProjectRecord = z.infer<typeof ProjectRecord>;
export type StoryRecord = z.infer<typeof StoryRecord>;
export type AccountRecord = {
  id: string;
  email: string;
  displayName: string;
  version: number;
  aiEnabled: false;
  workspaceId: string;
};

export * from './rich-text';
export * from './ideas';
