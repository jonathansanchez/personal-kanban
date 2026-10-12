import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it, mock } from 'node:test';
import { createHttpServer, toErrorResponse } from '../../src/adapters/in/http/HttpServer.ts';
import { Router } from '../../src/adapters/in/http/Router.ts';
import { NotFoundError, ValidationError } from '../../src/domain/errors.ts';

describe('HttpServer', () => {
  let server: Server;
  let baseUrl: string;
  const logger = { error: mock.fn() }; // spy: comprobamos que los errores 500 se registran

  before(async () => {
    // Stubs de handlers: cada ruta responde algo predefinido.
    const router = new Router()
      .add('POST', '/api/echo', async ({ body }) => ({ status: 200, body }))
      .add('GET', '/api/missing', async () => {
        throw new NotFoundError('No existe');
      })
      .add('GET', '/api/invalid', async () => {
        throw new ValidationError('Dato inválido');
      })
      .add('GET', '/api/crash', async () => {
        throw new Error('detalle interno');
      });
    server = createHttpServer(router, null, logger);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('parsea el cuerpo JSON y responde JSON', async () => {
    const response = await fetch(`${baseUrl}/api/echo`, { method: 'POST', body: JSON.stringify({ a: 1 }) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await response.json(), { a: 1 });
  });

  it('responde 400 si el JSON está mal formado', async () => {
    const response = await fetch(`${baseUrl}/api/echo`, { method: 'POST', body: '{malo' });
    assert.equal(response.status, 400);
  });

  it('traduce errores de dominio a 400 y 404', async () => {
    assert.equal((await fetch(`${baseUrl}/api/invalid`)).status, 400);
    const notFound = await fetch(`${baseUrl}/api/missing`);
    assert.equal(notFound.status, 404);
    assert.deepEqual(await notFound.json(), { error: 'No existe' });
  });

  it('oculta los detalles de errores inesperados y los registra', async () => {
    const response = await fetch(`${baseUrl}/api/crash`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Error interno del servidor' });
    assert.equal(logger.error.mock.callCount(), 1);
  });

  it('responde 404 para rutas inexistentes', async () => {
    assert.equal((await fetch(`${baseUrl}/api/nada`)).status, 404);
  });
});

describe('toErrorResponse', () => {
  it('mapea cada tipo de error a su código HTTP', () => {
    const silent = { error: () => {} };
    assert.equal(toErrorResponse(new ValidationError('x'), silent).status, 400);
    assert.equal(toErrorResponse(new NotFoundError('x'), silent).status, 404);
    assert.equal(toErrorResponse(new Error('x'), silent).status, 500);
  });
});
