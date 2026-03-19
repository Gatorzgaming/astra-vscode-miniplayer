> [!IMPORTANT]
> **Made for [Astra](https://github.com/Boof2015/astra)** - An audiophile music player with gapless playback, parametric EQ, and real-time DSP visualizers.

# Astra Miniplayer for VS Code

A lightweight miniplayer extension that integrates directly with the Astra music player application, allowing you to control playback without leaving VS Code.

## Features

- **Sidebar Miniplayer**: Collapsible miniplayer in the VS Code Explorer sidebar (like VS Code Pets)
- **Playback Controls**: Play/Pause, previous track, and next track buttons
- **Real-time Status**: Automatically detects when Astra is running and syncs playback state
- **Now Playing Display**: Shows current track title and artist
- **Process Detection**: Automatically finds and connects to running Astra instance
- **IPC Integration**: Uses  Astra's native API message system to allow liking of songs. 
- **Responsive UI**: Adapts to sidebar width with responsive layout

## Requirements

- **Astra** 0.4.0 or greater must be installed and running on your system
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

## License

This extension follows the same license as Astra (GPL-3.0).

## Contributing

Found a bug? Have a suggestion?
Feel free to submit PRs or issues. 
