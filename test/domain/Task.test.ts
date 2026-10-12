import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ValidationError } from '../../src/domain/errors.ts';
import { Task } from '../../src/domain/model/Task.ts';
import { T0 } from '../doubles/BoardFixture.ts';

describe('Task', () => {
  describe('create', () => {
    it('aplica valores por defecto y normaliza los datos', () => {
      const task = Task.create('t1', { title: '  Comprar pan  ', tags: ['Casa', 'casa', ' Compras '] }, T0);

      assert.deepEqual(task.toSnapshot(), {
        id: 't1',
        title: 'Comprar pan',
        description: '',
        priority: 'medium',
        dueDate: null,
        tags: ['casa', 'compras'],
        createdAt: T0.toISOString(),
        updatedAt: T0.toISOString(),
      });
    });

    it('rechaza un título vacío', () => {
      assert.throws(() => Task.create('t1', { title: '   ' }, T0), ValidationError);
    });

    it('rechaza un título que no es texto', () => {
      assert.throws(() => Task.create('t1', { title: 42 }, T0), /debe ser texto/);
    });

    it('rechaza una prioridad desconocida', () => {
      assert.throws(() => Task.create('t1', { title: 'A', priority: 'critica' }, T0), /Prioridad inválida/);
    });

    it('rechaza fechas con formato o valor inválido', () => {
      assert.throws(() => Task.create('t1', { title: 'A', dueDate: '15/01/2026' }, T0), /AAAA-MM-DD/);
      assert.throws(() => Task.create('t1', { title: 'A', dueDate: '2026-02-30' }, T0), /no es una fecha válida/);
    });

    it('acepta una fecha límite válida', () => {
      const task = Task.create('t1', { title: 'A', dueDate: '2026-02-28' }, T0);
      assert.equal(task.dueDate, '2026-02-28');
    });
  });

  describe('update', () => {
    it('modifica solo los campos enviados y actualiza updatedAt', () => {
      const task = Task.create('t1', { title: 'A', description: 'detalle', priority: 'low' }, T0);
      const later = new Date(T0.getTime() + 60_000);

      task.update({ priority: 'urgent' }, later);

      const snapshot = task.toSnapshot();
      assert.equal(snapshot.priority, 'urgent');
      assert.equal(snapshot.title, 'A');
      assert.equal(snapshot.description, 'detalle');
      assert.equal(snapshot.updatedAt, later.toISOString());
      assert.equal(snapshot.createdAt, T0.toISOString());
    });

    it('permite quitar la fecha límite enviando null', () => {
      const task = Task.create('t1', { title: 'A', dueDate: '2026-03-01' }, T0);
      task.update({ dueDate: null }, T0);
      assert.equal(task.dueDate, null);
    });

    it('es atómico: si un campo es inválido no cambia ninguno', () => {
      const task = Task.create('t1', { title: 'Original' }, T0);

      assert.throws(() => task.update({ title: 'Nuevo', priority: 'xx' }, T0), ValidationError);
      assert.equal(task.title, 'Original');
    });
  });

  it('toSnapshot devuelve una copia que no expone el estado interno', () => {
    const task = Task.create('t1', { title: 'A', tags: ['x'] }, T0);
    task.toSnapshot().tags.push('hackeado');
    assert.deepEqual(task.toSnapshot().tags, ['x']);
  });

  it('fromSnapshot rechaza datos persistidos corruptos', () => {
    const valid = Task.create('t1', { title: 'A' }, T0).toSnapshot();
    assert.throws(() => Task.fromSnapshot({ ...valid, id: '' }), /sin id/);
    assert.throws(() => Task.fromSnapshot({ ...valid, createdAt: 'ayer' }), /fecha de creación inválida/);
  });
});
