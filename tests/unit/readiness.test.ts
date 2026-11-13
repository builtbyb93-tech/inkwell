import { describe, expect, it } from 'vitest';
import { assessReadiness } from '@inkwell/domain';
import { ApiError, HealthResponse, ServerEnvironment } from '@inkwell/contracts';
import { GET } from '../../apps/web/src/app/api/v1/health/route';

describe('operational API boundary', () => {
  it('keeps liveness independent of database availability and disables caching', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(HealthResponse.parse(await response.json()).data.status).toBe('ok');
  });

  it('fails readiness without exposing private driver errors', async () => {
    const ready = await assessReadiness(async () => {
      throw new Error('private host, query and authentication details');
    });
    expect(ready).toBe(false);
  });

  it('waits for a successful dependency probe', async () => {
    let completed = false;
    expect(
      await assessReadiness(async () => {
        completed = true;
      }),
    ).toBe(true);
    expect(completed).toBe(true);
  });

  it('rejects malformed database configuration', () => {
    expect(ServerEnvironment.safeParse({ DATABASE_URL: 'invalid' }).success).toBe(false);
    expect(
      ServerEnvironment.safeParse({ DATABASE_URL: 'postgresql://localhost/inkwell_dev' }).success,
    ).toBe(true);
    expect(ServerEnvironment.safeParse({ DATABASE_URL: 'https://example.test' }).success).toBe(
      false,
    );
  });

  it('requires a correlation identifier and a documented error code', () => {
    expect(ApiError.safeParse({ error: { code: 'EXCEPTION', message: 'oops' } }).success).toBe(
      false,
    );
  });
});
