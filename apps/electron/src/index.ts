import { app, shell, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pty from "node-pty";

const ptys = new Map<number, pty.IPty>();
let nextPtyId = 0;

function setupPtyHandlers() {
  ipcMain.handle("pty:spawn", (event, cols: number, rows: number) => {
    const id = nextPtyId++;
    const shell = process.env.SHELL ?? "zsh";
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.env.HOME,
      env: process.env as Record<string, string>,
    });

    ptys.set(id, ptyProcess);

    ptyProcess.onData((data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:data", id, data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      ptys.delete(id);
      if (!event.sender.isDestroyed()) {
        event.sender.send("pty:exit", id, exitCode);
      }
    });

    return id;
  });

  ipcMain.on("pty:write", (_event, id: number, data: string) => {
    ptys.get(id)?.write(data);
  });

  ipcMain.on("pty:resize", (_event, id: number, cols: number, rows: number) => {
    ptys.get(id)?.resize(cols, rows);
  });

  ipcMain.on("pty:kill", (_event, id: number) => {
    ptys.get(id)?.kill();
    ptys.delete(id);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: fileURLToPath(import.meta.resolve("@orkis/preload")),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.resolve(import.meta.dirname, "../../renderer/dist/index.html"));
  }
}

void app.whenReady().then(() => {
  setupPtyHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  for (const p of ptys.values()) {
    p.kill();
  }
  ptys.clear();
});
