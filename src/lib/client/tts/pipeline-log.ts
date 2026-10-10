/**
 * Verbose browser-console tracing for the reader TTS pipeline (fork feature).
 * Every stage logs one timestamped line so "what is happening" is answerable
 * from DevTools alone: bootstrap, SSE snapshots, chunk completions, buffer
 * transitions, previews. Always on; DevTools filters hide it when unneeded.
 */
const PREFIX = '%c[reader-pipe]';

function stamp(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

export function pipeLog(stage: string, message: string, detail?: unknown): void {
  const line = `${stamp()} ${stage} ${message}`;
  if (detail !== undefined) {
    console.info(PREFIX, 'color:#4ade80', line, detail);
  } else {
    console.info(PREFIX, 'color:#4ade80', line);
  }
}

export function pipeWarn(stage: string, message: string, detail?: unknown): void {
  const line = `${stamp()} ${stage} ${message}`;
  if (detail !== undefined) {
    console.warn(PREFIX, 'color:#fbbf24', line, detail);
  } else {
    console.warn(PREFIX, 'color:#fbbf24', line);
  }
}

export function pipeError(stage: string, message: string, detail?: unknown): void {
  const line = `${stamp()} ${stage} ${message}`;
  if (detail !== undefined) {
    console.error(PREFIX, 'color:#f87171', line, detail);
  } else {
    console.error(PREFIX, 'color:#f87171', line);
  }
}
