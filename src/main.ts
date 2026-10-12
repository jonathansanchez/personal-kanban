/**
 * Composition root: el ÚNICO lugar donde se eligen implementaciones concretas
 * y se conectan con los puertos. Cambiar el almacenamiento (p. ej. a Redis)
 * consiste en crear otro adaptador que implemente BoardRepository y
 * cambiar una línea aquí.
 */
import { fileURLToPath } from 'node:url';
import { BoardController } from './adapters/in/http/BoardController.ts';
import { createHttpServer } from './adapters/in/http/HttpServer.ts';
import { Router } from './adapters/in/http/Router.ts';
import { StaticFiles } from './adapters/in/http/StaticFiles.ts';
import { JsonFileBoardRepository } from './adapters/out/persistence/JsonFileBoardRepository.ts';
import { CryptoIdGenerator } from './adapters/out/system/CryptoIdGenerator.ts';
import { SystemClock } from './adapters/out/system/SystemClock.ts';
import { SerialQueue, SerializedUseCase } from './application/decorators/SerializedUseCase.ts';
import type { BoardUseCases, UseCase } from './application/ports/in/BoardUseCases.ts';
import {
  CreateColumn,
  DeleteColumn,
  MoveColumn,
  SortColumn,
  UpdateColumn,
} from './application/usecases/ColumnUseCases.ts';
import { GetBoard } from './application/usecases/GetBoard.ts';
import { InitializeBoard } from './application/usecases/InitializeBoard.ts';
import { CreateTask, DeleteTask, MoveTask, UpdateTask } from './application/usecases/TaskUseCases.ts';
import { DueDateOrdering, PriorityOrdering } from './domain/services/TaskOrdering.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '127.0.0.1';
const DATA_FILE = process.env.DATA_FILE ?? fileURLToPath(new URL('../data/board.json', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

// --- Adaptadores de salida ---
const repository = new JsonFileBoardRepository(DATA_FILE);
const ids = new CryptoIdGenerator();
const clock = new SystemClock();

// --- Casos de uso (serializados para evitar escrituras concurrentes) ---
const queue = new SerialQueue();
const serialized = <I, O>(useCase: UseCase<I, O>): UseCase<I, O> => new SerializedUseCase(useCase, queue);

const useCases: BoardUseCases = {
  getBoard: serialized(new GetBoard(repository)),
  createColumn: serialized(new CreateColumn(repository, ids, clock)),
  updateColumn: serialized(new UpdateColumn(repository, clock)),
  deleteColumn: serialized(new DeleteColumn(repository, clock)),
  moveColumn: serialized(new MoveColumn(repository, clock)),
  sortColumn: serialized(new SortColumn(repository, clock, [new PriorityOrdering(), new DueDateOrdering()])),
  createTask: serialized(new CreateTask(repository, ids, clock)),
  updateTask: serialized(new UpdateTask(repository, clock)),
  moveTask: serialized(new MoveTask(repository, clock)),
  deleteTask: serialized(new DeleteTask(repository, clock)),
};

// --- Adaptador de entrada ---
const router = new BoardController(useCases).register(new Router());
const server = createHttpServer(router, new StaticFiles(PUBLIC_DIR));

await new InitializeBoard(repository, ids, clock).execute();

server.listen(PORT, HOST, () => {
  console.log(`\n  Tablero listo en http://localhost:${PORT}`);
  console.log(`  Datos guardados en ${DATA_FILE}\n`);
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
