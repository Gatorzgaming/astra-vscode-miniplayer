import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';



/**
 * Perform a simple HTTP GET and return parsed JSON.
 * Uses built‑in http/https modules so no extra dependencies are required.
 */
export async function httpFetchJson(url: string, headers: Record<string,string> = {}): Promise<any> {
  const { status, body } = await httpRequest(url, 'GET', headers);
  if (status >= 200 && status < 300) {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  throw new Error(`HTTP ${status}`);
}

/**
 * Perform a simple HTTP GET and return response body as text.
 */
export async function httpFetchText(url: string, headers: Record<string,string> = {}): Promise<string> {
  const { status, body } = await httpRequest(url, 'GET', headers);
  if (status >= 200 && status < 300) {
    return body;
  }
  throw new Error(`HTTP ${status}`);
}

/**
 * Perform a POST with a string payload. Returns status/body for inspection.
 */
export async function httpPost(url: string, data: string, headers: Record<string,string> = {}): Promise<{status:number,body:string}> {
  return httpRequest(url, 'POST', headers, data);
}

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function httpRequest(urlString: string, method: string, headers: Record<string,string> = {}, body?: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const opts: http.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port ? parseInt(url.port, 10) : undefined,
        path: url.pathname + url.search,
        headers
      };
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(opts, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, headers: res.headers, body: data });
        });
      });
      req.on('error', reject);
      if (body) {
        req.write(body);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function fetchAlbumArt(endpoint: string): Promise<string | undefined> {
  console.log('[Astra] Fetching album art from:', endpoint);
    if (!endpoint) {
      console.warn('[Astra] fetchAlbumArt: No endpoint provided');
      return undefined;
    }
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        console.warn(`[Astra] fetchAlbumArt: Endpoint ${endpoint} returned status ${res.status}`);
        return undefined;
      }
      const text = (await res.text()).trim();
      let base64 = '';
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj.albumArt === 'string') {
          base64 = obj.albumArt.trim();
        } else {
          console.warn('[Astra] fetchAlbumArt: JSON response missing albumArt property', obj);
          return undefined;
        }
      } catch (jsonErr) {
        console.warn('[Astra] fetchAlbumArt: Failed to parse JSON', jsonErr);
        return undefined;
      }
      // Validate base64
      if (!base64 || base64.length < 100) {
        console.warn('[Astra] fetchAlbumArt: Invalid or too short base64', base64);
        return undefined;
      }
      // Sanitize base64 (remove any newlines or spaces)
      const sanitizedBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
      // Detect image type from base64 header
      let mime = 'image/png';
      if (sanitizedBase64.startsWith('iVBORw0KGgo')) {
        mime = 'image/png';
      } else if (sanitizedBase64.startsWith('/9j/')) {
        mime = 'image/jpeg';
      } else if (sanitizedBase64.startsWith('R0lGOD')) {
        mime = 'image/gif';
      } else {
        console.warn('[Astra] fetchAlbumArt: Unknown image type, defaulting to PNG');
      }
      // Construct data URI
      const dataUri = `data:${mime};base64,${sanitizedBase64}`;
      // Validate data URI
      if (!/^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(dataUri)) {
        console.warn('[Astra] fetchAlbumArt: Malformed data URI', dataUri);
        return undefined;
      }
      // Log the detected type and URI preview
      console.log('[Astra] fetchAlbumArt: Returning album art data URI', {
        mime,
        length: dataUri.length,
        preview: dataUri.slice(0, 100) + '...'
      });
      return dataUri;
    } catch (err) {
      console.error('[Astra] fetchAlbumArt: Error fetching album art', err);
      return undefined;
    }
}

