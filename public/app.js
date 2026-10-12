/*
 * Interfaz web del tablero. Es otro "adaptador de entrada": solo habla con
 * la API REST y no conoce nada del dominio ni de la persistencia.
 */

import { THEMES, getActiveTheme, applyTheme, initTheme } from './theme.js';

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_LABEL = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };
const SWATCHES = ['#64748b', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#db2777'];

// ---------------- API ----------------

async function request(method, path, body) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Error ${response.status}`);
  return data;
}

const api = {
  getBoard: () => request('GET', '/board'),
  createColumn: (data) => request('POST', '/columns', data),
  updateColumn: (id, data) => request('PATCH', `/columns/${id}`, data),
  deleteColumn: (id, moveTasksTo) =>
    request('DELETE', `/columns/${id}${moveTasksTo ? `?moveTasksTo=${encodeURIComponent(moveTasksTo)}` : ''}`),
  moveColumn: (id, position) => request('PUT', `/columns/${id}/position`, { position }),
  sortColumn: (id, by) => request('POST', `/columns/${id}/sort`, { by }),
  createTask: (columnId, data) => request('POST', `/columns/${columnId}/tasks`, data),
  updateTask: (id, data) => request('PATCH', `/tasks/${id}`, data),
  moveTask: (id, columnId, position) => request('PUT', `/tasks/${id}/move`, { columnId, position }),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),
};

// ---------------- Estado ----------------

const state = {
  board: null,
  filter: { text: '', priorities: new Set() },
  refocusQuickAdd: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Ejecuta una llamada a la API, actualiza la vista y muestra errores. */
async function run(action, successMessage) {
  try {
    state.board = await action();
    render();
    if (successMessage) toast(successMessage);
    return true;
  } catch (error) {
    toast(error.message, 'error');
    await reload();
    return false;
  }
}

async function reload() {
  try {
    state.board = await api.getBoard();
    render();
  } catch (error) {
    $('#board').innerHTML = '';
    const p = document.createElement('p');
    p.className = 'loading';
    p.textContent = `No se pudo cargar el tablero: ${error.message}. ¿Está corriendo el servidor?`;
    $('#board').append(p);
  }
}

// ---------------- Utilidades de fechas ----------------

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dueInfo(dueDate) {
  const days = Math.round((Date.parse(dueDate) - Date.parse(todayIso())) / 86_400_000);
  const formatted = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${dueDate}T00:00:00Z`))
    .replace('.', '');
  if (days < 0) return { label: `Venció ${formatted}`, tone: 'overdue' };
  if (days === 0) return { label: 'Vence hoy', tone: 'soon' };
  if (days === 1) return { label: 'Mañana', tone: 'soon' };
  if (days <= 3) return { label: formatted, tone: 'soon' };
  return { label: formatted, tone: '' };
}

// ---------------- Render ----------------

function matchesFilter(task) {
  const { text, priorities } = state.filter;
  if (priorities.size > 0 && !priorities.has(task.priority)) return false;
  if (!text) return true;
  const query = text.toLowerCase();
  if (query.startsWith('#')) return task.tags.some((tag) => tag.startsWith(query.slice(1)));
  return (
    task.title.toLowerCase().includes(query) ||
    task.description.toLowerCase().includes(query) ||
    task.tags.some((tag) => tag.includes(query))
  );
}

function render() {
  const board = state.board;
  if (!board) return;

  document.title = board.title;
  $('#board-title').textContent = board.title;
  const all = board.columns.flatMap((c) => c.tasks);
  const urgent = all.filter((t) => t.priority === 'urgent').length;
  const overdue = all.filter((t) => t.dueDate && dueInfo(t.dueDate).tone === 'overdue').length;
  const parts = [`${all.length} ${all.length === 1 ? 'tarea' : 'tareas'}`];
  if (urgent) parts.push(`${urgent} ${urgent === 1 ? 'urgente' : 'urgentes'}`);
  if (overdue) parts.push(`${overdue} ${overdue === 1 ? 'vencida' : 'vencidas'}`);
  $('#board-meta').textContent = parts.join(', ');

  const container = $('#board');
  container.replaceChildren(...board.columns.map(renderColumn), renderAddColumnLane());

  if (state.refocusQuickAdd) {
    $(`.column[data-id="${state.refocusQuickAdd}"] .quick-add input`)?.focus();
    state.refocusQuickAdd = null;
  }
}

