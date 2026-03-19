import * as vscode from 'vscode';
import * as path from 'path';
import { httpFetchJson, httpFetchText, httpPost } from './extension-utils';
import * as fs from 'fs';

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'miniplayer.html');
	const cssPath = vscode.Uri.joinPath(extensionUri, 'media', 'miniplayer.css');
	const jsPath = vscode.Uri.joinPath(extensionUri, 'media', 'miniplayer.js');
	const cssUri = webview.asWebviewUri(cssPath);
	const jsUri = webview.asWebviewUri(jsPath);
	let html = '';
	try {
		html = fs.readFileSync(htmlPath.fsPath, 'utf8');
	} catch (e) {
		html = `<body><div style="color:red">Failed to load miniplayer.html</div></body>`;
	}
	html = html.replace('miniplayer.css', cssUri.toString());
	html = html.replace('miniplayer.js', jsUri.toString());
	return html;
}

// simple status object used throughout the extension
interface AstraStatus {
	playbackState: 'stopped' | 'playing' | 'paused' | 'loading';
	currentTime: number;
	duration: number;
	title?: string;
	artist?: string;
	albumArt?: string;
	queueLength: number;
	isConnected: boolean;
	isFavorite?: boolean;
}

/**
 * Connection class that talks to the Astra Local Integration HTTP API.
 * It handles polling, optional album artwork fetching, and control commands.
 */
export class AstraConnection {
	private endpoint = '';
	private apiKey = '';
	private pollInterval = 5;
	private pollTimer: NodeJS.Timeout | undefined;
	private albumArtPollInterval = 5000; // 5 seconds default
	private albumArtPollTimer: NodeJS.Timeout | undefined;
	private lastStatus: AstraStatus = {
		playbackState: 'stopped',
		currentTime: 0,
		duration: 0,
		title: 'No track',
		artist: 'Unknown',
		albumArt: '',
		queueLength: 0,
		isConnected: false,
		isFavorite: false
	};
	private statusCallback: ((status: AstraStatus) => void) | null = null;
	private connected = false;

	setCredentials(endpoint: string, apiKey: string) {
		this.endpoint = endpoint.replace(/\/$/, '');
		this.apiKey = apiKey;
	}


	setPollInterval(ms: number) {
		this.pollInterval = ms;
	}

	setAlbumArtPollInterval(ms: number) {
		this.albumArtPollInterval = ms;
	}

	setStatusCallback(cb: (status: AstraStatus) => void) {
		this.statusCallback = cb;
	}

	getIsConnected(): boolean {
		return this.connected;
	}

	async initialize(): Promise<boolean> {
		if (!this.endpoint || !this.apiKey) {
			this.connected = false;
			return false;
		}
		const status = await this.fetchNowPlaying();
		if (status) {
			this.lastStatus = status;
			this.connected = true;
			this.startPolling();
			return true;
		}
		this.connected = false;
		return false;
	}

