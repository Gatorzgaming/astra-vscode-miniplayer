# Astra Miniplayer for VS Code

A lightweight miniplayer extension that integrates directly with the Astra music player application, allowing you to control playback without leaving VS Code.

## Features

- **Sidebar Miniplayer**: Collapsible miniplayer in the VS Code Explorer sidebar (like VS Code Pets)
- **Playback Controls**: Play/Pause, previous track, and next track buttons
- **Real-time Status**: Automatically detects when Astra is running and syncs playback state
- **Now Playing Display**: Shows current track title and artist
- **Process Detection**: Automatically finds and connects to running Astra instance
- **Direct IPC Integration**: Hooks into Astra's native Electron IPC message system
- **Responsive UI**: Adapts to sidebar width with responsive layout

## Requirements

- **Astra** must be installed and running on your system
- VS Code 1.60.0 or higher

## Installation

1. Clone or extract this extension into your VS Code extensions folder
2. Or: Build locally with `npm install` and `npm run compile`
3. Reload VS Code
4. The extension will automatically detect and connect to Astra

## How to Use

### Enable the Miniplayer
1. Open VS Code
2. Look for "Astra Miniplayer" in the **Explorer** sidebar
3. You should see a connection status indicator

### Playback Control
Once connected to Astra:
- **Play/Pause** - Click the play/pause button
- **Next Track** - Click the next button
- **Previous Track** - Click the previous button
- **See Now Playing** - Current track title and artist display in real-time

#### Album Artwork
The API does not include artwork by default; configure the
`astra.api.albumArtEndpoint` setting to a URL that returns a base64-encoded
image (for example `http://127.0.0.1:3333/api/now-playing/album-art`).  The
extension will convert the data to a `data:` URI and display it in the UI.

### Responsive Layouts
The miniplayer adapts to your sidebar width:
- **Tiny** (< 340px): Compact vertical layout
- **Compact** (340-620px): Side-by-side layout  
- **Wide** (620+px): Full featured layout with seek bar
- **Hero** (760+px): Expanded layout with large artwork

## How It Works

### Architecture

The extension now talks to Astra via the {
[Astra Local Integration API](https://github.com/Boof2015/astra/wiki/Astra-API)
}, a simple HTTP service exposed by the desktop app when the user enables
"Local API" in Astra's settings.

1. **Configuration** – the user provides the API endpoint URL and bearer
   token (stored securely in VS Code settings and secrets).
2. **HTTP Polling / Event Stream** – on startup the extension fetches
   `/v1/now-playing` and then attempts to open an SSE stream at `/v1/events` for
   live updates.  If the stream is unavailable the code gracefully falls back to
   polling at the configured interval.  Album art is fetched separately from the
   optional endpoint.
3. **Control Commands** – playback actions are sent via `POST /v1/control`.

### Endpoint Data

`GET /v1/now-playing` returns a JSON snapshot:

```json
{
  "playbackState": "playing",
  "currentTime": 42.13,
  "duration": 218.56,
  "queueLength": 37,
  "currentTrack": {
    "id": "12345",
    "title": "song name",
    "artist": "artist name",
    "album": "album name",
    "isFavorite": false
  }
}
```

Album artwork is not included by default; the extension can be pointed at a
separate URL that returns a base64‑encoded image (e.g.
`http://127.0.0.1:3333/api/now-playing/album-art`) and will convert it into a
`data:` URI for display.

Commands are very simple:

```json
{ "command": "play" }
```

Valid values: `play`, `pause`, `next`, `previous`, `toggle-favorite`.

The old IPC/Discord‑based mechanism has been removed in favour of the
official local API.  See the Astra wiki for more details on enabling the API
and obtaining the token.

## Connection Status

- **● Connected**: Extension is connected to Astra and ready to use
- **○ Offline**: Astra is not running; extension will reconnect when launched
- **⚠ Error**: Communication issue detected

## Troubleshooting

### "Astra not found" message
- Ensure Astra application is installed and running
- Try closing and reopening Astra
- The extension will automatically retry every 5 seconds

### No track info displayed
- Ensure a track is loaded or playing in Astra
- Check that Astra's mini player is functional
- Refresh VS Code window (Ctrl+R)

### Commands not working
- Verify Astra is responding to controls (use Astra's mini player window)
- Check that VS Code has focus before clicking controls
- File an issue with reproduction steps

## Developer Notes

### Building from Source
```bash
npm install
npm run compile
npm run watch       # Watch mode for development
```

### Testing
1. Run Astra application
2. Press F5 in VS Code (launch debug extension)
3. The extension will start in a new VS Code window
4. Test the miniplayer in the new window

### Architecture Files
- `src/extension.ts` - Main extension logic and Astra integration
- `getWebviewContent()` - HTML/CSS/JS for the miniplayer UI
- `AstraConnection` class - Process detection and IPC handling

### Extending the Extension

To add more features:
1. Add new commands to `MiniPlayerCommand` type
2. Handle in `handleWebviewMessage()` function
3. Update the webview HTML for new UI elements
4. Test with running Astra instance

## Platform Support

- ✅ Windows
- ✅ macOS  
- ✅ Linux

## Known Limitations

- Artwork display limited to tracks with embedded art (Astra limitation)
- Volume control not yet implemented (requires native module)
- Seeking requires full Astra rewrite (planned feature)
- Only works with Astra running on same machine

## Future Enhancements

- [ ] Volume control slider
- [ ] Seek position scrubbing with timeline
- [ ] Queue visualization
- [ ] Playlist switching
- [ ] Custom theme support
- [ ] Keyboard shortcuts integration
- [ ] Remote Astra support (network IPC)

## License

This extension follows the same license as Astra (GPL-3.0).

## Contributing

Found a bug? Have a suggestion? Check [Astra's GitHub](https://github.com/Boof2015/astra) for the main project.

---

**Made for [Astra](https://github.com/Boof2015/astra)** - An audiophile music player with gapless playback, parametric EQ, and real-time DSP visualizers.

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
