/*
 * Gestión de temas visuales de la interfaz.
 *
 * Módulo independiente y sin estado compartido con el resto de la app: solo
 * conoce el elemento raíz del documento (para aplicar `data-theme`) y
 * `localStorage` (para recordar la elección). No importa nada de app.js ni
 * de la API — cualquier otra pantalla de configuración podría reutilizarlo
 * tal cual, y se puede probar o sustituir sin tocar el resto de la interfaz.
 */

/** Catálogo de temas disponibles. `preview` son los colores que se muestran
 *  como miniatura en el selector (fondo y acento). */
export const THEMES = [
  { id: 'system', name: 'Automático', description: 'Sigue el tema del sistema', preview: ['#e7ebf0', '#11161c'] },
  { id: 'light', name: 'Claro', description: 'Fondo gris claro, alto contraste', preview: ['#e7ebf0', '#3557d6'] },
  { id: 'dark', name: 'Oscuro', description: 'Fondo oscuro, ideal de noche', preview: ['#11161c', '#6f8cf5'] },
  { id: 'pastel', name: 'Pastel Dream', description: 'Degradado lila y rosa, estética soñadora', preview: ['#ffd6ec', '#b185f5'] },
  { id: 'sunset', name: 'Retro Sunset', description: 'Degradado durazno y violeta, estética retro', preview: ['#ffb199', '#6a4c93'] },
];

const STORAGE_KEY = 'kanban-theme';
const VALID_IDS = new Set(THEMES.map((theme) => theme.id));

function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return VALID_IDS.has(value) ? value : null;
  } catch {
    return null; // almacenamiento no disponible (modo privado, etc.)
  }
}

function writeStoredTheme(id) {
  try {
    if (id === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignorar: sin persistencia no pasa nada grave */
  }
}

/** Tema elegido explícitamente por quien usa la app, o `'system'` si ninguno. */
export function getActiveTheme() {
  return readStoredTheme() ?? 'system';
}

/** Aplica y recuerda un tema. Un id desconocido se trata como `'system'`. */
export function applyTheme(id) {
  const theme = VALID_IDS.has(id) ? id : 'system';
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  writeStoredTheme(theme);
}

/** Aplica el tema recordado (si hay uno) al cargar la página. */
export function initTheme() {
  const stored = readStoredTheme();
  if (stored) document.documentElement.dataset.theme = stored;
}
