'use strict';

/**
 * Proceso principal de Electron. No reimplementa el servidor: busca un
 * Node >=22.18 instalado en el sistema (el mismo requisito que ya tiene
 * el proyecto para `npm start`), lanza src/main.ts como hijo con ese
 * binario, y abre una ventana nativa que apunta a él. El binario de
 * Electron se usa solo para la ventana, nunca para ejecutar el TS del
 * servidor: Electron empaqueta Node versions más viejas que no soportan
 * ejecutar .ts de forma nativa (type-stripping, estable desde Node 22.18).
 */
const { app, BrowserWindow, dialog } = require('electron');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const PORT = process.env.PORT || '3000';
const HOST = '127.0.0.1';
const SERVER_URL = `http://${HOST}:${PORT}`;
const PROJECT_ROOT = path.join(__dirname, '..');
const MIN_NODE = [22, 18, 0];

let serverProcess = null;
let mainWindow = null;

function parseVersion(text) {
  const match = /v?(\d+)\.(\d+)\.(\d+)/.exec(text);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function meetsMinimum(version) {
  for (let i = 0; i < MIN_NODE.length; i += 1) {
    if (version[i] > MIN_NODE[i]) return true;
    if (version[i] < MIN_NODE[i]) return false;
  }
  return true;
}

function candidateNodePaths() {
  const home = os.homedir();
  const candidates = ['node'];
  for (const dir of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']) {
    candidates.push(path.join(dir, 'node'));
  }
  const nvmDir = path.join(home, '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmDir)) {
    for (const entry of fs.readdirSync(nvmDir)) {
      candidates.push(path.join(nvmDir, entry, 'bin', 'node'));
    }
  }
  const voltaNode = path.join(home, '.volta', 'bin', 'node');
  candidates.push(voltaNode);
  return candidates;
}

function resolveNodeBinary() {
  let best = null;
  for (const candidate of candidateNodePaths()) {
    try {
      const output = execFileSync(candidate, ['--version'], { encoding: 'utf8' });
      const version = parseVersion(output);
      if (version && meetsMinimum(version)) {
        if (!best || version.join('.') > best.version.join('.')) {
          best = { bin: candidate, version };
        }
      }
    } catch {
      // candidato no existe o no es ejecutable; se prueba el siguiente
    }
  }
  return best ? best.bin : null;
}

function startServer(nodeBinary) {
  const dataFile = path.join(app.getPath('userData'), 'board.json');
  serverProcess = spawn(
    nodeBinary,
    [path.join(PROJECT_ROOT, 'src', 'main.ts')],
    {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PORT,
        HOST,
        DATA_FILE: dataFile,
      },
      stdio: 'inherit',
    },
  );

  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (code !== 0 && mainWindow) {
      app.quit();
    }
  });
}

function waitForServer(url, onReady) {
  const retry = () => setTimeout(() => waitForServer(url, onReady), 200);
  const req = http.get(url, (res) => {
    res.resume();
    onReady();
  });
  req.on('error', retry);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    title: 'Kanban',
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(SERVER_URL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(() => {
  const nodeBinary = resolveNodeBinary();
  if (!nodeBinary) {
    dialog.showErrorBox(
      'Node.js no encontrado',
      'Esta app necesita Node.js >=22.18 instalado en el sistema para arrancar el servidor. ' +
        'Instálalo desde https://nodejs.org y vuelve a abrir la app.',
    );
    app.quit();
    return;
  }

  startServer(nodeBinary);
  waitForServer(SERVER_URL, createWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', stopServer);
app.on('will-quit', stopServer);
