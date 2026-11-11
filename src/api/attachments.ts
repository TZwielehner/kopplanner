// Anhänge über die koppla Public REST API (nur lesend).
//
// Laut API-Doku:
// - GET /orders/{orderId}/attachments: pro Auftrag derzeit NUR Fotos (`type=photo`),
//   seitenweise mit `limit` (max. 100) und `nextCursor`.
// - GET /wbs-sections/{sectionId}/attachments: pro WBS-Abschnitt Dokumente (PDF, mit fileName/fileSize),
//   Fotos und externe Links (mit url und optionalem title, ohne signierte URL).
// Das Antwortschema der Abschnitts-Anhänge ist in der Doku abgeschnitten. Die Felder werden deshalb
// tolerant gelesen (Array oder { data: [...] }); unbekannte Felder werden ignoriert.
import { API_BASE, ApiError } from './rest';

export type AttachmentKind = 'document' | 'photo' | 'link';

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  /** Ziel beim Klick: Download-/signierte URL bzw. externer Link */
  href: string | null;
  thumbnailUrl: string | null;
  fileSize: number | null;
  comment: string | null;
}

type Raw = Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export function normalizeAttachment(r: Raw, i: number): Attachment {
  const type = (str(r.type) ?? '').toLowerCase();
  const signed = str(r.downloadUrl) ?? str(r.signedUrl);
  const url = str(r.url);
  const fileName = str(r.fileName);
  const kind: AttachmentKind =
    type === 'link' || (url && !signed)
      ? 'link'
      : type === 'document' || (fileName && type !== 'photo')
        ? 'document'
        : 'photo';
  return {
    id: str(r.attachmentId) ?? str(r.id) ?? `att-${i}`,
    kind,
    name: str(r.title) ?? fileName ?? url ?? (kind === 'photo' ? 'Foto' : 'Anhang'),
    href: kind === 'link' ? url : signed ?? url,
    thumbnailUrl: str(r.thumbnailUrl),
    fileSize: typeof r.fileSize === 'number' ? r.fileSize : null,
    comment: str(r.comment),
  };
}

function items(body: unknown): Raw[] {
  if (Array.isArray(body)) return body as Raw[];
  if (body && typeof body === 'object' && Array.isArray((body as Raw).data)) return (body as Raw).data as Raw[];
  return [];
}

async function getJson(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText} – ${path}`);
  return res.json();
}

export async function loadSectionAttachments(sectionId: string, apiKey: string): Promise<Attachment[]> {
  const body = await getJson(`/wbs-sections/${encodeURIComponent(sectionId)}/attachments`, apiKey);
  return items(body).map(normalizeAttachment);
}

/** Erste Seite (max. 50) der Fotos eines Auftrags, neueste zuerst. */
export async function loadOrderPhotos(orderId: string, apiKey: string): Promise<{ photos: Attachment[]; more: boolean }> {
  const body = await getJson(`/orders/${encodeURIComponent(orderId)}/attachments?limit=50`, apiKey);
  const more = !!(body && typeof body === 'object' && str((body as Raw).nextCursor));
  return { photos: items(body).map(normalizeAttachment), more };
}

// ---------- einfacher Cache, damit Spaltenköpfe und Dialog nicht doppelt laden ----------

const cache = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key)); // Fehler nicht cachen
  }
  return p;
}

export function clearAttachmentCache() {
  cache.clear();
}
