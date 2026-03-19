# Astra Inter-Process Communication Analysis

## Executive Summary

Astra uses **Electron's IPC (ipcMain/ipcRenderer)** exclusively for inter-process communication. There are **no HTTP servers, WebSocket servers, or socket servers** exposed for external process communication. This is a significant limitation for VSCode extension integration.

---

## 1. Inter-Process Communication Mechanisms

### **Primary Mechanism: Electron IPC**

Astra's main-renderer communication is entirely built on Electron's `ipcMain` and `ipcRenderer` APIs:

**Main Process** (`src/main/index.ts`):
- Uses `ipcMain.handle()` for request-response IPC
- Uses `ipcMain.on()` for one-way messaging
- Controls via `mainWindow.webContents.send()` for broadcasting

**Renderer Process** (`src/preload/index.ts`):
- Exposed via `contextBridge.exposeInMainWorld('electronAPI', {...})`
- Uses `ipcRenderer.invoke()` for async requests
- Uses `ipcRenderer.send()` for fire-and-forget messages
- Uses `ipcRenderer.on()` for event subscriptions

### **Mini-Player Window Communication**

The mini-player uses the same IPC mechanism with dedicated channels:

```typescript
// Main process broadcasts to both windows
ipcMain.on('mini-player:publishSnapshot', (_event, snapshot: MiniPlayerSnapshot) => {
  latestMiniPlayerSnapshot = snapshot
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('mini-player:snapshot', snapshot)
  }
})

// Command routing between windows
ipcMain.on('mini-player:sendCommand', (_event, command: MiniPlayerCommand) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-player:command', command)
  }
})
```

**Key IPC Channels for Playback State:**
- `mini-player:snapshot` - Broadcasts playback state (track, position, etc.)
- `mini-player:publishSnapshot` - Updates playback snapshot
- `mini-player:sendCommand` - Sends playback commands (play, pause, next, etc.)
- `mini-player:windowState` - Window state changes

---

## 2. External Process Communication

### **Child Processes for Audio Processing**

Astra uses `execFile` to communicate with external binaries:

```typescript
import { execFile, type ExecFileOptions } from 'child_process'

// FFmpeg for audio decoding
async function decodeAudioWithFfmpeg(filePath: string): Promise<ArrayBuffer | null>

// FFprobe for audio metadata/codec detection
async function probeAudioMetadataWithFfprobe(filePath: string): Promise<FfprobeAudioMetadata | null>
```

**These are one-way executions**, not bidirectional communication.

### **Discord RPC (Modified Socket Connection)**

Astra connects to Discord via **OS-level sockets** (not standard HTTP):

```typescript
import { createConnection, Socket } from 'net'

// Windows: Named pipes
`\\.\pipe\discord-ipc-${index}`  // indices 0-9

// macOS/Linux: Unix sockets
`/tmp/discord-ipc-${index}`
`${tempdir()}/discord-ipc-${index}`
```

This is **not a server**—Astra is the **client** connecting to Discord's IPC endpoint. External processes cannot reverse-connect.

---

## 3. State Persistence & Database

### **SQLite Database Location**

```typescript
const userDataPath = app.getPath('userData')  // Electron's userData folder
dbPath = join(userDataPath, 'library.db')
artworkDir = join(userDataPath, 'artwork')
```

**Windows**: `%APPDATA%\AppData\Roaming\Astra\library.db`
**macOS**: `~/Library/Application Support/Astra/library.db`
**Linux**: `~/.config/Astra/library.db`

**Database is NOT exposed to external processes.**

### **Mini-Player Window Preferences**

```typescript
const PREFS_FILE_NAME = 'mini-player-window.json'
// Stored in: app.getPath('userData')/mini-player-window.json
```

---

## 4. Environment Variables

Only development-related variables:
```typescript
const isDev = process.env.NODE_ENV === 'development'

// For dev server in electron-vite
if (isDev && process.env['ELECTRON_RENDERER_URL']) {
  await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
}
```

**No IPC endpoint environment variables are exposed.**

---

## 5. Exposed API Surface (via contextBridge)

The preload script exposes `window.electronAPI` to the renderer:

### **Playback-Related (Mini Window API)**
```typescript
miniPlayer: {
  open(): Promise<void>
  close(): Promise<void>
  getWindowState(): Promise<MiniPlayerWindowState>
  toggleAlwaysOnTop(): Promise<MiniPlayerWindowState>
  getSnapshot(): Promise<MiniPlayerSnapshot | null>
  publishSnapshot(snapshot: MiniPlayerSnapshot): void
  sendCommand(command: MiniPlayerCommand): void
  onSnapshot(callback): () => void  // Subscribe
  onCommand(callback): () => void   // Subscribe
  onWindowState(callback): () => void
}
```

### **Library Access**
```typescript
library: {
  getTracks(): Promise<DbTrack[]>
  getTracksByArtist(artist): Promise<DbTrack[]>
  getTracksByAlbum(album, artist?): Promise<DbTrack[]>
  getArtists(): Promise<Artist[]>
  getAlbums(): Promise<Album[]>
  search(query): Promise<DbTrack[]>
  // ... and more
}
```

