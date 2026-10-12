/** Petición ya interpretada, independiente de node:http. */
export interface HttpRequest {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

export interface HttpResponse {
  status: number;
  body?: unknown;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type Handler = (request: HttpRequest) => Promise<HttpResponse>;

interface Route {
  method: HttpMethod;
  segments: string[];
  handler: Handler;
}

export interface RouteMatch {
  handler: Handler;
  params: Record<string, string>;
}

/** Enrutador mínimo con parámetros del tipo /api/tasks/:taskId. */
export class Router {
  readonly #routes: Route[] = [];

  add(method: HttpMethod, pattern: string, handler: Handler): this {
    this.#routes.push({ method, segments: split(pattern), handler });
    return this;
  }

  match(method: string, path: string): RouteMatch | null {
    const segments = split(path);
    for (const route of this.#routes) {
      if (route.method !== method || route.segments.length !== segments.length) continue;
      const params: Record<string, string> = {};
      const matches = route.segments.every((expected, i) => {
        const actual = segments[i] as string;
        if (expected.startsWith(':')) {
          params[expected.slice(1)] = decodeURIComponent(actual);
          return true;
        }
        return expected === actual;
      });
      if (matches) return { handler: route.handler, params };
    }
    return null;
  }
}

function split(path: string): string[] {
  return path.split('/').filter(Boolean);
}