function renderColumn(column) {
  const el = $('#column-template').content.firstElementChild.cloneNode(true);
  el.dataset.id = column.id;
  $('.column-color', el).style.background = column.color;
  $('.column-name', el).textContent = column.name;
  $('.column-name', el).title = column.name;

  const count = column.tasks.length;
  $('.column-count', el).textContent = column.wipLimit ? `${count}/${column.wipLimit}` : String(count);
  if (column.wipLimit && count > column.wipLimit) {
    el.classList.add('over-wip');
    $('.column-count', el).title = 'Se superó el límite de tareas en curso';
  }

  renderMeter($('.meter', el), column.tasks);

  const list = $('.task-list', el);
  const visible = column.tasks.filter(matchesFilter);
  if (visible.length === 0) {
    const hint = document.createElement('li');
    hint.className = 'empty-hint';
    hint.textContent = column.tasks.length === 0 ? 'Arrastra tareas aquí o agrega una abajo' : 'Ninguna tarea coincide con el filtro';
    list.append(hint);
  }
  for (const task of visible) list.append(renderTask(task, column.id));

  $('.column-menu-btn', el).addEventListener('click', (event) => openColumnMenu(event.currentTarget, column));

  $('.quick-add', el).addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('input', event.currentTarget);
    const title = input.value.trim();
    if (!title) return openTaskDialog(null, column.id);
    state.refocusQuickAdd = column.id;
    run(() => api.createTask(column.id, { title }));
  });

  wireColumnDrag(el, column);
  return el;
}

function renderMeter(meter, tasks) {
  meter.replaceChildren();
  for (const priority of PRIORITY_ORDER) {
    const n = tasks.filter((t) => t.priority === priority).length;
    if (!n) continue;
    const span = document.createElement('span');
    span.style.flexGrow = String(n);
    span.style.background = `var(--p-${priority})`;
    meter.append(span);
  }
  meter.title = PRIORITY_ORDER.map((p) => `${PRIORITY_LABEL[p]}: ${tasks.filter((t) => t.priority === p).length}`).join('\n');
}

function renderTask(task, columnId) {
  const el = $('#task-template').content.firstElementChild.cloneNode(true);
  el.dataset.id = task.id;
  el.dataset.priority = task.priority;
  el.setAttribute('aria-label', `${task.title}. Prioridad ${PRIORITY_LABEL[task.priority]}`);
  $('.task-title', el).textContent = task.title;

  const meta = $('.task-meta', el);
  if (task.dueDate) {
    const { label, tone } = dueInfo(task.dueDate);
    const due = document.createElement('span');
    due.className = `due ${tone}`;
    due.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    due.append(label);
    meta.append(due);
  }
  for (const tag of task.tags) {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = `#${tag}`;
    meta.append(chip);
  }
  if (task.description) {
    const notes = document.createElement('span');
    notes.className = 'has-notes';
    notes.title = 'Tiene descripción';
    notes.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
    meta.append(notes);
  }

  el.addEventListener('click', () => openTaskDialog(task, columnId));
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') openTaskDialog(task, columnId);
  });
  wireTaskDrag(el, task);
  return el;
}

function renderAddColumnLane() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'add-column-lane';
  button.textContent = '+ Agregar columna';
  button.addEventListener('click', () => openColumnDialog(null));
  return button;
}

// ---------------- Drag & drop ----------------

let drag = null; // { type: 'task' | 'column', id }
const taskPlaceholder = Object.assign(document.createElement('li'), { className: 'placeholder' });
const columnPlaceholder = Object.assign(document.createElement('div'), { className: 'column-placeholder' });

function clearDragArtifacts() {
  taskPlaceholder.remove();
  columnPlaceholder.remove();
  $$('.dragging').forEach((el) => el.classList.remove('dragging'));
  $$('.drop-target').forEach((el) => el.classList.remove('drop-target'));
  $$('.empty-hint').forEach((el) => (el.hidden = false));
}

function wireTaskDrag(el, task) {
  el.addEventListener('dragstart', (event) => {
    event.stopPropagation();
    drag = { type: 'task', id: task.id };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
    requestAnimationFrame(() => el.classList.add('dragging'));
  });
  el.addEventListener('dragend', () => {
    drag = null;
    clearDragArtifacts();
  });
}

