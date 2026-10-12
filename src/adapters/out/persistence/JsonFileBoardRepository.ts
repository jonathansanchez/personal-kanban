import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BoardRepository } from '../../../application/ports/out/BoardRepository.ts';
import { Board, type BoardSnapshot } from '../../../domain/model/Board.ts';

/**
 * Adaptador de salida: guarda el tablero completo en un archivo JSON.
 *
 * - Escritura atómica: escribe en un archivo temporal y luego lo renombra,
 *   así un corte a mitad de escritura nunca deja el JSON corrupto.
 * - Las escrituras se encadenan para que no se solapen.
 */
export class JsonFileBoardRepository implements BoardRepository {
  private readonly filePath: string;
  #pendingWrite: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<Board | null> {
    await this.#pendingWrite;
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    let snapshot: BoardSnapshot;
    try {
      snapshot = JSON.parse(raw) as BoardSnapshot;
    } catch {
      throw new Error(`El archivo ${this.filePath} no contiene JSON válido`);
    }
    return Board.fromSnapshot(snapshot);
  }

  save(board: Board): Promise<void> {
    const json = `${JSON.stringify(board.toSnapshot(), null, 2)}\n`;
    const write = this.#pendingWrite.then(() => this.#writeAtomically(json));
    this.#pendingWrite = write.catch(() => undefined);
    return write;
  }

  async #writeAtomically(content: string): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, content, 'utf8');
    await rename(tempPath, this.filePath);
  }
}
