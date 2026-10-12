import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import {
  CreateColumn,
  DeleteColumn,
  MoveColumn,
  SortColumn,
  UpdateColumn,
} from '../../src/application/usecases/ColumnUseCases.ts';
import { ValidationError } from '../../src/domain/errors.ts';
import type { TaskOrdering } from '../../src/domain/services/TaskOrdering.ts';
import { aBoard } from '../doubles/BoardFixture.ts';
import {
  FixedClock,
  InMemoryBoardRepository,
  SequentialIdGenerator,
  SpyBoardRepository,
  dummyRepository,
} from '../doubles/index.ts';

describe('Casos de uso de columnas', () => {
  let fake: InMemoryBoardRepository;
  let repository: SpyBoardRepository;
  let clock: FixedClock;

  beforeEach(() => {
    fake = new InMemoryBoardRepository(
      aBoard()
        .withColumn('todo', 'Por hacer', [{ title: 'a' }, { title: 'b' }])
        .withColumn('done', 'Hecho')
        .build(),
    );
    repository = new SpyBoardRepository(fake);
    clock = new FixedClock('2026-05-01T12:00:00.000Z');
  });

  describe('CreateColumn', () => {
    it('crea la columna con id generado, la persiste y marca la fecha', async () => {
      const useCase = new CreateColumn(repository, new SequentialIdGenerator('col'), clock);

      const view = await useCase.execute({ name: 'Ideas', color: '#9333EA', wipLimit: 3 });

      assert.deepEqual(view.columns.at(-1), { id: 'col-1', name: 'Ideas', color: '#9333ea', wipLimit: 3, tasks: [] });
      assert.equal(view.updatedAt, '2026-05-01T12:00:00.000Z');
      assert.deepEqual(repository.calls, ['load', 'save']);
    });

    it('no guarda nada si la regla de dominio falla', async () => {
      const useCase = new CreateColumn(repository, new SequentialIdGenerator(), clock);

      await assert.rejects(useCase.execute({ name: 'hecho' }), ValidationError);

      assert.equal(repository.saveCount, 0);
    });
  });

  describe('UpdateColumn', () => {
    it('renombra y cambia el color', async () => {
      const view = await new UpdateColumn(repository, clock).execute({
        columnId: 'todo',
        changes: { name: 'Pendiente', color: '#000000' },
      });
      assert.equal(view.columns[0]?.name, 'Pendiente');
      assert.equal(fake.stored?.columns[0]?.color, '#000000');
    });
  });

  describe('DeleteColumn', () => {
    it('mueve las tareas a otra columna antes de eliminarla', async () => {
      const view = await new DeleteColumn(repository, clock).execute({ columnId: 'todo', moveTasksTo: 'done' });
      assert.deepEqual(view.columns.map((c) => [c.name, c.tasks.length]), [['Hecho', 2]]);
    });
  });

  describe('MoveColumn', () => {
    it('cambia el orden de las columnas', async () => {
      const view = await new MoveColumn(repository, clock).execute({ columnId: 'done', position: 0 });
      assert.deepEqual(view.columns.map((c) => c.id), ['done', 'todo']);
    });
  });

  describe('SortColumn', () => {
    it('usa la estrategia elegida por su clave (verificado con un mock)', async () => {
      // Mock: una estrategia cuyo compare registramos y controlamos.
      const compare = mock.fn((a: { title: string }, b: { title: string }) => b.title.localeCompare(a.title));
      const reverseAlphabetical: TaskOrdering = { key: 'reverse', compare };
      const useCase = new SortColumn(repository, clock, [reverseAlphabetical]);

      const view = await useCase.execute({ columnId: 'todo', by: 'reverse' });

      assert.ok(compare.mock.callCount() > 0, 'la estrategia debía ser invocada');
      assert.deepEqual(view.columns[0]?.tasks.map((t) => t.title), ['b', 'a']);
    });

    it('rechaza un criterio desconocido sin tocar el repositorio (dummy)', async () => {
      const useCase = new SortColumn(dummyRepository, clock, []);
      await assert.rejects(useCase.execute({ columnId: 'todo', by: 'color' }), /Criterio de orden desconocido/);
    });
  });
});
