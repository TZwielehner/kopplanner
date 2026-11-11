// Schreibzugriff über die koppla-Echtzeit-Schnittstelle (Socket.io, wss://rtc.koppla.de).
// Nachgebaut aus der koppla-Web-App (my.koppla.de), NICHT öffentlich dokumentiert.
// Kann sich jederzeit ohne Ankündigung ändern.
//
// Ablauf:
//  1. Verbinden mit auth { token: "JWT <accessToken>" } und query { clientId }
//  2. emit("subscribe_to_project", { projectId, clientState: null })  -> ack { status, stateId }
//  3. emit("project_change", { messageId, projectId, stateId, clientStateId,
//          clientTimestampMs, operation: { name, input: <JSON als Bytes> } }) -> ack { status }
import { io, type Socket } from 'socket.io-client';
import { refresh, tokenExpiry, type Session } from './auth';

export const RTC_URL = 'wss://rtc.koppla.de';

type Ack = { status: 'SUCCESS' | 'ERROR' | string; stateId?: number; error?: { reason?: string; message?: string } };

/** GraphQL-Global-ID: base64("<Typ>:<uuid>") – Format wie die übrigen koppla-IDs. */
export function globalId(type: string, uuid: string) {
  return btoa(`${type}:${uuid}`);
}

export interface StatusReportInput {
  orderId: string;
  status: 'GREEN' | 'YELLOW' | 'RED' | 'REPORTED_DONE' | 'DONE';
  progress: number;
  reason: string | null;
  comment: string | null;
}

export interface DateUpdateInput {
  id: string;
  startAt: string; // ISO
  finishAt: string; // ISO
}

const TIMEOUT_MS = 15000;

function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve, reject) => {
    socket.timeout(TIMEOUT_MS).emit(event, payload, (err: unknown, ack: Ack) => {
      if (err) reject(new Error(`Keine Antwort von koppla auf "${event}"`));
      else resolve(ack);
    });
  });
}

async function withSocket<T>(
  session: Session,
  onSession: (s: Session) => void,
  projectId: string,
  fn: (send: (name: string, input: unknown) => Promise<void>) => Promise<T>,
): Promise<T> {
  let s = session;
  const exp = tokenExpiry(s.accessToken);
  if (exp !== null && exp - Date.now() < 60_000) {
    s = await refresh(s);
    onSession(s);
  }

  const socket = io(RTC_URL, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
    query: { clientId: crypto.randomUUID() },
    auth: { token: `JWT ${s.accessToken}` },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Verbindung zu rtc.koppla.de: Zeitüberschreitung')), TIMEOUT_MS);
      socket.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      socket.once('connect_error', (e: Error & { data?: unknown }) => {
        clearTimeout(t);
        reject(new Error(`Verbindung zu rtc.koppla.de fehlgeschlagen: ${e.message}`));
      });
      socket.connect();
    });

    const sub = await emitWithAck(socket, 'subscribe_to_project', { projectId, clientState: null });
    if (sub.status !== 'SUCCESS') {
      throw new Error(`Projekt-Abo abgelehnt: ${sub.error?.reason ?? sub.error?.message ?? sub.status}`);
    }
    const stateId = sub.stateId ?? 0;
    let clientStateId = 0;

    const send = async (name: string, input: unknown) => {
      const event = {
        messageId: crypto.randomUUID(),
        projectId,
        stateId,
        clientStateId: clientStateId++,
        clientTimestampMs: Date.now(),
        operation: { name, input: new TextEncoder().encode(JSON.stringify(input)) },
      };
      const ack = await emitWithAck(socket, 'project_change', event);
      if (ack.status !== 'SUCCESS') {
        throw new Error(`koppla hat "${name}" abgelehnt: ${ack.error?.reason ?? ack.error?.message ?? ack.status}`);
      }
    };

    return await fn(send);
  } finally {
    socket.disconnect();
  }
}

export function sendStatusReport(
  session: Session,
  onSession: (s: Session) => void,
  projectId: string,
  r: StatusReportInput,
) {
  return withSocket(session, onSession, projectId, (send) =>
    send('CreateOrderStatusReports', [
      {
        id: globalId('OrderStatusReportNode', crypto.randomUUID()),
        orderId: r.orderId,
        status: r.status,
        reason: r.reason,
        comment: r.comment,
        progress: r.progress,
        reportedAt: new Date().toISOString(),
      },
    ]),
  );
}

export function sendDateUpdate(
  session: Session,
  onSession: (s: Session) => void,
  projectId: string,
  u: DateUpdateInput,
) {
  // Bewusst nur EIN Auftrag pro Änderung (Sicherheitsmaßnahme).
  return withSocket(session, onSession, projectId, (send) =>
    send('UpdateOrders', [{ id: u.id, startAt: u.startAt, finishAt: u.finishAt }]),
  );
}
