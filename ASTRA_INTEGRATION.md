# Astra VSCode Extension - Local Integration API

The extension interacts with Astra through a lightweight **Local Integration HTTP API**.
It's loopback-only, authenticated, and designed for simple status reads and optional controls.

> The API is **disabled by default**; users must enable it in Astra's settings and
> provide an endpoint/secret to the extension. No discovery endpoint exists.

### Core endpoints

| Method | Path                  | Description                             |
|--------|-----------------------|-----------------------------------------|
| GET    | `/v1/now-playing`     | Latest playback snapshot (JSON)         |
| GET    | `/v1/events`          | SSE stream of updates (event: `now-playing`) |
| POST   | `/v1/control`         | Send optional commands (`play`, `pause`, `next`, `previous`, `toggle-favorite`) |

#### Snapshot schema
```json
{
  "playbackState": "playing|paused|stopped|loading",
  "currentTime": 42.13,
  "duration": 218.56,
  "queueLength": 37,
  "currentTrack": {
    "title": "song",
    "artist": "artist",
    "album": "album",
    "isFavorite": false
  },
  "updatedAt": 1730000000000
}
```
*All fields may be `null`/omitted when nothing is loaded.*

> **Note:**  album art is _not_ included in the official v1 response.  **Astra
> hosts art on a separate URL** (`/api/now-playing/album-art` in local builds)
> which returns raw base64 bytes; the extension adds a `data:` URI prefix and
> guesses the correct MIME type (PNG or JPEG) automatically.

### Authentication & limits

- Send `Authorization: Bearer <token>` header on every request.
- SSE client cap: 8, control rate limit 120/minute.
- Control endpoint requires a separate toggle in Astra settings; 403 if disabled.

### Extension integration tips

1. Store endpoint/key in secure storage rather than workspace settings.
2. Call `/v1/now-playing` once on startup, then **attempt to open an SSE stream** at
   `/v1/events`.  If the stream is unavailable or drops, the helper will fall back to
   polling at the configured `astra.api.pollInterval`.
> 3. The extension will automatically **strip any trailing path** from the endpoint you
>    paste (e.g. if you accidentally include `/v1/now-playing`, it will remove it).
> 4. If you leave the album‑art URL blank, the extension derives it from the endpoint
>    by appending `/api/now-playing/album-art`.
> 5. Handle reconnects (Astra restart/port changes/key regeneration).

### Implementation summary
The current extension uses an `AstraConnection` helper class that:
- polls `/v1/now-playing` at a configurable interval
- optionally fetches art from a second endpoint
- posts commands to `/v1/control`

Tests simulate both PNG and JPEG payloads to verify the data‑URI logic.

### UI
The webview shows a small player with track info and artwork; the existing UI
is clean and remains in use.

---

*(The earlier, more general IPC analysis content has been moved to
`ASTRA_IPC_ANALYSIS.md` — that document still exists for historical reference.)*