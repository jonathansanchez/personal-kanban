import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_COLUMNS, InitializeBoard } from '../../src/application/usecases/InitializeBoard.ts';
import { GetBoard } from '../../src/application/usecases/GetBoard.ts';
import { NotFoundError } from '../../src/domain/errors.ts';
import { aBoard } from '../doubles/BoardFixture.ts';
import {
  FixedClock,
  InMemoryBoardRepository,
  SequentialIdGenerator,
  SpyBoardRepository,
  dummyIds,
} from '../doubles/index.ts';

describe('InitializeBoard', () => {
  it('crea el tablero con las columnas por defecto cuando no existe', async () => {
    const repository = new SpyBoardRepository(new InMemoryBoardRepository());
    const useCase = new InitializeBoard(repository, new SequentialIdGenerator('col'), new FixedClock());

    const view = await useCase.execute();

    assert.deepEqual(view.columns.map((c) => c.name), DEFAULT_COLUMNS.map((c) => c.name));
    assert.deepEqual(view.columns.map((c) => c.id), ['col-1', 'col-2', 'col-3']);
    assert.equal(repository.saveCount, 1);
  });

  it('no sobrescribe un tablero existente (ni genera ids)', async () => {
    const existing = aBoard().withColumn('mine', 'Mi columna').build();
    const repository = new SpyBoardRepository(new InMemoryBoardRepository(existing));
    // dummyIds: si el caso de uso intentara crear columnas, el test fallaría
    const useCase = new InitializeBoard(repository, dummyIds, new FixedClock());

    const view = await useCase.execute();

    assert.deepEqual(view.columns.map((c) => c.name), ['Mi columna']);
    assert.deepEqual(repository.calls, ['load']);
  });
});

describe('GetBoard', () => {
  it('devuelve la vista del tablero', async () => {
    const repository = new InMemoryBoardRepository(aBoard().withColumn('a', 'A', [{ title: 'x' }]).build());
    const view = await new GetBoard(repository).execute();
    assert.equal(view.columns[0]?.tasks[0]?.title, 'x');
  });

  it('falla con NotFoundError si el tablero no fue inicializado', async () => {
    await assert.rejects(new GetBoard(new InMemoryBoardRepository()).execute(), NotFoundError);
  });
});
