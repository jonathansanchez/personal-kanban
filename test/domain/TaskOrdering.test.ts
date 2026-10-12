import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Task } from '../../src/domain/model/Task.ts';
import { DueDateOrdering, PriorityOrdering } from '../../src/domain/services/TaskOrdering.ts';
import { T0 } from '../doubles/BoardFixture.ts';

const task = (title: string, priority: string, dueDate: string | null = null, minutes = 0): Task =>
  Task.create(title, { title, priority, dueDate }, new Date(T0.getTime() + minutes * 60_000));

const titles = (tasks: Task[]): string[] => tasks.map((t) => t.title);

describe('PriorityOrdering', () => {
  it('ordena por prioridad, luego por fecha límite (sin fecha al final) y luego por antigüedad', () => {
    const tasks = [
      task('media-sin-fecha', 'medium'),
      task('alta-tarde', 'high', '2026-03-10'),
      task('alta-pronto', 'high', '2026-02-01'),
      task('media-vieja', 'medium', null, -10),
      task('urgente', 'urgent'),
    ];

    tasks.sort((a, b) => new PriorityOrdering().compare(a, b));

    assert.deepEqual(titles(tasks), ['urgente', 'alta-pronto', 'alta-tarde', 'media-vieja', 'media-sin-fecha']);
  });
});

describe('DueDateOrdering', () => {
  it('ordena por fecha límite y desempata por prioridad', () => {
    const tasks = [
      task('sin-fecha', 'urgent'),
      task('marzo-baja', 'low', '2026-03-01'),
      task('marzo-alta', 'high', '2026-03-01'),
      task('febrero', 'low', '2026-02-01'),
    ];

    tasks.sort((a, b) => new DueDateOrdering().compare(a, b));

    assert.deepEqual(titles(tasks), ['febrero', 'marzo-alta', 'marzo-baja', 'sin-fecha']);
  });
});
