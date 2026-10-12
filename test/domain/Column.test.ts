import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Column, DEFAULT_COLUMN_COLOR } from '../../src/domain/model/Column.ts';
import { Task } from '../../src/domain/model/Task.ts';
import { T0 } from '../doubles/BoardFixture.ts';

describe('Column', () => {
  it('usa color por defecto y sin límite WIP', () => {
    const snapshot = Column.create('c', { name: 'Ideas' }).toSnapshot();
    assert.equal(snapshot.color, DEFAULT_COLUMN_COLOR);
    assert.equal(snapshot.wipLimit, null);
  });

  it('valida el color y el límite WIP', () => {
    assert.throws(() => Column.create('c', { name: 'X', color: 'rojo' }), /#RRGGBB/);
    assert.throws(() => Column.create('c', { name: 'X', wipLimit: 0 }), /entero entre 1/);
    assert.throws(() => Column.create('c', { name: 'X', wipLimit: 2.5 }), /entero entre 1/);
  });

  it('actualiza parcialmente y permite quitar el límite WIP', () => {
    const column = Column.create('c', { name: 'X', color: '#112233', wipLimit: 3 });
    column.update({ wipLimit: null });
    assert.deepEqual(column.toSnapshot(), { id: 'c', name: 'X', color: '#112233', wipLimit: null, tasks: [] });
  });

  it('detecta cuando se supera el límite WIP', () => {
    const column = Column.create('c', { name: 'X', wipLimit: 1 });
    column.insertTask(Task.create('t1', { title: 'a' }, T0));
    assert.equal(column.isOverWipLimit(), false);
    column.insertTask(Task.create('t2', { title: 'b' }, T0));
    assert.equal(column.isOverWipLimit(), true);
  });

  it('acota la posición de inserción al rango válido', () => {
    const column = Column.create('c', { name: 'X' });
    column.insertTask(Task.create('t1', { title: 'a' }, T0), 99);
    column.insertTask(Task.create('t2', { title: 'b' }, T0), -5);
    assert.deepEqual(column.toSnapshot().tasks.map((t) => t.id), ['t2', 't1']);
  });
});
