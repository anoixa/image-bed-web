import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from './server';

describe('MSW test boundary', () => {
  it('intercepts a network request', async () => {
    server.use(
      http.get('http://localhost/api/health', () => {
        return HttpResponse.json({ status: 'ok' });
      })
    );

    const response = await fetch('http://localhost/api/health');

    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
