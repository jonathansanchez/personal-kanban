import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { JsonFileBoardRepository } from '../../src/adapters/out/persistence/JsonFileBoardRepository.ts';
import { aBoard } from '../doubles/BoardFixture.ts';

/*
 * Test del adaptador contra el sistema de archivos real (en un directorio
 * temporal): es la única forma honesta de comprobar que el JSON se escribe
 * y se lee bien. Sigue siendo rápido y aislado.
 */
describe('JsonFileBoardRepository', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kanban-test-'));
    file = join(dir, 'nested', 'board.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('devuelve null si el archivo aún no existe', async () => {
    assert.equal(await new JsonFileBoardRepository(file).load(), null);
  });

  it('guarda y vuelve a cargar el mismo tablero (creando carpetas)', async () => {
    const repository = new JsonFileBoardRepository(file);
    const board = aBoard().withColumn('a', 'A', [{ title: 'x', priority: 'urgent', tags: ['t'] }]).build();

    await repository.save(board);
    const loaded = await new JsonFileBoardRepository(file).load();

    assert.deepEqual(loaded?.toSnapshot(), board.toSnapshot());
  });

  it('escribe JSON legible y no deja archivos temporales', async () => {
    await new JsonFileBoardRepository(file).save(aBoard().withColumn('a', 'A').build());

    const content = await readFile(file, 'utf8');
    assert.match(content, /\n {2}"title": "Tablero de prueba"/);
    assert.deepEqual(await readdir(join(dir, 'nested')), ['board.json']);
  });

  it('serializa escrituras concurrentes: gana la última', async () => {
    const repository = new JsonFileBoardRepository(file);
    const boards = ['Uno', 'Dos', 'Tres'].map((name) => aBoard().withColumn('c', name).build());

    await Promise.all(boards.map((b) => repository.save(b)));

    const loaded = await repository.load();
    assert.equal(loaded?.toSnapshot().columns[0]?.name, 'Tres');
  });

  it('informa claramente si el archivo está corrupto', async () => {
    await new JsonFileBoardRepository(file).save(aBoard().build());
    await writeFile(file, '{ esto no es json', 'utf8');

    await assert.rejects(new JsonFileBoardRepository(file).load(), /no contiene JSON válido/);
  });
});
