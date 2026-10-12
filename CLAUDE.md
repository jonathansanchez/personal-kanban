# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Requires Node.js >= 22.18 (runs TypeScript natively via `node`, no build step, no runtime dependencies).

```bash
npm start                           # run the server at http://localhost:3000
npm run dev                         # same, restarts on file change (node --watch)
npm test                            # run all tests (node:test)
npm run test:coverage               # tests with coverage (--experimental-test-coverage)
npm run typecheck                   # tsc type-check only (noEmit); requires `npm install` first
node --test test/domain/Board.test.ts   # run a single test file
node --test --test-name-pattern="moves a task" test/application/TaskUseCases.test.ts  # single test by name
```

Env vars: `PORT` (3000), `HOST` (127.0.0.1), `DATA_FILE` (./data/board.json).

## Architecture

Hexagonal architecture (ports & adapters), dependencies always point inward. `src/main.ts` is the
composition root — the only file that wires concrete adapters to use cases.

```
adapters/in/http (Router, BoardController, HttpServer, StaticFiles)
          │  calls ports/in (use case interfaces + commands)
          ▼
application/usecases  (one class per use case, e.g. CreateTask, MoveTask)
          │  operates on
          ▼
domain/model  (Board aggregate root, Column, Task, Priority) + domain/services (TaskOrdering)
          │  use cases depend on ports/out interfaces, not concrete adapters
          ▼
adapters/out  (JsonFileBoardRepository, CryptoIdGenerator, SystemClock)
```

- `domain/` has zero dependencies on Node, HTTP, or disk — pure business rules, tested without doubles.
- `application/ports/out` defines `BoardRepository`, `IdGenerator`, `Clock` — tiny, single-method
  interfaces (ISP). Each use case constructor takes only the ports it actually needs.
- `application/decorators/SerializedUseCase` wraps a use case to serialize concurrent writes
  (e.g. prevents two simultaneous moves from racing on the JSON file) without changing the use case
  itself — Open/Closed in practice.
- `Board` is the aggregate root: all mutations (moving tasks, reordering columns, enforcing WIP
  limits) go through `Board` methods, not by poking `Column`/`Task` directly.
- Swapping persistence (e.g. to Redis) means writing one new `BoardRepository` implementation and
  changing one line in `main.ts`; use case tests are unaffected since they run against an in-memory
  fake.

### Request flow example

`PUT /api/tasks/:id/move` → `BoardController` builds a `MoveTaskCommand` → `MoveTask.execute()` loads
the board via `BoardRepository` → `board.moveTask()` applies the domain rule → repository saves →
controller returns the full updated board view.

## Testing conventions

Tests mirror the architecture layers under `test/`: `test/domain` (no doubles — pure code),
`test/application` (use cases isolated with doubles), `test/adapters` (controller with faked use
cases, HTTP server, JSON repository against a temp dir).

Test doubles live in `test/doubles/` (dummies, stubs like `FixedClock`/`SequentialIdGenerator`,
spies like `SpyBoardRepository`, the `InMemoryBoardRepository` fake, and `node:test`'s `mock.fn()`).
`test/doubles/BoardFixture.ts` provides a test data builder (`aBoard().withColumn(...)`) so tests
declare only the data they care about.

## Frontend

`public/` is a plain HTML/CSS/JS frontend (no build step, no framework) served by `StaticFiles`. It
talks to the REST API described in README.md (`/api/board`, `/api/columns`, `/api/tasks`, etc.) and
re-renders the full board on every response.
