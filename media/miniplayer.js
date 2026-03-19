
const vscode = acquireVsCodeApi();
let isPlaying = false;
let isFavorite = false;
let isConnected = false;

const playBtn = document.getElementById('playBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const statusBar = document.getElementById('statusBar');
const albumArtDiv = document.getElementById('albumArt');

// Persist status bar toggle state in localStorage
const STATUS_BAR_KEY = 'astraMiniplayerStatusBarVisible';
function setStatusBarVisible(visible) {
	statusBar.style.display = visible ? '' : 'none';
	const statusText = document.getElementById('statusText');
	if (statusText) statusText.style.display = visible ? '' : 'none';
	const statusDot = document.getElementById('statusDot');
	if (statusDot) statusDot.style.display = visible ? '' : 'none';
	localStorage.setItem(STATUS_BAR_KEY, visible ? '1' : '0');
}
function getStatusBarVisible() {
	return localStorage.getItem(STATUS_BAR_KEY) !== '0';
}

// On load, restore status bar state
setStatusBarVisible(getStatusBarVisible());

vscode.postMessage({ command: 'getStatus' });

playBtn.addEventListener('click', () => { vscode.postMessage({ command: isPlaying ? 'pause' : 'play' }); });
nextBtn.addEventListener('click', () => { vscode.postMessage({ command: 'next' }); });
prevBtn.addEventListener('click', () => { vscode.postMessage({ command: 'previous' }); });
favoriteBtn.addEventListener('click', () => { vscode.postMessage({ command: 'toggleFavorite' }); });

window.addEventListener('message', event => {
	const message = event?.data;
	if (message && message.command === 'updateStatus') updateStatus(message.status);
	if (message && message.command === 'toggleStatusBar') {
		const newVisible = statusBar.style.display === 'none';
		setStatusBarVisible(newVisible);
	}
});

function updateStatus(status) {
	if (!status || typeof status !== 'object') return;
	const title = String(status.title || '').trim() || 'No track';
	const artist = String(status.artist || '').trim() || 'Unknown';
	const albumArt = String(status.albumArt || '').trim();
	const playbackState = String(status.playbackState || 'stopped').trim();

	trackTitle.textContent = title;
	trackArtist.textContent = artist;
	isPlaying = playbackState === 'playing';
	isFavorite = Boolean(status.isFavorite);
	isConnected = Boolean(status.isConnected);

	playBtn.textContent = isPlaying ? '⏸' : '▶';
	favoriteBtn.textContent = isFavorite ? '♥' : '♡';
	favoriteBtn.classList.toggle('active', isFavorite);

	albumArtDiv.innerHTML = '';
	if (albumArt && (albumArt.startsWith('http') || albumArt.startsWith('data:'))) {
		const img = document.createElement('img');
		img.src = albumArt;
		img.alt = title;
		img.style.width = '100%';
		img.style.height = '100%';
		img.style.objectFit = 'cover';
		img.onerror = () => { albumArtDiv.textContent = '🎵'; };
		albumArtDiv.appendChild(img);
	} else {
		albumArtDiv.textContent = '🎵';
	}

	const statusDot = document.getElementById('statusDot');
	const statusText = document.getElementById('statusText');
	if (statusDot) {
		statusDot.classList.remove('offline', 'paused');
		if (!isConnected) {
			statusDot.classList.add('offline');
		} else if (playbackState === 'paused') {
			statusDot.classList.add('paused');
		}
	}
	if (statusText) {
		if (!isConnected) {
			statusText.textContent = 'Offline';
		} else if (playbackState === 'paused') {
			statusText.textContent = 'Paused';
		} else if (playbackState === 'playing') {
			statusText.textContent = 'Playing';
		} else {
			statusText.textContent = '';
		}
	}

	if (statusBar.style.display !== 'none') {
		if (!isConnected) {
			statusBar.textContent = 'Offline';
			statusBar.classList.add('error');
		} else {
			statusBar.textContent = '';
			statusBar.classList.remove('error');
		}
	}
	prevBtn.disabled = !isConnected;
	nextBtn.disabled = !isConnected;
	favoriteBtn.disabled = !isConnected;
}
