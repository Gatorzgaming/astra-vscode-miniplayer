# Astra VSCode Extension - Technical Implementation Details

## Challenge: Integrating External Electron App with VSCode Extension

The core challenge is that Astra is a separate Electron application running in its own process, while the VSCode extension runs in VSCode's Electron context. These are completely isolated processes with no direct communication mechanism.

## Solutions Explored

### 1. HTTP API Endpoint (Initial Approach - ❌ Not Available)
**Problem**: Astra doesn't expose HTTP endpoints  
**Limitation**: Would require modifying Astra core

### 2. Electron IPC Socket Interception (Recommended - ✅ Implemented)
**Solution**: 
- Detect Astra process PID via `tasklist` (Windows) or `ps` (Unix)
- Open connection to Astra's Electron IPC socket
- Proxy messages through VSCode → Astra bridge

**Implementation in `AstraConnection` class**:
```typescript
async findAstraProcess(): Promise<number | null>
- Spawns tasklist/ps
- Searches for "astra" process
- Extracts and returns PID
```

**Current State**: ✅ Process detection implemented
**TODO**: Full IPC socket binding (requires native module or Electron preload injection)

### 3. Window Message Interception (Alternative)
**Approach**: Use Windows API to find Astra window and send messages  
**Status**: Not implemented (lower priority)

### 4. Filesystem Monitoring (Fallback)
**Approach**:  
- Monitor `~/.config/astra/mini-player-window.json`
- Watch Astra's cache/database files
- **Limitation**: Read-only, no command sending

**Status**: Could implement as fallback if IPC unavailable

### 5. Native Module Injection (Most Direct - Requires C++)
**Approach**: Create native module that hooks into Astra's main process  
**Status**: Not implemented (C++ complexity, security concerns)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ VSCode Process (Main)                                            │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Miniplayer Extension                                        │ │
│ │ ┌──────────────────────────────────────────────────────┐   │ │
│ │ │ AstraConnection Class                                │   │ │
│ │ │ - findAstraProcess() [✅ Done]                       │   │ │
│ │ │ - getStatus() [TODO: Bind to IPC]                   │   │ │
│ │ │ - sendCommand() [TODO: Bind to IPC]                 │   │ │
│ │ └──────────────────────────────────────────────────────┘   │ │
│ │                           │                                   │ │
│ │ ┌──────────────────────────────────────────────────────┐   │ │
│ │ │ MiniplayerViewProvider (Webview)                     │   │ │
│ │ │ - HTML/CSS/JS UI                                    │   │ │
│ │ │ - Message handlers for play/pause/next              │   │ │
│ │ └──────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │ [Process.spawn to find]
                         │ tasklist/ps
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼──────────────────────────┐   │
    │ Astra.exe Process             │   │
    │ - Main Window                 │   │
    │ - ipcMain handlers            │◄──┘
    │ - Mini Player Window          │
    └───────────────────────────────┘
```

## IPC Message Flow (Planned)

### Status Update Flow (Astra → VSCode)
```
Astra Main Process (ipcMain)
    ↓
    sends 'mini-player:snapshot' to mini player window
    ↓
VSCode Extension (via native module)
    ↓
Updates webview UI
    ↓
Displays in sidebar
```

### Command Flow (VSCode → Astra)
```
VSCode Webview (user clicks play)
    ↓
handleWebviewMessage()
    ↓
AstraConnection.sendCommand('togglePlay')
    ↓
Astra Main Process (ipcMain handler)
    ↓
Player responds
    ↓
Update sent back to VSCode
```

## Implementation Roadmap

### Phase 1: Process Detection ✅
- [x] Detect Astra process PID
- [x] Show connection status in sidebar
- [x] Implement retry logic with 5s interval

### Phase 2: Basic IPC Binding (TODO - Next)
- [ ] Create native Electron preload module
- [ ] Inject into Astra's process context
- [ ] Bind message listeners for `mini-player:snapshot`
- [ ] Test real-time status updates

### Phase 3: Command Implementation (TODO)
- [ ] Send `mini-player:sendCommand` via IPC
- [ ] Handle play/pause, next, previous
- [ ] Implement seek timeline
- [ ] Add favorite toggle

### Phase 4: Polish & Features (TODO)
- [ ] Display album artwork
- [ ] Volume slider control
- [ ] Queue visualization
- [ ] Keyboard shortcuts
- [ ] Settings/preferences

## Code Structure

### `src/extension.ts`
```
activate()
  ├── registerTreeDataProvider('miniplayer.view')
  ├── registerWebviewViewProvider('miniplayer.view')
  ├── registerCommand('miniplayer.open')
  └── initializeAstraConnection()

class AstraConnection
  ├── initialize()
  ├── findAstraProcess()
  ├── parseProcessOutput()
  ├── sendCommand()
  ├── getStatus()
  └── disconnect()

class MiniplayerTreeProvider
  ├── getTreeItem()
  ├── getChildren()
  └── refresh()

class MiniplayerViewProvider
  └── resolveWebviewView()

getWebviewContent()
  └── returns HTML with embedded CSS/JS
```

## Passing Data Between Contexts

### VSCode Extension → Webview
```typescript
miniplayerPanel.webview.postMessage({
  command: 'updateStatus',
  status: { title, artist, isPlaying, ... }
})
```

### Webview → VSCode Extension  
```typescript
panel.webview.onDidReceiveMessage(message => {
  // message.command, message.value, etc.
})
```

## Types Used

From `src/types/miniPlayer.ts`:
```typescript
type MiniPlayerPlaybackState = 'stopped' | 'playing' | 'paused' | 'loading'

interface MiniPlayerSnapshot {
  playbackState: MiniPlayerPlaybackState
  currentTime: number
  duration: number
  queueLength: number
  outputDeviceLabel: string | null
  currentTrack: MiniPlayerTrackSnapshot | null
}

type MiniPlayerCommand =
  | { type: 'togglePlay' }
  | { type: 'playNext' }
  | { type: 'playPrevious' }
  | { type: 'seek'; time: number }
  | { type: 'toggleFavorite'; trackPath: string }
```

## Native Module Consideration

To properly bind to Astra's IPC, we'd need:

1. **Node.js Native Module** (`binding.node`)
   - Access to Electron's IPC socket
   - Hook into Astra's main process
   - Forward messages bidirectionally

2. **Or: Preload Script Injection**
   - Inject preload script into Astra's renderer process
   - Expose bridge to VSCode extension
   - Communicate via window message events

## Security Implications

- ✅ **Safe**: Process detection (read-only system info)
- ⚠️  **Moderate**: IPC message proxying (requires validation)
- ❌ **Unsafe**: Raw process injection without proper sandboxing

## Testing Strategy

1. **Unit Tests**: AstraConnection process detection
2. **Integration Tests**: IPC message round-trip
3. **E2E Tests**: Full user workflow (with Astra running)
4. **Fallback Tests**: Behavior when Astra not running

## Debugging Tips

```bash
# Monitor process creation
wmic process list brief | findstr astra

# Check IPC socket
netstat -ano | findstr 3000

# VS Code Extension Devtools
Ctrl+Shift+P → "Developer: Toggle Extension Host Tools"
```

## References

- Astra Source: https://github.com/Boof2015/astra
- Electron IPC: https://www.electronjs.org/docs/api/ipc-main
- VS Code Extension API: https://code.visualstudio.com/api/extension-guides/webview
- Webview Communication: https://code.visualstudio.com/api/extension-guides/webview#passing-messages-from-a-webview-to-an-extension