	disconnect(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = undefined;
		}
		if (this.albumArtPollTimer) {
			clearInterval(this.albumArtPollTimer);
			this.albumArtPollTimer = undefined;
		}
		this.connected = false;
	}

	private startPolling() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
		}
		this.pollTimer = setInterval(async () => {
			const status = await this.fetchNowPlaying(false);
			if (status) {
				this.lastStatus = status;
				this.connected = true;
				if (this.statusCallback) {
					this.statusCallback(status);
				}
			} else {
				this.connected = false;
			}
		}, this.pollInterval);

		// Start album art polling separately
		this.startAlbumArtPolling();
	}

	private startAlbumArtPolling() {
		if (this.albumArtPollTimer) {
			clearInterval(this.albumArtPollTimer);
		}
		this.albumArtPollTimer = setInterval(async () => {
			const status = await this.fetchNowPlaying(true);
			if (status && status.albumArt !== this.lastStatus.albumArt) {
				this.lastStatus.albumArt = status.albumArt;
				if (this.statusCallback) {
					this.statusCallback({ ...this.lastStatus });
				}
			}
		}, this.albumArtPollInterval);
	}

	private async fetchNowPlaying(onlyAlbumArt = false): Promise<AstraStatus | null> {
		try {
			const url = this.endpoint + '/v1/now-playing';
			const json = await httpFetchJson(url, { Authorization: `Bearer ${this.apiKey}` });
			const track = json.currentTrack || {};
			const status: AstraStatus = {
				playbackState: json.playbackState || 'stopped',
				currentTime: json.currentTime || 0,
				duration: json.duration || 0,
				title: track.title || 'No track',
				artist: track.artist || 'Unknown',
				albumArt: '',
				queueLength: json.queueLength || 0,
				isConnected: true,
				isFavorite: Boolean(track.isFavorite)
			};
			if (track.artworkUrl) {
				try {
					const response = await fetch(track.artworkUrl, {
						headers: { Authorization: `Bearer ${this.apiKey}` }
					});
					if (response.ok) {
						const arrayBuffer = await response.arrayBuffer();
						const buffer = Buffer.from(arrayBuffer);
						const mime = response.headers.get('content-type') || 'image/jpeg';
						const art = `data:${mime};base64,${buffer.toString('base64')}`;
						status.albumArt = art;
					} else {
						status.albumArt = '';
					}
				} catch (e) {
					status.albumArt = '';
				}
			}
			if (onlyAlbumArt) {
				// Only return albumArt field, keep other fields from lastStatus
				return { ...this.lastStatus, albumArt: status.albumArt };
			}
			return status;
		} catch (e) {
			console.error('fetchNowPlaying error', e);
			return null;
		}
	}

	async sendCommand(cmd: string): Promise<void> {
		if (!this.endpoint || !this.apiKey) {
			return;
		}
		try {
			await httpPost(this.endpoint + '/v1/control', JSON.stringify({ command: cmd }), {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			});
		} catch (e) {
			console.error('sendCommand failed', e);
		}
	}

	async getStatus(): Promise<AstraStatus> {
		return { ...this.lastStatus, isConnected: this.connected };
	}
}

// globals
let miniplayerPanel: vscode.WebviewPanel | undefined;
let miniplayerView: vscode.WebviewView | undefined;
let astraConnection: AstraConnection | undefined;
let extensionContext: vscode.ExtensionContext | undefined;

export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;
	// register commands
	       context.subscriptions.push(
		       vscode.commands.registerCommand('miniplayer.open', () => openMiniplayer(context))
	       );
	       context.subscriptions.push(
		       vscode.commands.registerCommand('astra.configure', configureAstraApi)
	       );
	       // Add reconnect command
	       context.subscriptions.push(
		       vscode.commands.registerCommand('miniplayer.reconnect', async () => {
			       await initializeAstraConnection();
			       // Send refresh to webview
			       if (miniplayerView) {
				       miniplayerView.webview.postMessage({ command: 'refresh' });
			       }
			       if (miniplayerPanel) {
				       miniplayerPanel.webview.postMessage({ command: 'refresh' });
			       }
		       })
	       );
	       // Add toggle status bar command
	       context.subscriptions.push(
		       vscode.commands.registerCommand('miniplayer.toggleStatusBar', () => {
			       if (miniplayerView) {
				       miniplayerView.webview.postMessage({ command: 'toggleStatusBar' });
			       }
			       if (miniplayerPanel) {
				       miniplayerPanel.webview.postMessage({ command: 'toggleStatusBar' });
			       }
		       })
	       );

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async e => {
			if (e.affectsConfiguration('astra.api')) {
				await initializeAstraConnection();
			}
		})
	);

	// register view provider
	const provider = new MiniplayerViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('miniplayer.view', provider)
	);

	initializeAstraConnection();

	context.subscriptions.push(
		new vscode.Disposable(() => {
			if (astraConnection) {
				astraConnection.disconnect();
			}
		})
	);
}

async function configureAstraApi() {
	const endpoint = await vscode.window.showInputBox({
		prompt: 'Astra API endpoint (e.g. http://127.0.0.1:38401)'
	});
	if (endpoint !== undefined) {
		await vscode.workspace.getConfiguration('astra.api').update('endpoint', endpoint.trim(), vscode.ConfigurationTarget.Global);
	}
	if (extensionContext) {
		const token = await vscode.window.showInputBox({ prompt: 'Astra API key', password: true });
		if (token !== undefined) {
			await extensionContext.secrets.store('astraApiKey', token.trim());
		}
	}
	vscode.window.showInformationMessage('Astra API configuration saved');
	await initializeAstraConnection();
}

