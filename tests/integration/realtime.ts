import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

export type InsertListener = {
  /** Resolves with the next inserted row, or rejects after `timeoutMs`. */
  next(timeoutMs?: number): Promise<Row>;
  /** Everything received so far. */
  received: Row[];
  close(): Promise<void>;
};

/**
 * Subscribe to INSERTs on a table and resolve only once Realtime confirms the
 * Postgres listener is attached ("Subscribed to PostgreSQL" system message).
 * The channel's own SUBSCRIBED status arrives earlier; inserting between the
 * two is the classic source of flaky Realtime tests.
 */
export async function listenForInserts(
  client: SupabaseClient,
  table: string,
  filter?: string,
  readyTimeoutMs = 10_000,
): Promise<InsertListener> {
  const received: Row[] = [];
  const waiters: Array<(row: Row) => void> = [];

  let channel: RealtimeChannel;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Realtime listener on ${table} not ready after ${readyTimeoutMs}ms`)),
      readyTimeoutMs,
    );
    channel = client
      .channel(`test-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, (payload) => {
        const row = payload.new as Row;
        received.push(row);
        waiters.shift()?.(row);
      })
      .on('system', {}, (payload: { extension?: string; status?: string }) => {
        if (payload.extension === 'postgres_changes' && payload.status === 'ok') {
          clearTimeout(timer);
          resolve();
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          reject(err ?? new Error(`Realtime subscribe failed: ${status}`));
        }
      });
  });

  return {
    received,
    next(timeoutMs = 5_000) {
      return new Promise<Row>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No ${table} insert within ${timeoutMs}ms`)), timeoutMs);
        waiters.push((row) => {
          clearTimeout(timer);
          resolve(row);
        });
      });
    },
    async close() {
      await client.removeChannel(channel);
    },
  };
}
