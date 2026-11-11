import { useEffect, useState } from 'react';
import { cached, loadOrderPhotos, loadSectionAttachments, type Attachment } from '../api/attachments';

type State<T> = { status: 'loading' } | { status: 'ok'; value: T } | { status: 'error'; message: string };

function useLoad<T>(key: string | null, load: () => Promise<T>): State<T> {
  const [state, setState] = useState<State<T>>({ status: 'loading' });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    setState({ status: 'loading' });
    cached(key, load).then(
      (value) => alive && setState({ status: 'ok', value }),
      (e) => alive && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useSectionAttachments(sectionId: string | null, apiKey: string) {
  return useLoad(sectionId && apiKey ? `sec:${sectionId}` : null, () => loadSectionAttachments(sectionId!, apiKey));
}

export function useOrderPhotos(orderId: string, apiKey: string) {
  return useLoad(apiKey ? `ord:${orderId}` : null, () => loadOrderPhotos(orderId, apiKey));
}

const ICON: Record<Attachment['kind'], string> = { document: '📄', photo: '🖼', link: '🔗' };

function fmtSize(n: number | null) {
  if (n == null) return '';
  return n >= 1024 * 1024 ? ` · ${(n / 1024 / 1024).toFixed(1)} MB` : ` · ${Math.max(1, Math.round(n / 1024))} KB`;
}

export function AttachmentLink({ a }: { a: Attachment }) {
  const label = (
    <>
      <span aria-hidden>{ICON[a.kind]}</span> <span className="attname">{a.name}</span>
      <span className="muted">{fmtSize(a.fileSize)}</span>
    </>
  );
  return a.href ? (
    <a className="att" href={a.href} target="_blank" rel="noopener noreferrer" title={a.comment ?? a.name} onClick={(e) => e.stopPropagation()}>
      {label}
    </a>
  ) : (
    <span className="att">{label}</span>
  );
}

/** Dokumente und Links eines WBS-Abschnitts, kompakt für den Spaltenkopf im Board. */
export function SectionDocs({ sectionId, apiKey, max = 3 }: { sectionId: string; apiKey: string; max?: number }) {
  const s = useSectionAttachments(sectionId, apiKey);
  const [all, setAll] = useState(false);
  if (s.status === 'loading') return null;
  if (s.status === 'error')
    return (
      <div className="muted small" title={s.message}>
        Dokumente nicht ladbar
      </div>
    );
  const docs = s.value.filter((a) => a.kind !== 'photo');
  if (!docs.length) return null;
  const shown = all ? docs : docs.slice(0, max);
  return (
    <div className="atts">
      {shown.map((a) => (
        <AttachmentLink key={a.id} a={a} />
      ))}
      {docs.length > shown.length && (
        <button className="linkbtn small" onClick={() => setAll(true)}>
          +{docs.length - shown.length} weitere
        </button>
      )}
    </div>
  );
}

/** Abschnitt im Aufgaben-Dialog: Dokumente/Links des Buckets und Fotos des Auftrags. */
export function TaskAttachments({ sectionId, orderId, apiKey }: { sectionId: string | null; orderId: string; apiKey: string }) {
  const sec = useSectionAttachments(sectionId, apiKey);
  const ord = useOrderPhotos(orderId, apiKey);
  if (!apiKey) return null;
  const docs = sec.status === 'ok' ? sec.value.filter((a) => a.kind !== 'photo') : [];
  const photos = ord.status === 'ok' ? ord.value.photos : [];
  const loading = (sectionId && sec.status === 'loading') || ord.status === 'loading';
  return (
    <details className="attblock" open>
      <summary>
        Dokumente & Fotos{' '}
        <span className="muted">{loading ? '…' : `(${docs.length + photos.length}${ord.status === 'ok' && ord.value.more ? '+' : ''})`}</span>
      </summary>
      {sectionId && sec.status === 'error' && <div className="muted small">Dokumente des Abschnitts nicht ladbar ({sec.message})</div>}
      {docs.length > 0 && (
        <div className="atts">
          <div className="muted small">Dokumente & Links des Abschnitts</div>
          {docs.map((a) => (
            <AttachmentLink key={a.id} a={a} />
          ))}
        </div>
      )}
      {ord.status === 'error' && <div className="muted small">Fotos nicht ladbar ({ord.message})</div>}
      {photos.length > 0 && (
        <>
          <div className="muted small">Fotos des Auftrags</div>
          <div className="thumbs">
            {photos.map((p) => (
              <a key={p.id} href={p.href ?? undefined} target="_blank" rel="noopener noreferrer" title={p.comment ?? 'Foto'}>
                {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt={p.comment ?? 'Foto'} loading="lazy" /> : <span className="att">🖼 Foto</span>}
              </a>
            ))}
          </div>
        </>
      )}
      {!loading && !docs.length && !photos.length && sec.status !== 'error' && ord.status !== 'error' && (
        <div className="muted small">Keine Dokumente oder Fotos vorhanden.</div>
      )}
    </details>
  );
}
