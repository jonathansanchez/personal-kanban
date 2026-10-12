import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import type { BoardRepository } from '../../src/application/ports/out/BoardRepository.ts';
import { CreateTask, DeleteTask, MoveTask, UpdateTask } from '../../src/application/usecases/TaskUseCases.ts';
import { NotFoundError, ValidationError } from '../../src/domain/errors.ts';
import { aBoard } from '../doubles/BoardFixture.ts';
import { FixedClock, InMemoryBoardRepository, SequentialIdGenerator, SpyBoardRepository } from '../doubles/index.ts';

describe('Casos de uso de tareas', () => {
  let fake: InMemoryBoardRepository;
  let repository: SpyBoardRepository;
  let clock: FixedClock;

  beforeEach(() => {
    fake = new InMemoryBoardRepository(
      aBoard()
        .withColumn('todo', 'Por hacer', [{ id: 't1', title: 'Existente', priority: 'low' }])
        .withColumn('done', 'Hecho')
        .build(),
    );
    repository = new SpyBoardRepository(fake);
    clock = new FixedClock('2026-05-01T12:00:00.000Z');
  });

  describe('CreateTask', () => {
    it('crea la tarea con id y fecha proporcionados por los puertos', async () => {
      const useCase = new CreateTask(repository, new SequentialIdGenerator('task'), clock);

      const view = await useCase.execute({ columnId: 'done', title: 'Nueva', priority: 'high', tags: ['Trabajo'] });

      const created = view.columns[1]?.tasks[0];
      assert.equal(created?.id, 'task-1');
      assert.equal(created?.priority, 'high');
      assert.deepEqual(created?.tags, ['trabajo']);
      assert.equal(created?.createdAt, '2026-05-01T12:00:00.000Z');
      assert.equal(repository.saveCount, 1);
    });

    it('inserta en la posición pedida', async () => {
      const useCase = new CreateTask(repository, new SequentialIdGenerator(), clock);
      const view = await useCase.execute({ columnId: 'todo', title: 'Primera', position: 0 });
      assert.deepEqual(view.columns[0]?.tasks.map((t) => t.title), ['Primera', 'Existente']);
    });

    it('no consume ids ni guarda si la columna no existe', async () => {
      const ids = { next: mock.fn(() => 'x') }; // mock: verificamos que NO se llame
      const useCase = new CreateTask(repository, ids, clock);

      await assert.rejects(useCase.execute({ columnId: 'nope', title: 'X' }), NotFoundError);

      assert.equal(ids.next.mock.callCount(), 0);
      assert.equal(repository.saveCount, 0);
    });
  });

  describe('UpdateTask', () => {
    it('actualiza los campos y deja intacto el resto', async () => {
      clock.advance(60_000);
      const view = await new UpdateTask(repository, clock).execute({
        taskId: 't1',
        changes: { priority: 'urgent', dueDate: '2026-06-01' },
      });
      const task = view.columns[0]?.tasks[0];
      assert.equal(task?.title, 'Existente');
      assert.equal(task?.priority, 'urgent');
      assert.equal(task?.dueDate, '2026-06-01');
      assert.equal(task?.updatedAt, '2026-05-01T12:01:00.000Z');
    });

    it('propaga errores de validación y no persiste', async () => {
      await assert.rejects(
        new UpdateTask(repository, clock).execute({ taskId: 't1', changes: { title: '' } }),
        ValidationError,
      );
      assert.equal(fake.stored?.columns[0]?.tasks[0]?.title, 'Existente');
      assert.equal(repository.saveCount, 0);
    });
  });

  describe('MoveTask', () => {
    it('mueve la tarea a otra columna', async () => {
      const view = await new MoveTask(repository, clock).execute({ taskId: 't1', toColumnId: 'done' });
      assert.deepEqual(view.columns.map((c) => c.tasks.length), [0, 1]);
    });
  });

  describe('DeleteTask', () => {
    it('elimina la tarea', async () => {
      await new DeleteTask(repository, clock).execute({ taskId: 't1' });
      assert.equal(fake.stored?.columns[0]?.tasks.length, 0);
    });

    it('lanza NotFoundError si la tarea no existe', async () => {
      await assert.rejects(new DeleteTask(repository, clock).execute({ taskId: 'nope' }), NotFoundError);
    });
  });

  it('propaga un fallo de persistencia (stub que falla al guardar)', async () => {
    const failing: BoardRepository = {
      load: () => fake.load(),
      save: () => Promise.reject(new Error('disco lleno')),
    };
    await assert.rejects(new DeleteTask(failing, clock).execute({ taskId: 't1' }), /disco lleno/);
  });
});
