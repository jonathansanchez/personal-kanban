import { ValidationError } from '../errors.ts';

/**
 * Guardas reutilizables por las entidades. Reciben `unknown` porque los datos
 * pueden venir de cualquier adaptador (HTTP, archivo JSON, etc.).
 */

export function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`El campo "${field}" debe ser texto`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`El campo "${field}" no puede estar vacío`);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(`El campo "${field}" admite como máximo ${maxLength} caracteres`);
  }
  return trimmed;
}

export function optionalText(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new ValidationError(`El campo "${field}" debe ser texto`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`El campo "${field}" admite como máximo ${maxLength} caracteres`);
  }
  return trimmed;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de calendario en formato YYYY-MM-DD, o null. */
export function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw new ValidationError(`El campo "${field}" debe tener el formato AAAA-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`El campo "${field}" no es una fecha válida`);
  }
  return value;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function hexColor(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new ValidationError('El color debe tener el formato #RRGGBB');
  }
  return value.toLowerCase();
}

export function optionalPositiveInt(value: unknown, field: string, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw new ValidationError(`El campo "${field}" debe ser un entero entre 1 y ${max}`);
  }
  return value;
}

export function tagList(value: unknown, maxTags: number, maxLength: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ValidationError('Las etiquetas deben ser una lista de textos');
  }
  const tags: string[] = [];
  for (const raw of value) {
    const tag = requireText(raw, 'etiqueta', maxLength).toLowerCase();
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > maxTags) {
    throw new ValidationError(`Se admiten como máximo ${maxTags} etiquetas`);
  }
  return tags;
}

/** Normaliza una posición de inserción al rango [0, length]. */
export function clampPosition(position: unknown, length: number): number {
  if (typeof position !== 'number' || !Number.isFinite(position)) return length;
  return Math.max(0, Math.min(Math.trunc(position), length));
}