async function initializeAstraConnection(): Promise<void> {
    if (!astraConnection) {
        astraConnection = new AstraConnection();
    }
    const config = vscode.workspace.getConfiguration('astra.api');
    const endpoint = (config.get<string>('endpoint') || '').trim();
	const pollInterval = config.get<number>('pollInterval') || 2000;
    const token = await extensionContext?.secrets.get('astraApiKey') || '';
    if (!endpoint || !token) {
        vscode.window.showWarningMessage('Astra API endpoint or key not configured. Run "Configure Astra API" command.');
    }

	astraConnection.setCredentials(endpoint, token);
	// albumArtEndpoint is deprecated; artworkUrl is used from API response
    astraConnection.setPollInterval(pollInterval);
    astraConnection.setStatusCallback(status => {
        const msg = { command: 'updateStatus', status };
        if (miniplayerView) {
            miniplayerView.webview.postMessage(msg);
        }
        if (miniplayerPanel) {
            miniplayerPanel.webview.postMessage(msg);
        }
    });

	const ok = await astraConnection.initialize();
	if (ok) {
		vscode.window.showInformationMessage('♪ Connected to Astra Local API');
		getStatus();
	} else {
		vscode.window.showWarningMessage('⚠ Unable to reach Astra API (check settings)');
	}
}

function handleWebviewMessage(message: any, panel?: vscode.WebviewPanel, view?: vscode.WebviewView) {
	if (!astraConnection) {
		return;
	}
	switch (message.command) {
		case 'play':
			astraConnection.sendCommand('play');
			break;
		case 'pause':
			astraConnection.sendCommand('pause');
			break;
		case 'next':
			astraConnection.sendCommand('next');
			break;
		case 'previous':
			astraConnection.sendCommand('previous');
			break;
		case 'toggleFavorite':
			astraConnection.sendCommand('toggle-favorite');
			break;
		case 'getStatus':
			getStatus(panel, view);
			break;
		// other commands can be added
	}
}

async function getStatus(panel?: vscode.WebviewPanel, view?: vscode.WebviewView) {
	if (!astraConnection) {
		return;
	}
	const status = await astraConnection.getStatus();
	const msg = { command: 'updateStatus', status };
	if (panel) {
		panel.webview.postMessage(msg);
	}
	if (view) {
		view.webview.postMessage(msg);
	}
	if (!panel && !view && miniplayerView) {
		miniplayerView.webview.postMessage(msg);
	}
}

function openMiniplayer(context: vscode.ExtensionContext) {
	const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
	if (miniplayerPanel) {
		miniplayerPanel.reveal(columnToShowIn);
	} else {
		miniplayerPanel = vscode.window.createWebviewPanel(
			'miniplayer',
			'Astra Miniplayer',
			columnToShowIn || vscode.ViewColumn.Beside,
			{ enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))] }
		);
		miniplayerPanel.webview.html = getWebviewContent(miniplayerPanel.webview, context.extensionUri);
		miniplayerPanel.onDidDispose(() => { miniplayerPanel = undefined; });
		miniplayerPanel.webview.onDidReceiveMessage(message => handleWebviewMessage(message, miniplayerPanel));
	}
}

// tree view classes largely unchanged
class MiniplayerTreeItem extends vscode.TreeItem {
	constructor(public readonly label: string, public readonly description?: string) {
		super(label);
		this.collapsibleState = vscode.TreeItemCollapsibleState.None;
	}
}

class MiniplayerTreeProvider implements vscode.TreeDataProvider<MiniplayerTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<MiniplayerTreeItem | undefined | null | void> = new vscode.EventEmitter<MiniplayerTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<MiniplayerTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	getTreeItem(element: MiniplayerTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: MiniplayerTreeItem): Thenable<MiniplayerTreeItem[]> {
		if (element) { return Promise.resolve([]); }
		return Promise.resolve([
			new MiniplayerTreeItem('Astra Miniplayer', astraConnection?.getIsConnected() ? '● Connected' : '○ Offline')
		]);
	}

	refresh() { this._onDidChangeTreeData.fire(null); }
}

class MiniplayerViewProvider implements vscode.WebviewViewProvider {
	constructor(private extensionUri: vscode.Uri) {}

	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
		miniplayerView = webviewView;
		webviewView.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(this.extensionUri.fsPath, 'media'))] };
		webviewView.webview.html = getWebviewContent(webviewView.webview, this.extensionUri);
		webviewView.webview.onDidReceiveMessage(message => handleWebviewMessage(message, undefined, webviewView));
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				getStatus(undefined, webviewView);
			}
		});
		getStatus(undefined, webviewView);
	}
}

	// Load HTML from external file and inject webview URIs for CSS and JS

export function deactivate() {
	if (astraConnection) {
		astraConnection.disconnect();
	}
}
