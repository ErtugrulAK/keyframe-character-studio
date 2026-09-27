import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import cors from 'cors';
import express from 'express';
import { describe, expect, it } from 'vitest';
import {
  CORS_ORIGINS_VARIABLE,
  createCorsOptions,
} from '../../server/corsPolicy.js';

interface RequestResult {
  status: number;
  allowOrigin: string | null;
  body: unknown;
}
const closeServer = (server: Server): Promise<void> => {
  const { promise, reject, resolve } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  return promise;
};

const requestThroughCors = async (
  env: Record<string, string> = {},
  origin?: string,
  path = '/api/health',
): Promise<RequestResult> => {
  const app = express();
  app.use(cors(createCorsOptions(env)));
  app.get('/api/health', (_request, response) => response.json({ status: 'online' }));
  app.get('/api/projects', (_request, response) => response.json({ success: true, projects: [] }));
  const server = app.listen(0, '127.0.0.1');

  const listening = Promise.withResolvers<void>();
  server.once('listening', listening.resolve);
  await listening.promise;
  const port = (server.address() as AddressInfo).port;

  try {
    const headers = origin === undefined ? undefined : { Origin: origin };
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    return {
      status: response.status,
      allowOrigin: response.headers.get('access-control-allow-origin'),
      body: await response.json(),
    };
  } finally {
    await closeServer(server);
  }
};

describe('API CORS policy', () => {
  it('allows the documented local editor origin exactly', async () => {
    const origin = 'http://127.0.0.1:5173';

    const result = await requestThroughCors({}, origin);

    expect(result.status).toBe(200);
    expect(result.allowOrigin).toBe(origin);
    expect(result.body).toEqual({ status: 'online' });
  });

  it('does not expose CORS headers to an arbitrary browser origin', async () => {
    const result = await requestThroughCors({}, 'https://attacker.example');

    expect(result.status).toBe(200);
    expect(result.allowOrigin).toBeNull();
  });

  it('keeps Origin-less CLI and server-to-server requests working', async () => {
    const health = await requestThroughCors();
    const projects = await requestThroughCors({}, undefined, '/api/projects');

    expect(health).toEqual({ status: 200, allowOrigin: null, body: { status: 'online' } });
    expect(projects).toEqual({ status: 200, allowOrigin: null, body: { success: true, projects: [] } });
  });

  it('adds an exact extra origin without dropping local editor origins', async () => {
    const env = { [CORS_ORIGINS_VARIABLE]: 'https://editor.example' };

    const extra = await requestThroughCors(env, 'https://editor.example');
    const local = await requestThroughCors(env, 'http://localhost:5189');

    expect(extra.allowOrigin).toBe('https://editor.example');
    expect(local.allowOrigin).toBe('http://localhost:5189');
  });

  it.each([
    '*',
    'file:///C:/editor',
    'https://editor.example/path',
    'https://user:secret@editor.example',
    'https://editor.example,',
  ])('rejects malformed configured origin %s', (configured) => {
    expect(() => createCorsOptions({ [CORS_ORIGINS_VARIABLE]: configured })).toThrow(CORS_ORIGINS_VARIABLE);
  });
});
