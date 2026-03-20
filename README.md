# Astra Miniplayer for VS Code

A lightweight miniplayer extension that integrates directly with the Astra music player application, allowing you to control playback without leaving VS Code.

![code size](https://img.shields.io/github/languages/code-size/Gatorzgaming/astra-vscode-miniplayer)
![GitHub Release](https://img.shields.io/github/v/release/Gatorzgaming/astra-vscode-miniplayer?include_prereleases)
![GitHub License](https://img.shields.io/github/license/Gatorzgaming/astra-vscode-miniplayer)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/Gatorzgaming/astra-vscode-miniplayer/release.yml)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/Gatorzgaming/astra-vscode-miniplayer/total)

<img width="305" height="152" alt="image" src="https://github.com/user-attachments/assets/d3ed5e37-2d8b-42b1-b718-1ab159d363a0" />


> [!NOTE]
> **Made for [Astra](https://github.com/Boof2015/astra)** - An audiophile music player with gapless playback, parametric EQ, and real-time DSP visualizers.

## Features

- **Sidebar Miniplayer**: Collapsible miniplayer in the VS Code Explorer sidebar (like VS Code Pets)
- **Playback Controls**: Play/Pause, previous track, and next track buttons
- **Real-time Status**: Automatically detects when Astra is running and syncs playback state
- **Now Playing Display**: Shows current track title and artist
- **Process Detection**: Automatically finds and connects to running Astra instance
- **IPC Integration**: Uses  Astra's native API message system to allow liking of songs. 

## Requirements

- **Astra** 0.4.0 or greater must be installed and running on your system
- VS Code 1.109.0 or higher
- Node.js 22 LTS and npm for building from source

## Installation

To install the extension in your normal VS Code instance:

1. Clone this repository and open it in VS Code.
2. Install dependencies:

```bash
npm ci
```

3. Build the extension:

```bash
npm run compile
```

4. Package the extension as a VSIX:

```bash
npx @vscode/vsce package --no-yarn
```

5. In VS Code, open the Extensions view.
6. Open the `...` menu in the top right of the Extensions view.
7. Choose `Install from VSIX...`.
8. Select the generated `miniplayer-0.0.3.vsix` file.

For development only, use `F5` to launch an Extension Development Host instead of installing the VSIX.

## Building

Use the standard project scripts:

```bash
npm run compile
```

This compiles the TypeScript source into `out/`.

To create an installable VSIX package, run:

```bash
npx @vscode/vsce package --no-yarn
```

For active development, run:

```bash
npm run watch
```

To check the codebase before committing, run:

```bash
npm run lint
```

## How to Use

### Enable the Miniplayer
1. Open VS Code
2. Look for "Astra Miniplayer" in the **Explorer** sidebar
3. You should see a connection status indicator
4. Press `CTRL + P` and type `>Astra:Configure Astra API `

<img width="604" height="229" alt="image" src="https://github.com/user-attachments/assets/93eed3d4-25f0-405d-96b4-94dad14672e7" />


5. Get your API key from the intergrations tab of Astra's settings
> [!WARNING]
> Both `Local Integration API` and `External Playback Controls` needs to be enabled in Astra settings for the extension to work properly

<img width="1919" height="1144" alt="image" src="https://github.com/user-attachments/assets/01c3ffb9-5a95-4952-b873-99c323adf0e0" />

6. Copy the Local API endpoint and remove the end part so it shows up as `http://127.0.0.1:38401` for example

<img width="607" height="80" alt="image" src="https://github.com/user-attachments/assets/ef344978-a24c-4694-91a0-285eb83fdb44" />

7. Input your API Key

<img width="603" height="73" alt="image" src="https://github.com/user-attachments/assets/8cd0fc49-1b6d-4e82-abbb-01ceb99dd04b" />

 
8. Done!


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
