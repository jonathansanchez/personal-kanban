import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

export interface StaticFile {
  content: Buffer;
  contentType: string;
}

/** Sirve la interfaz web (carpeta public/) evitando salir de ella. */
export class StaticFiles {
  private readonly root: string;

  constructor(root: string) {
    this.root = normalize(root);
  }

  async resolve(urlPath: string): Promise<StaticFile | null> {
    const relative = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
    const fullPath = normalize(join(this.root, relative));
    if (fullPath !== this.root && !fullPath.startsWith(this.root + sep)) return null; // path traversal
    try {
      const content = await readFile(fullPath);
      return { content, contentType: CONTENT_TYPES[extname(fullPath)] ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }
}
