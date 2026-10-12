import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { DomainError, NotFoundError, ValidationError } from '../../../domain/errors.ts';
import type { HttpResponse, Router } from './Router.ts';
import type { StaticFiles } from './StaticFiles.ts';

const MAX_BODY_BYTES = 1_000_000;

export interface Logger {
  error(message: string, error?: unknown): void;
}

class BadRequest extends Error {}

/** Traduce errores de dominio a respuestas HTTP. */
export function toErrorResponse(error: unknown, logger: Logger): HttpResponse {
  if (error instanceof ValidationError || error instanceof BadRequest) {
    return { status: 400, body: { error: error.message } };
  }
  if (error instanceof NotFoundError) return { status: 404, body: { error: error.message } };
  if (error instanceof DomainError) return { status: 422, body: { error: error.message } };
  logger.error('Error inesperado', error);
  return { status: 500, body: { error: 'Error interno del servidor' } };
}

/**
 * Crea el servidor HTTP. Recibe sus colaboradores ya construidos
 * (inyección de dependencias), de modo que en los tests se puede usar un
 * Router con casos de uso falsos.
 */
export function createHttpServer(router: Router, staticFiles: StaticFiles | null, logger: Logger = console): Server {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const match = router.match(req.method ?? 'GET', url.pathname);
        if (!match) return send(res, { status: 404, body: { error: 'Ruta no encontrada' } });
        const body = await readJsonBody(req);
        const response = await match.handler({ params: match.params, query: url.searchParams, body });
        return send(res, response);
      }
      const file = req.method === 'GET' && staticFiles ? await staticFiles.resolve(url.pathname) : null;
      if (!file) return send(res, { status: 404, body: { error: 'No encontrado' } });
      res.writeHead(200, { 'Content-Type': file.contentType, 'Cache-Control': 'no-cache' });
      res.end(file.content);
    } catch (error) {
      send(res, toErrorResponse(error, logger));
    }
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'DELETE') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BadRequest('El cuerpo de la petición es demasiado grande');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BadRequest('El cuerpo de la petición no es JSON válido');
  }
}

function send(res: ServerResponse, response: HttpResponse): void {
  const payload = response.body === undefined ? '' : JSON.stringify(response.body);
  res.writeHead(response.status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}