function wireColumnDrag(el, column) {
  const head = $('.column-head', el);
  head.addEventListener('dragstart', (event) => {
    drag = { type: 'column', id: column.id };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', column.id);
    requestAnimationFrame(() => el.classList.add('dragging'));
  });
  head.addEventListener('dragend', () => {
    drag = null;
    clearDragArtifacts();
  });

  // Soltar tareas en cualquier parte de la columna
  el.addEventListener('dragover', (event) => {
    if (drag?.type !== 'task') return;
    event.preventDefault();
    const list = $('.task-list', el);
    $$('.drop-target').forEach((x) => x !== list && x.classList.remove('drop-target'));
    list.classList.add('drop-target');
    $$('.empty-hint').forEach((hint) => (hint.hidden = hint.parentElement === list));
    const after = $$('.task:not(.dragging)', list).find((card) => {
      const box = card.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    if (after) list.insertBefore(taskPlaceholder, after);
    else list.append(taskPlaceholder);
  });

  el.addEventListener('drop', (event) => {
    if (drag?.type !== 'task') return;
    event.preventDefault();
    const taskId = drag.id;
    const position = dropPosition(column, taskId);
    clearDragArtifacts();
    moveTaskOptimistically(taskId, column.id, position);
  });
}

/** Traduce la posición visual (con filtros) a un índice real de la columna. */
function dropPosition(column, draggedId) {
  const ids = column.tasks.map((t) => t.id).filter((id) => id !== draggedId);
  let next = taskPlaceholder.nextElementSibling;
  while (next && !next.classList.contains('task')) next = next.nextElementSibling;
  if (next) return ids.indexOf(next.dataset.id);
  let prev = taskPlaceholder.previousElementSibling;
  while (prev && !prev.classList.contains('task')) prev = prev.previousElementSibling;
  if (prev) return ids.indexOf(prev.dataset.id) + 1;
  return ids.length;
}

function moveTaskOptimistically(taskId, toColumnId, position) {
  const board = state.board;
  const from = board.columns.find((c) => c.tasks.some((t) => t.id === taskId));
  const to = board.columns.find((c) => c.id === toColumnId);
  if (!from || !to) return;
  const index = from.tasks.findIndex((t) => t.id === taskId);
  if (from === to && (index === position)) return; // sin cambios
  const [task] = from.tasks.splice(index, 1);
  to.tasks.splice(position, 0, task);
  render();
  run(() => api.moveTask(taskId, toColumnId, position));
}

// Reordenar columnas
const boardEl = $('#board');
boardEl.addEventListener('dragover', (event) => {
  if (drag?.type !== 'column') return;
  event.preventDefault();
  const after = $$('.column:not(.dragging)', boardEl).find((col) => {
    const box = col.getBoundingClientRect();
    return event.clientX < box.left + box.width / 2;
  });
  if (after) boardEl.insertBefore(columnPlaceholder, after);
  else boardEl.insertBefore(columnPlaceholder, $('.add-column-lane', boardEl));
});
boardEl.addEventListener('drop', (event) => {
  if (drag?.type !== 'column') return;
  event.preventDefault();
  const columnId = drag.id;
  const before = [...boardEl.children].slice(0, [...boardEl.children].indexOf(columnPlaceholder));
  const position = before.filter((el) => el.classList.contains('column') && !el.classList.contains('dragging')).length;
  clearDragArtifacts();

  const columns = state.board.columns;
  const index = columns.findIndex((c) => c.id === columnId);
  if (index === position) return;
  const [moved] = columns.splice(index, 1);
  columns.splice(position, 0, moved);
  render();
  run(() => api.moveColumn(columnId, position));
});

// ---------------- Menú de columna ----------------

const menu = $('#column-menu');
let menuColumn = null;

function openColumnMenu(anchor, column) {
  menuColumn = column;
  menu.hidden = false;
  const box = anchor.getBoundingClientRect();
  const left = Math.min(box.left, window.innerWidth - menu.offsetWidth - 12);
  menu.style.left = `${Math.max(12, left)}px`;
  menu.style.top = `${box.bottom + 6}px`;
  $('button', menu).focus();
}

function closeMenu() {
  menu.hidden = true;
  menuColumn = null;
}

menu.addEventListener('click', (event) => {
  const action = event.target.closest('button')?.dataset.action;
  const column = menuColumn;
  closeMenu();
  if (!column || !action) return;
  if (action === 'edit') openColumnDialog(column);
  if (action === 'sort-priority') run(() => api.sortColumn(column.id, 'priority'), `"${column.name}" ordenada por prioridad`);
  if (action === 'sort-due') run(() => api.sortColumn(column.id, 'dueDate'), `"${column.name}" ordenada por fecha límite`);
  if (action === 'delete') openDeleteColumnDialog(column);
});
document.addEventListener('click', (event) => {
  if (!menu.hidden && !menu.contains(event.target) && !event.target.closest('.column-menu-btn')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !menu.hidden) closeMenu();
});
boardEl.addEventListener('scroll', closeMenu);

// ---------------- Diálogo de tarea ----------------

const taskDialog = $('#task-dialog');
const taskForm = $('#task-form');
let editing = null; // { task, columnId } — task null = crear

function openTaskDialog(task, columnId) {
  editing = { task, columnId };
  taskForm.reset();
  setFormError(taskForm, '');
  $('#task-dialog-title').textContent = task ? 'Editar tarea' : 'Nueva tarea';
  $('#task-submit').textContent = task ? 'Guardar cambios' : 'Crear tarea';
  const del = $('#delete-task');
  del.hidden = !task;
  del.textContent = 'Eliminar';
  delete del.dataset.confirm;

  const select = taskForm.elements.columnId;
  select.replaceChildren(...state.board.columns.map((c) => new Option(c.name, c.id)));
  select.value = columnId;

  taskForm.elements.title.value = task?.title ?? '';
  taskForm.elements.description.value = task?.description ?? '';
  taskForm.elements.priority.value = task?.priority ?? 'medium';
  taskForm.elements.dueDate.value = task?.dueDate ?? '';
  taskForm.elements.tags.value = task?.tags.join(', ') ?? '';
  taskDialog.showModal();
  taskForm.elements.title.focus();
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const f = taskForm.elements;
  const data = {
    title: f.title.value,
    description: f.description.value,
    priority: f.priority.value,
    dueDate: f.dueDate.value || null,
    tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
  };
  const targetColumn = f.columnId.value;
  try {
    if (!editing.task) {
      state.board = await api.createTask(targetColumn, data);
    } else {
      state.board = await api.updateTask(editing.task.id, data);
      if (targetColumn !== editing.columnId) {
        state.board = await api.moveTask(editing.task.id, targetColumn);
      }
    }
    taskDialog.close();
    render();
    toast(editing.task ? 'Cambios guardados' : 'Tarea creada');
  } catch (error) {
    setFormError(taskForm, error.message);
  }
});

$('#delete-task').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  if (!button.dataset.confirm) {
    button.dataset.confirm = 'true';
    button.textContent = '¿Seguro? Eliminar';
    return;
  }
  const { task } = editing;
  taskDialog.close();
  run(() => api.deleteTask(task.id), 'Tarea eliminada');
});

