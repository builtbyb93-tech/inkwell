import type { NextRequest } from 'next/server';
import { Id } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { HttpError } from '@/server/http';
import { limit } from '@/server/rate-limit';
import { exportProject } from '@/server/portability';
export function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  return privateApi(request, async (a) => {
    const { projectId } = await params;
    if (!Id.safeParse(projectId).success)
      throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid project.');
    await limit('project-export', a.id, 5);
    const archive = await exportProject(a, projectId);
    return new Response(JSON.stringify(archive), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="inkwell-project.json"',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
