import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SerialQueue, SerializedUseCase } from '../../src/application/decorators/SerializedUseCase.ts';
import type { UseCase } from '../../src/application/ports/in/BoardUseCases.ts';
import { CreateTask } from '../../src/application/usecases/TaskUseCases.ts';
import { aBoard } from '../doubles/BoardFixture.ts';
import { FixedClock, InMemoryBoardRepository, SequentialIdGenerator } from '../doubles/index.ts';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Repositorio lento: hace evidente la condición de carrera leer-modificar-guardar. */
class SlowRepository extends InMemoryBoardRepository {
  override async load() {
    const board = await super.load();
    await delay(5);
    return board;
  }
}

describe('SerializedUseCase', () => {
  it('ejecuta las llamadas de a una y en orden', async () => {
    const events: string[] = [];
    const recorder = (name: string, ms: number): UseCase<void, string> => ({
      async execute() {
        events.push(`inicio ${name}`);
        await delay(ms);
        events.push(`fin ${name}`);
        return name;
      },
    });
    const queue = new SerialQueue();
    const slow = new SerializedUseCase(recorder('A', 20), queue);
    const fast = new SerializedUseCase(recorder('B', 1), queue);

    const results = await Promise.all([slow.execute(), fast.execute()]);

    assert.deepEqual(results, ['A', 'B']);
    assert.deepEqual(events, ['inicio A', 'fin A', 'inicio B', 'fin B']);
  });

  it('un error no bloquea las siguientes llamadas', async () => {
    const queue = new SerialQueue();
    const failing = new SerializedUseCase<void, never>({ execute: () => Promise.reject(new Error('boom')) }, queue);
    const ok = new SerializedUseCase<void, string>({ execute: async () => 'ok' }, queue);

    await assert.rejects(failing.execute(), /boom/);
    assert.equal(await ok.execute(), 'ok');
  });

  it('evita perder tareas creadas en paralelo', async () => {
    const repository = new SlowRepository(aBoard().withColumn('todo', 'Todo').build());
    const createTask = new CreateTask(repository, new SequentialIdGenerator(), new FixedClock());
    const serialized = new SerializedUseCase(createTask, new SerialQueue());

    await Promise.all(['a', 'b', 'c'].map((title) => serialized.execute({ columnId: 'todo', title })));

    assert.equal(repository.stored?.columns[0]?.tasks.length, 3);
  });
});