// ---------------- Diálogo de columna ----------------

const columnDialog = $('#column-dialog');
const columnForm = $('#column-form');
let editingColumn = null;
let selectedColor = SWATCHES[0];

function renderSwatches(current) {
  const container = $('#swatches');
  container.setAttribute('role', 'radiogroup');
  const isCustom = !SWATCHES.includes(current);
  const buttons = SWATCHES.map((color) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = color;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', color);
    b.setAttribute('aria-checked', String(color === current));
    b.addEventListener('click', () => selectColor(color));
    return b;
  });
  const custom = document.createElement('label');
  custom.className = 'swatch swatch-custom';
  custom.title = 'Color personalizado';
  custom.setAttribute('aria-checked', String(isCustom));
  if (isCustom) custom.style.background = current;
  const picker = Object.assign(document.createElement('input'), { type: 'color', value: current });
  picker.setAttribute('aria-label', 'Color personalizado');
  picker.addEventListener('input', () => selectColor(picker.value));
  custom.append(picker);
  container.replaceChildren(...buttons, custom);
}

function selectColor(color) {
  selectedColor = color.toLowerCase();
  renderSwatches(selectedColor);
}

function openColumnDialog(column) {
  editingColumn = column;
  columnForm.reset();
  setFormError(columnForm, '');
  $('#column-dialog-title').textContent = column ? 'Editar columna' : 'Nueva columna';
  $('#column-submit').textContent = column ? 'Guardar cambios' : 'Crear columna';
  columnForm.elements.name.value = column?.name ?? '';
  columnForm.elements.wipLimit.value = column?.wipLimit ?? '';
  selectColor(column?.color ?? SWATCHES[state.board.columns.length % SWATCHES.length]);
  columnDialog.showModal();
  columnForm.elements.name.focus();
}

columnForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const wip = columnForm.elements.wipLimit.value;
  const data = {
    name: columnForm.elements.name.value,
    color: selectedColor,
    wipLimit: wip === '' ? null : Number(wip),
  };
  try {
    state.board = editingColumn
      ? await api.updateColumn(editingColumn.id, data)
      : await api.createColumn(data);
    columnDialog.close();
    render();
    toast(editingColumn ? 'Columna actualizada' : 'Columna creada');
    if (!editingColumn) boardEl.scrollTo({ left: boardEl.scrollWidth, behavior: 'smooth' });
  } catch (error) {
    setFormError(columnForm, error.message);
  }
});

// ---------------- Eliminar columna ----------------

const deleteDialog = $('#delete-column-dialog');
const deleteForm = $('#delete-column-form');
let deletingColumn = null;

function openDeleteColumnDialog(column) {
  deletingColumn = column;
  $('#delete-column-title').textContent = `Eliminar "${column.name}"`;
  const body = $('#delete-column-body');
  body.replaceChildren();
  const count = column.tasks.length;
  const others = state.board.columns.filter((c) => c.id !== column.id);

  if (count === 0) {
    body.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'La columna está vacía.' }));
  } else {
    body.append(Object.assign(document.createElement('p'), {
      className: 'muted',
      textContent: `Tiene ${count} ${count === 1 ? 'tarea' : 'tareas'}. ¿Qué quieres hacer con ${count === 1 ? 'ella' : 'ellas'}?`,
    }));
    if (others.length) {
      const move = document.createElement('label');
      move.className = 'radio-line';
      move.innerHTML = '<input type="radio" name="fate" value="move" checked /> Moverlas a';
      const select = document.createElement('select');
      select.name = 'target';
      select.append(...others.map((c) => new Option(c.name, c.id)));
      move.append(select);
      body.append(move);
    }
    const drop = document.createElement('label');
    drop.className = 'radio-line';
    drop.innerHTML = `<input type="radio" name="fate" value="delete" ${others.length ? '' : 'checked'} /> Eliminarlas también`;
    body.append(drop);
  }
  deleteDialog.showModal();
}

deleteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const fate = deleteForm.elements.fate?.value;
  const target = fate === 'move' ? deleteForm.elements.target.value : null;
  const column = deletingColumn;
  deleteDialog.close();
  run(() => api.deleteColumn(column.id, target), `Columna "${column.name}" eliminada`);
});

// ---------------- Comunes ----------------

function setFormError(form, message) {
  const el = $('.form-error', form);
  el.textContent = message;
  el.hidden = !message;
}

$$('dialog [data-close]').forEach((button) =>
  button.addEventListener('click', () => button.closest('dialog').close()),
);
$$('dialog').forEach((dialog) =>
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // clic en el fondo
  }),
);

function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${kind === 'error' ? 'error' : ''}`;
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 5000 : 2200);
}

// Filtros
$('#search').addEventListener('input', (event) => {
  state.filter.text = event.target.value.trim();
  render();
});
$$('#priority-filter .chip').forEach((chip) =>
  chip.addEventListener('click', () => {
    const p = chip.dataset.priority;
    const set = state.filter.priorities;
    set.has(p) ? set.delete(p) : set.add(p);
    chip.setAttribute('aria-pressed', String(set.has(p)));
    render();
  }),
);

// ---------------- Configuración (temas) ----------------

const settingsDialog = $('#settings-dialog');

function renderThemeOptions() {
  const active = getActiveTheme();
  const container = $('#theme-options');
  container.replaceChildren(
    ...THEMES.map((theme) => {
      const el = $('#theme-option-template').content.firstElementChild.cloneNode(true);
      el.dataset.id = theme.id;
      el.setAttribute('aria-checked', String(theme.id === active));
      el.style.setProperty('--c1', theme.preview[0]);
      el.style.setProperty('--c2', theme.preview[1]);
      $('.theme-name', el).textContent = theme.name;
      $('.theme-desc', el).textContent = theme.description;
      el.addEventListener('click', () => {
        applyTheme(theme.id);
        renderThemeOptions();
      });
      return el;
    }),
  );
}

$('#open-settings').addEventListener('click', () => {
  renderThemeOptions();
  settingsDialog.showModal();
});

$('#add-column').addEventListener('click', () => openColumnDialog(null));

// Atajos: "/" buscar, "n" nueva tarea en la primera columna
document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, textarea, select, dialog') || event.metaKey || event.ctrlKey) return;
  if (event.key === '/') {
    event.preventDefault();
    $('#search').focus();
  } else if (event.key === 'n') {
    event.preventDefault();
    $('.quick-add input')?.focus();
  }
});

initTheme();
reload();
