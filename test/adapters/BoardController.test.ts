import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { BoardController } from '../../src/adapters/in/http/BoardController.ts';
import { Router, type HttpRequest } from '../../src/adapters/in/http/Router.ts';
import type { BoardUseCases, BoardView } from '../../src/application/ports/in/BoardUseCases.ts';
import { ValidationError } from '../../src/domain/errors.ts';

const VIEW: BoardView = { version: 1, title: 'T', updatedAt: '2026-01-01T00:00:00.000Z', columns: [] };

/**
 * Mocks de todos los casos de uso: el controlador solo debe traducir HTTP a
 * comandos, así que verificamos con qué argumentos llama a cada uno.
 */
function mockUseCases() {
  const fn = () => mock.fn(async (_input?: unknown) => VIEW);
  return {
    getBoard: { execute: fn() },
    createColumn: { execute: fn() },
    updateColumn: { execute: fn() },
    deleteColumn: { execute: fn() },
    moveColumn: { execute: fn() },
    sortColumn: { execute: fn() },
    createTask: { execute: fn() },
    updateTask: { execute: fn() },
    moveTask: { execute: fn() },
    deleteTask: { execute: fn() },
  } satisfies BoardUseCases;
}

describe('BoardController', () => {
  let useCases: ReturnType<typeof mockUseCases>;
  let router: Router;

  /** Simula una petición sin levantar un servidor. */
  async function call(method: string, path: string, body?: unknown) {
    const [pathname, search = ''] = path.split('?');
    const match = router.match(method, pathname as string);
    assert.ok(match, `no hay ruta para ${method} ${path}`);
    const request: HttpRequest = { params: match.params, query: new URLSearchParams(search), body };
    return match.handler(request);
  }

  beforeEach(() => {
    useCases = mockUseCases();
    router = new BoardController(useCases).register(new Router());
  });

  it('GET /api/board devuelve 200 con la vista', async () => {
    const response = await call('GET', '/api/board');
    assert.deepEqual(response, { status: 200, body: VIEW });
    assert.equal(useCases.getBoard.execute.mock.callCount(), 1);
  });

  it('POST /api/columns traduce el cuerpo a un comando y responde 201', async () => {
    const response = await call('POST', '/api/columns', { name: 'Ideas', color: '#ff0000', extra: 'ignorado' });

    assert.equal(response.status, 201);
    assert.deepEqual(useCases.createColumn.execute.mock.calls[0]?.arguments[0], {
      name: 'Ideas',
      color: '#ff0000',
      position: undefined,
    });
  });

  it('PATCH /api/columns/:id envía solo los campos presentes', async () => {
    await call('PATCH', '/api/columns/c1', { wipLimit: null });
    assert.deepEqual(useCases.updateColumn.execute.mock.calls[0]?.arguments[0], {
      columnId: 'c1',
      changes: { wipLimit: null },
    });
  });

  it('DELETE /api/columns/:id lee moveTasksTo desde la query', async () => {
    await call('DELETE', '/api/columns/c1?moveTasksTo=c2');
    assert.deepEqual(useCases.deleteColumn.execute.mock.calls[0]?.arguments[0], { columnId: 'c1', moveTasksTo: 'c2' });
  });

  it('PUT /api/columns/:id/position exige un número', async () => {
    await assert.rejects(call('PUT', '/api/columns/c1/position', { position: 'dos' }), ValidationError);
    assert.equal(useCases.moveColumn.execute.mock.callCount(), 0);
  });

  it('POST /api/columns/:id/tasks crea la tarea en esa columna', async () => {
    await call('POST', '/api/columns/c1/tasks', { title: 'X', priority: 'high', position: 0 });
    assert.deepEqual(useCases.createTask.execute.mock.calls[0]?.arguments[0], {
      columnId: 'c1',
      title: 'X',
      priority: 'high',
      position: 0,
    });
  });

  it('PUT /api/tasks/:id/move valida la columna destino', async () => {
    await assert.rejects(call('PUT', '/api/tasks/t1/move', {}), /columnId/);
    await call('PUT', '/api/tasks/t1/move', { columnId: 'c2', position: 3 });
    assert.deepEqual(useCases.moveTask.execute.mock.calls[0]?.arguments[0], {
      taskId: 't1',
      toColumnId: 'c2',
      position: 3,
    });
  });

  it('decodifica los parámetros de la URL', async () => {
    await call('DELETE', '/api/tasks/con%20espacio');
    assert.deepEqual(useCases.deleteTask.execute.mock.calls[0]?.arguments[0], { taskId: 'con espacio' });
  });

  it('rechaza cuerpos que no son objetos', async () => {
    await assert.rejects(call('PATCH', '/api/tasks/t1', ['no', 'objeto']), /objeto JSON/);
  });
});
