import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundError, ValidationError } from '../../src/domain/errors.ts';
import { BOARD_LIMITS, Board } from '../../src/domain/model/Board.ts';
import { Column } from '../../src/domain/model/Column.ts';
import { Task } from '../../src/domain/model/Task.ts';
import { PriorityOrdering } from '../../src/domain/services/TaskOrdering.ts';
import { T0, aBoard, titlesByColumn } from '../doubles/BoardFixture.ts';

describe('Board', () => {
  describe('columnas', () => {
    it('agrega columnas al final o en una posición dada', () => {
      const board = aBoard().withColumn('a', 'A').withColumn('b', 'B').build();

      board.addColumn(Column.create('c', { name: 'C' }), 1);

      assert.deepEqual(board.toSnapshot().columns.map((c) => c.name), ['A', 'C', 'B']);
    });

    it('no permite nombres repetidos (sin distinguir mayúsculas)', () => {
      const board = aBoard().withColumn('a', 'Por hacer').build();
      assert.throws(() => board.addColumn(Column.create('b', { name: 'POR HACER' })), /Ya existe una columna/);
    });

    it('permite renombrar una columna con su mismo nombre en otra capitalización', () => {
      const board = aBoard().withColumn('a', 'hecho').build();
      board.updateColumn('a', { name: 'Hecho' });
      assert.equal(board.getColumn('a').name, 'Hecho');
    });

    it('no permite renombrar con el nombre de otra columna', () => {
      const board = aBoard().withColumn('a', 'A').withColumn('b', 'B').build();
      assert.throws(() => board.updateColumn('b', { name: 'a' }), ValidationError);
    });

    it(`limita el tablero a ${BOARD_LIMITS.columns} columnas`, () => {
      const board = Board.create('T', T0);
      for (let i = 0; i < BOARD_LIMITS.columns; i++) board.addColumn(Column.create(`c${i}`, { name: `C${i}` }));
      assert.throws(() => board.addColumn(Column.create('extra', { name: 'Extra' })), /como máximo/);
    });

    it('reordena columnas', () => {
      const board = aBoard().withColumn('a', 'A').withColumn('b', 'B').withColumn('c', 'C').build();
      board.moveColumn('c', 0);
      assert.deepEqual(board.toSnapshot().columns.map((c) => c.id), ['c', 'a', 'b']);
    });

    it('lanza NotFoundError con una columna inexistente', () => {
      const board = aBoard().build();
      assert.throws(() => board.getColumn('nope'), NotFoundError);
    });
  });

  describe('eliminar columna', () => {
    it('mueve sus tareas al final de la columna destino', () => {
      const board = aBoard()
        .withColumn('a', 'A', [{ title: 'a1' }, { title: 'a2' }])
        .withColumn('b', 'B', [{ title: 'b1' }])
        .build();

      board.removeColumn('a', 'b');

      assert.deepEqual(titlesByColumn(board), { B: ['b1', 'a1', 'a2'] });
    });

    it('elimina las tareas si no se indica destino', () => {
      const board = aBoard().withColumn('a', 'A', [{ title: 'a1' }]).withColumn('b', 'B').build();
      board.removeColumn('a');
      assert.deepEqual(titlesByColumn(board), { B: [] });
    });

    it('no modifica nada si la columna destino no existe', () => {
      const board = aBoard().withColumn('a', 'A', [{ title: 'a1' }]).build();
      assert.throws(() => board.removeColumn('a', 'zzz'), NotFoundError);
      assert.deepEqual(titlesByColumn(board), { A: ['a1'] });
    });

    it('no permite usar la misma columna como destino', () => {
      const board = aBoard().withColumn('a', 'A').build();
      assert.throws(() => board.removeColumn('a', 'a'), /misma columna/);
    });
  });

  describe('tareas', () => {
    it('mueve una tarea entre columnas en la posición indicada', () => {
      const board = aBoard()
        .withColumn('todo', 'Todo', [{ id: 't1', title: 'Uno' }])
        .withColumn('done', 'Done', [{ title: 'X' }, { title: 'Y' }])
        .build();

      board.moveTask('t1', 'done', 1);

      assert.deepEqual(titlesByColumn(board), { Todo: [], Done: ['X', 'Uno', 'Y'] });
    });

    it('reordena dentro de la misma columna', () => {
      const board = aBoard()
        .withColumn('a', 'A', [{ id: 't1', title: '1' }, { title: '2' }, { title: '3' }])
        .build();
      board.moveTask('t1', 'a', 2);
      assert.deepEqual(titlesByColumn(board), { A: ['2', '3', '1'] });
    });

    it('no pierde la tarea si la columna destino no existe', () => {
      const board = aBoard().withColumn('a', 'A', [{ id: 't1', title: '1' }]).build();
      assert.throws(() => board.moveTask('t1', 'nope'), NotFoundError);
      assert.deepEqual(titlesByColumn(board), { A: ['1'] });
    });

    it('no admite dos tareas con el mismo id', () => {
      const board = aBoard().withColumn('a', 'A', [{ id: 't1', title: '1' }]).withColumn('b', 'B').build();
      assert.throws(() => board.addTask('b', Task.create('t1', { title: 'dup' }, T0)), /Ya existe una tarea/);
    });

    it('elimina una tarea', () => {
      const board = aBoard().withColumn('a', 'A', [{ id: 't1', title: '1' }]).build();
      board.removeTask('t1');
      assert.throws(() => board.locateTask('t1'), NotFoundError);
    });

    it('ordena una columna con la estrategia recibida', () => {
      const board = aBoard()
        .withColumn('a', 'A', [
          { title: 'baja', priority: 'low' },
          { title: 'urgente', priority: 'urgent' },
          { title: 'media', priority: 'medium' },
        ])
        .build();
      board.sortColumn('a', new PriorityOrdering());
      assert.deepEqual(titlesByColumn(board), { A: ['urgente', 'media', 'baja'] });
    });
  });

  describe('snapshots', () => {
    it('se reconstruye idéntico desde su snapshot', () => {
      const board = aBoard().withColumn('a', 'A', [{ title: 'x', tags: ['t'] }]).build();
      const copy = Board.fromSnapshot(board.toSnapshot());
      assert.deepEqual(copy.toSnapshot(), board.toSnapshot());
    });

    it('rechaza ids duplicados en datos persistidos', () => {
      const snapshot = aBoard().withColumn('a', 'A').withColumn('b', 'B').build().toSnapshot();
      snapshot.columns[1]!.id = 'a';
      snapshot.columns[1]!.name = 'Otra';
      assert.throws(() => Board.fromSnapshot(snapshot), /Id duplicado/);
    });

    it('rechaza estructuras inválidas', () => {
      assert.throws(() => Board.fromSnapshot({} as never), /formato inválido/);
    });
  });
});
