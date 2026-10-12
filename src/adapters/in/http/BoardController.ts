import type { BoardUseCases, BoardView } from '../../../application/ports/in/BoardUseCases.ts';
import { ValidationError } from '../../../domain/errors.ts';
import type { HttpResponse, Router } from './Router.ts';

/**
 * Adaptador de entrada HTTP: traduce peticiones REST a comandos de los
 * casos de uso. No contiene reglas de negocio; solo adapta formatos.
 *
 *   GET    /api/board
 *   POST   /api/columns                     { name, color?, wipLimit? }
 *   PATCH  /api/columns/:columnId           { name?, color?, wipLimit? }
 *   DELETE /api/columns/:columnId?moveTasksTo=<columnId>
 *   PUT    /api/columns/:columnId/position  { position }
 *   POST   /api/columns/:columnId/sort      { by: "priority" | "dueDate" }
 *   POST   /api/columns/:columnId/tasks     { title, description?, priority?, dueDate?, tags? }
 *   PATCH  /api/tasks/:taskId               { ...cambios }
 *   PUT    /api/tasks/:taskId/move          { columnId, position? }
 *   DELETE /api/tasks/:taskId
 */
export class BoardController {
  private readonly useCases: BoardUseCases;

  constructor(useCases: BoardUseCases) {
    this.useCases = useCases;
  }

  register(router: Router): Router {
    const uc = this.useCases;
    return router
      .add('GET', '/api/board', async () => ok(await uc.getBoard.execute()))
      .add('POST', '/api/columns', async ({ body }) => {
        const data = asObject(body);
        return created(await uc.createColumn.execute({
          name: data.name,
          ...pick(data, 'color', 'wipLimit'),
          position: optionalNumber(data.position),
        }));
      })
      .add('PATCH', '/api/columns/:columnId', async ({ params, body }) =>
        ok(await uc.updateColumn.execute({
          columnId: params.columnId as string,
          changes: pick(asObject(body), 'name', 'color', 'wipLimit'),
        })),
      )
      .add('DELETE', '/api/columns/:columnId', async ({ params, query }) =>
        ok(await uc.deleteColumn.execute({
          columnId: params.columnId as string,
          moveTasksTo: query.get('moveTasksTo') || null,
        })),
      )
      .add('PUT', '/api/columns/:columnId/position', async ({ params, body }) =>
        ok(await uc.moveColumn.execute({
          columnId: params.columnId as string,
          position: requireNumber(asObject(body).position, 'position'),
        })),
      )
      .add('POST', '/api/columns/:columnId/sort', async ({ params, body }) =>
        ok(await uc.sortColumn.execute({
          columnId: params.columnId as string,
          by: String(asObject(body).by ?? ''),
        })),
      )
      .add('POST', '/api/columns/:columnId/tasks', async ({ params, body }) => {
        const data = asObject(body);
        return created(await uc.createTask.execute({
          columnId: params.columnId as string,
          title: data.title,
          ...pick(data, 'description', 'priority', 'dueDate', 'tags'),
          position: optionalNumber(data.position),
        }));
      })
      .add('PATCH', '/api/tasks/:taskId', async ({ params, body }) =>
        ok(await uc.updateTask.execute({
          taskId: params.taskId as string,
          changes: pick(asObject(body), 'title', 'description', 'priority', 'dueDate', 'tags'),
        })),
      )
      .add('PUT', '/api/tasks/:taskId/move', async ({ params, body }) => {
        const data = asObject(body);
        if (typeof data.columnId !== 'string' || !data.columnId) {
          throw new ValidationError('Falta "columnId" de destino');
        }
        return ok(await uc.moveTask.execute({
          taskId: params.taskId as string,
          toColumnId: data.columnId,
          position: optionalNumber(data.position),
        }));
      })
      .add('DELETE', '/api/tasks/:taskId', async ({ params }) =>
        ok(await uc.deleteTask.execute({ taskId: params.taskId as string })),
      );
  }
}

// ----- utilidades de adaptación -----

const ok = (body: BoardView): HttpResponse => ({ status: 200, body });
const created = (body: BoardView): HttpResponse => ({ status: 201, body });

function asObject(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('El cuerpo de la petición debe ser un objeto JSON');
  }
  return body as Record<string, unknown>;
}

/** Copia solo las claves presentes (para distinguir "no enviado" de "null"). */
function pick(source: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) if (key in source) result[key] = source[key];
  return result;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function requireNumber(value: unknown, field: string): number {
  const number = optionalNumber(value);
  if (number === undefined) throw new ValidationError(`"${field}" debe ser un número`);
  return number;
}

