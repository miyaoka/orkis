import { contextBridge, ipcRenderer } from "electron";

const api = {
  ping: () => ipcRenderer.send("ping"),
};

contextBridge.exposeInMainWorld("api", api);
