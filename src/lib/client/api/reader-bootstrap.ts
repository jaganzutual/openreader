import { parseApiError } from '@/lib/client/api/http';
import { pipeError, pipeLog } from '@/lib/client/tts/pipeline-log';
import type { ReaderBootstrapResult } from '@/types/reader-bootstrap';

export async function getReaderBootstrap(
  documentId: string,
): Promise<ReaderBootstrapResult> {
  const started = Date.now();
  pipeLog('bootstrap', `POST reader-bootstrap doc=${documentId.slice(0, 8)}…`);
  const response = await fetch(
    `/api/documents/${encodeURIComponent(documentId)}/reader-bootstrap`,
    {
      method: 'POST',
      cache: 'no-store',
    },
  );
  if (!response.ok && response.status !== 202) {
    const body = (await response.json().catch(() => null)) as Partial<ReaderBootstrapResult> | null;
    if (body?.status === 'error' && typeof body.message === 'string') {
      pipeError('bootstrap', `POST failed in ${Date.now() - started}ms: ${body.message}`);
      return {
        status: 'error',
        message: body.message,
        retryable: body.retryable !== false,
      };
    }
    throw await parseApiError(response, 'Failed to prepare reader');
  }
  const result = (await response.json()) as ReaderBootstrapResult;
  pipeLog('bootstrap', `POST done in ${Date.now() - started}ms http=${response.status} status=${result.status}`);
  return result;
}

export function subscribeReaderBootstrap(
  documentId: string,
  onSnapshot: (result: ReaderBootstrapResult) => void,
  options?: { operationId?: string | null },
): () => void {
  const params = new URLSearchParams();
  if (options?.operationId) params.set('operationId', options.operationId);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  const source = new EventSource(
    `/api/documents/${encodeURIComponent(documentId)}/reader-bootstrap/events${query}`,
  );
  source.addEventListener('snapshot', (event) => {
    if (!(event instanceof MessageEvent)) return;
    try {
      const result = JSON.parse(event.data) as ReaderBootstrapResult;
      if (result.status !== 'pending' && result.status !== 'ready' && result.status !== 'error') return;
      if (result.status === 'pending') {
        const progress = result.progress;
        pipeLog('bootstrap-sse', `pending phase=${progress?.phase ?? '?'} pages=${progress && 'pagesParsed' in progress ? `${progress.pagesParsed}/${progress.totalPages}` : '?'}${result.operationId ? ` op=${result.operationId.slice(0, 8)}` : ''}`);
      } else if (result.status === 'ready') {
        pipeLog('bootstrap-sse', 'ready — reader payload received');
      } else {
        pipeError('bootstrap-sse', `error: ${result.message} retryable=${result.retryable}`);
      }
      onSnapshot(result);
      if (result.status !== 'pending') source.close();
    } catch {
      // EventSource reconnects; malformed snapshots do not replace valid cache data.
    }
  });
  return () => source.close();
}
