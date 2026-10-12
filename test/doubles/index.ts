/**
 * Test doubles (vocabulario de Gerard Meszaros, "xUnit Test Patterns"):
 *
 *  - Dummy: se pasa solo para completar parámetros; falla si alguien lo usa.
 *  - Stub:  devuelve respuestas preparadas (reloj fijo, ids predecibles).
 *  - Spy:   registra cómo fue llamado para verificarlo después.
 *  - Fake:  implementación funcional pero simplificada (repositorio en memoria).
 *  - Mock:  doble con expectativas sobre las llamadas; aquí usamos `mock.fn()`
 *           de node:test directamente en los tests.
 */
import type { BoardRepository } from '../../src/application/ports/out/BoardRepository.ts';
import type { Clock } from '../../src/application/ports/out/Clock.ts';
import type { IdGenerator } from '../../src/application/ports/out/IdGenerator.ts';
import { Board, type BoardSnapshot } from '../../src/domain/model/Board.ts';

// ---------- Fake ----------

/**
 * Repositorio en memoria. Guarda una COPIA (snapshot) para comportarse como
 * una persistencia real: modificar el objeto después de guardar no altera
 * lo almacenado, y cada load() devuelve una instancia nueva.
 */
export class InMemoryBoardRepository implements BoardRepository {
  #stored: BoardSnapshot | null;

  constructor(initial: Board | null = null) {
    this.#stored = initial ? structuredClone(initial.toSnapshot()) : null;
  }

  async load(): Promise<Board | null> {
    return this.#stored ? Board.fromSnapshot(structuredClone(this.#stored)) : null;
  }

  async save(board: Board): Promise<void> {
    this.#stored = structuredClone(board.toSnapshot());
  }

  /** Acceso directo para aserciones. */
  get stored(): BoardSnapshot | null {
    return this.#stored;
  }
}

// ---------- Spy ----------

/** Envuelve otro repositorio y registra cada llamada. */
export class SpyBoardRepository implements BoardRepository {
  readonly calls: Array<'load' | 'save'> = [];
  readonly savedSnapshots: BoardSnapshot[] = [];
  private readonly inner: BoardRepository;

  constructor(inner: BoardRepository) {
    this.inner = inner;
  }

  load(): Promise<Board | null> {
    this.calls.push('load');
    return this.inner.load();
  }

  save(board: Board): Promise<void> {
    this.calls.push('save');
    this.savedSnapshots.push(board.toSnapshot());
    return this.inner.save(board);
  }

  get saveCount(): number {
    return this.calls.filter((c) => c === 'save').length;
  }
}

// ---------- Stubs ----------

/** Reloj detenido en un instante conocido; se puede adelantar a mano. */
export class FixedClock implements Clock {
  #now: Date;

  constructor(iso = '2026-01-15T10:00:00.000Z') {
    this.#now = new Date(iso);
  }

  now(): Date {
    return new Date(this.#now);
  }

  advance(ms: number): void {
    this.#now = new Date(this.#now.getTime() + ms);
  }
}

/** Genera ids predecibles: "id-1", "id-2", ... */
export class SequentialIdGenerator implements IdGenerator {
  #counter = 0;
  private readonly prefix: string;

  constructor(prefix = 'id') {
    this.prefix = prefix;
  }

  next(): string {
    this.#counter += 1;
    return `${this.prefix}-${this.#counter}`;
  }
}

// ---------- Dummies ----------

/** Lanza un error si se usa: demuestra que un camino NO toca el repositorio. */
export const dummyRepository: BoardRepository = {
  load: () => {
    throw new Error('El repositorio dummy no debería usarse');
  },
  save: () => {
    throw new Error('El repositorio dummy no debería usarse');
  },
};

export const dummyIds: IdGenerator = {
  next: () => {
    throw new Error('El generador de ids dummy no debería usarse');
  },
};