---

## 6. Critical Limitation: No External Access

### **Why VSCode Cannot Directly Access Astra's IPC:**

1. **Electron IPC is process-specific**: `ipcRenderer` only works within Electron renderer processes
2. **No HTTP/WebSocket API**: No exposed network endpoint for external communication
3. **IPC is sandboxed**: Cannot be accessed from Node.js processes (like VSCode extensions)
4. **No single-instance lock mechanism**: Astra doesn't explicitly prevent multiple instances, but there's no inter-instance communication protocol

### **What WOULD Be Needed:**

To make Astra accessible to VSCode, it would require:
- ✅ HTTP server listening on localhost (e.g., `:3000`)
- ✅ WebSocket server for real-time updates
- ✅ Unix socket/named pipe with a defined protocol
- ✅ At least a simple JSON-RPC API endpoint

**None of these currently exist in Astra.**

---

## 7. Alternative Integration Approaches

### **Option A: Direct Database Access (⚠️ Not Recommended)**

Read Astra's SQLite database directly:
```javascript
// VSCode extension code
const sqlite3 = require('sqlite3')
const path = require('path')
const userDataPath = require('os').homedir() + '/AppData/Roaming/Astra'
const db = new sqlite3.Database(path.join(userDataPath, 'library.db'))
```

**Risks:**
- Database locking issues (Astra writes while reading)
- No real-time playback state access
- Brittle to schema changes
- File path varies by OS

### **Option B: File System Watching**

Watch the mini-player preferences file for state changes:
```javascript
const fs = require('fs')
const path = require('path')

fs.watchFile(path.join(os.homedir(), 'AppData/Roaming/Astra/mini-player-window.json'), 
  (curr, prev) => {
    // React to window state changes
  }
)
```

**Limitations:**
- Only captures window state, not playback state
- High latency
- Not suitable for real-time sync

### **Option C: Patch Astra to Add API Server (Recommended)**

Add a simple HTTP server to Astra's main process:

```typescript
// In src/main/index.ts
import http from 'http'

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.url === '/api/playback') {
    res.writeHead(200)
    res.end(JSON.stringify(latestMiniPlayerSnapshot))
  }
})

server.listen(9999, '127.0.0.1')
```

**Benefits:**
- Standard HTTP protocol
- Easy for VSCode to consume
- Real-time with polling or WebSocket upgrade
- Backward compatible with Astra

### **Option D: VSCode Integration Package**

Create a native VSCode extension that:
1. Spawns/monitors the Astra process
2. Injects a communication bridge via IPC
3. Exposes Astra state to VSCode UI

Requires modifying Astra's build/packaging process.

---

## 8. Mini-Player Data Structure

For reference, here's the `MiniPlayerSnapshot` type (playback state):

```typescript
interface MiniPlayerSnapshot {
  // Track information
  trackPath?: string
  title?: string
  artist?: string
  album?: string
  duration?: number
  
  // Playback state
  isPlaying: boolean
  isPaused: boolean
  currentTime?: number
  
  // Other properties (from library)
  artwork?: string
  format?: string
  codec?: string
  // ... more metadata
}

interface MiniPlayerCommand {
  action: 'play' | 'pause' | 'next' | 'previous' | 'seek'
  value?: number  // For seek
}
```

*(Exact structure not fully exposed; reverse-engineer from IPC channel usage)*

---

## 9. Recommendations for VSCode Extension

### **Short Term (Without Modifying Astra):**
- Use **Option A** (direct SQLite access) for track metadata
- Use **Option B** (file watching) for window state changes
- Accept that real-time playback sync isn't feasible

### **Long Term (Best Practice):**
- **Contribute to Astra**: Add an optional `--api-server` flag
- Start a JSON-RPC 2.0 server on `127.0.0.1:19999`
- Provide WebSocket upgrade for real-time updates
- Maintain backward compatibility

### **JSON-RPC API Proposal:**

```json
// Request (polling)
{ "jsonrpc": "2.0", "id": 1, "method": "playback/getSnapshot" }

// Response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "isPlaying": true,
    "currentTime": 45.2,
    "duration": 242.5,
    "track": { "title": "...", "artist": "...", ... }
  }
}

// WebSocket: 
ws://127.0.0.1:19999/ws
// Subscribes to: playback.updated, track.changed, state.changed
```

---

## 10. Conclusion

**Astra is architecturally isolated for VSCode integration:**

| Mechanism | Available? | Reason |
|-----------|-----------|--------|
| HTTP API | ❌ No | Not implemented |
| WebSocket | ❌ No | Not implemented |
| Unix Socket (named pipe) | ❌ No | Used only for Discord |
| Database Read Access | ⚠️ Maybe | Direct file access |
| Electron IPC | ❌ No | VSCode runs outside Electron |
| Child Process Pipes | ❌ No | Only used internally |

**To move forward, you must either:**
1. Use hacky direct database/file access
2. Patch Astra to expose an API server
3. Create a custom IPC bridge executable

The cleanest solution is to **contribute an optional API server** to Astra that VSCode can connect to.
