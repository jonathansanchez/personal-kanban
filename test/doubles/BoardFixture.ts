import { Board } from '../../src/domain/model/Board.ts';
import { Column } from '../../src/domain/model/Column.ts';
import { Task, type NewTaskData } from '../../src/domain/model/Task.ts';

export const T0 = new Date('2026-01-15T10:00:00.000Z');

/**
 * Builder de tableros para tests (patrón Test Data Builder).
 * Hace que cada test exprese solo los datos que le importan.
 *
 *   const board = aBoard().withColumn('todo', 'Por hacer', [{ title: 'A' }]).build();
 */
export class BoardBuilder {
  readonly #columns: Array<{ id: string; name: string; tasks: Array<NewTaskData & { id?: string }> }> = [];
  #taskCounter = 0;

  withColumn(id: string, name: string, tasks: Array<NewTaskData & { id?: string }> = []): this {
    this.#columns.push({ id, name, tasks });
    return this;
  }

  build(): Board {
    const board = Board.create('Tablero de prueba', T0);
    for (const col of this.#columns) {
      board.addColumn(Column.create(col.id, { name: col.name }));
      for (const data of col.tasks) {
        this.#taskCounter += 1;
        const id = data.id ?? `${col.id}-t${this.#taskCounter}`;
        board.addTask(col.id, Task.create(id, data, T0));
      }
    }
    return board;
  }
}

export const aBoard = (): BoardBuilder => new BoardBuilder();

/** Títulos por columna: facilita aserciones legibles. */
export function titlesByColumn(board: Board): Record<string, string[]> {
  return Object.fromEntries(board.toSnapshot().columns.map((c) => [c.name, c.tasks.map((t) => t.title)]));
}
