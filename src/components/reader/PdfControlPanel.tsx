'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useTTS, useTTSPlaybackProgress } from '@/contexts/TTSContext';
import { useConfig } from '@/contexts/ConfigContext';
import { measurePlaybackBuffer } from '@openreader/tts/playback-buffer';
import {
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  SkipBackwardIcon,
  SkipForwardIcon,
} from '@/components/icons/Icons';
import { LoadingSpinner } from '@/components/Spinner';
import { IconButton, RangeField, Section } from '@/components/ui';
import { formatPlaybackTime } from '@/lib/client/format-playback-time';
import { resolvePlaybackControlPresentation } from '@/lib/client/tts/playback-control';
import {
  readyTimelineBands,
  scrubUndoTargetSec,
  timelineBandsGradient,
  timelineFraction,
} from '@/lib/client/tts/playback-timeline-track';
import { useDocumentArtworkUrl, useMediaSession } from '@/hooks/audio/useMediaSession';

const SCRUB_UNDO_MS = 10_000;
const SCRUB_READY_COLOR = 'color-mix(in srgb, var(--accent) 34%, transparent)';
const MIN_SPEED = 0.5;
const MAX_SPEED = 3;

function formatSpeed(speed: number): string {
  return `${Number(speed.toFixed(2))}x`;
}

function PanelTransport({ documentTitle, isPlaybackReady, hasReadableContent }: {
  documentTitle?: string;
  isPlaybackReady?: boolean;
  hasReadableContent?: boolean;
}) {
  const {
    isPlaying,
    playbackPhase,
    audioSpeed,
    togglePlay,
    skipForward,
    skipBackward,
    isProcessing,
    seekPlaybackTo,
    playbackPlanReady,
    activeReaderType,
  } = useTTS();
  const playbackReady = (isPlaybackReady ?? true) && playbackPlanReady;
  const readable = hasReadableContent ?? true;
  const { playbackTimeSec, playbackDurationSec, playbackSeekLayout } = useTTSPlaybackProgress();
  const [previewSec, setPreviewSec] = useState<number | null>(null);
  const shownSec = previewSec ?? playbackTimeSec;
  const canSeek = playbackDurationSec > 0 && Boolean(playbackSeekLayout);
  const playbackControl = resolvePlaybackControlPresentation(isPlaying, playbackPhase);
  const aheadBuffer = useMemo(() => {
    if (!playbackSeekLayout || playbackSeekLayout.segments.length === 0) return null;
    const segment = playbackSeekLayout.segments.find(
      (entry) => playbackTimeSec * 1000 >= entry.startMs && playbackTimeSec * 1000 < entry.endMs,
    );
    if (!segment) return null;
    return measurePlaybackBuffer({
      segments: playbackSeekLayout.segments,
      startOrdinal: segment.ordinal,
      offsetWithinStartSegmentMs: Math.max(0, playbackTimeSec * 1000 - segment.startMs),
      playbackRate: audioSpeed,
    });
  }, [audioSpeed, playbackSeekLayout, playbackTimeSec]);
  const readyBandBackground = useMemo(
    () => timelineBandsGradient(readyTimelineBands(playbackSeekLayout), SCRUB_READY_COLOR),
    [playbackSeekLayout],
  );
  const heardPercent = timelineFraction(shownSec, playbackDurationSec) * 100;

  const scrubOriginSecRef = useRef<number | null>(null);
  const [scrubUndo, setScrubUndo] = useState<{ targetSec: number; id: number } | null>(null);
  useEffect(() => {
    if (!scrubUndo) return undefined;
    const timeout = setTimeout(() => {
      setScrubUndo((current) => (current?.id === scrubUndo.id ? null : current));
    }, SCRUB_UNDO_MS);
    return () => clearTimeout(timeout);
  }, [scrubUndo]);
  const beginScrub = useCallback(() => {
    scrubOriginSecRef.current ??= playbackTimeSec;
  }, [playbackTimeSec]);
  const commitScrub = useCallback((target: number) => {
    const origin = scrubOriginSecRef.current ?? playbackTimeSec;
    scrubOriginSecRef.current = null;
    setPreviewSec(null);
    const undoTargetSec = scrubUndoTargetSec(playbackSeekLayout, origin, target);
    seekPlaybackTo(target);
    setScrubUndo(undoTargetSec === null ? null : { targetSec: undoTargetSec, id: Date.now() });
  }, [playbackSeekLayout, playbackTimeSec, seekPlaybackTo]);
  const undoScrub = useCallback(() => {
    if (!scrubUndo) return;
    setScrubUndo(null);
    seekPlaybackTo(scrubUndo.targetSec);
  }, [scrubUndo, seekPlaybackTo]);

  const { id: routeDocumentId } = useParams<{ id?: string | string[] }>();
  const documentId = Array.isArray(routeDocumentId) ? routeDocumentId[0] ?? null : routeDocumentId ?? null;
  const artworkUrl = useDocumentArtworkUrl(documentId, activeReaderType, isPlaying);
  useMediaSession({
    title: documentTitle ?? null,
    artworkUrl,
    isPlaying,
    positionSec: playbackTimeSec,
    durationSec: playbackDurationSec,
    playbackRate: audioSpeed,
    togglePlay,
    skipForward,
    skipBackward,
    seekTo: seekPlaybackTo,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <IconButton
          onClick={skipBackward}
          aria-label="Skip backward"
          disabled={isProcessing || !playbackReady || !readable}
          className="h-10 w-10 rounded-full"
        >
          {isProcessing ? <LoadingSpinner /> : <SkipBackwardIcon className="h-5 w-5" />}
        </IconButton>
        <IconButton
          onClick={togglePlay}
          aria-label={playbackControl.ariaLabel}
          aria-busy={playbackControl.isPending}
          disabled={!isPlaying && (!playbackReady || !readable)}
          className="h-14 w-14 rounded-full bg-accent text-white hover:brightness-110"
        >
          {!readable
            ? <PlayIcon className="h-6 w-6" />
            : !isPlaying && !playbackReady
            ? <LoadingSpinner className="text-white" />
            : playbackControl.isPending
            ? <LoadingSpinner className="text-white" />
            : (isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />)}
        </IconButton>
        <IconButton
          onClick={skipForward}
          aria-label="Skip forward"
          disabled={isProcessing || !playbackReady || !readable}
          className="h-10 w-10 rounded-full"
        >
          {isProcessing ? <LoadingSpinner /> : <SkipForwardIcon className="h-5 w-5" />}
        </IconButton>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-soft select-none">
        <span>
          {readable
            ? playbackControl.statusText
              ?? `${formatPlaybackTime(shownSec)} / ${formatPlaybackTime(playbackDurationSec)}`
            : 'No readable text'}
        </span>
        {aheadBuffer && (isPlaying || playbackPhase === 'buffering') && (
          <span
            className="whitespace-nowrap rounded-full bg-accent-wash px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-accent"
            aria-live="polite"
          >
            {playbackPhase === 'buffering'
              ? `Loading ahead · ${Math.floor(aheadBuffer.wallMs / 1000)}s ready`
              : `${Math.floor(aheadBuffer.wallMs / 1000)}s ahead`}
          </span>
        )}
      </div>

      <div className="group/scrubber relative h-6">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--foreground)_16%,transparent)]" />
        {readyBandBackground && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full"
            style={{ background: readyBandBackground }}
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-accent"
          style={{ width: `${heardPercent}%` }}
        />
        <input
          aria-label="Playback position"
          type="range"
          min={0}
          max={Math.max(0, Math.round(playbackDurationSec))}
          step={0.25}
          value={Math.min(Math.max(0, shownSec), Math.max(0, playbackDurationSec))}
          disabled={!canSeek}
          onPointerDown={beginScrub}
          onChange={(event) => {
            beginScrub();
            setPreviewSec(Number(event.currentTarget.value));
          }}
          onPointerUp={(event) => {
            commitScrub(Number((event.currentTarget as HTMLInputElement).value));
          }}
          onKeyUp={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            commitScrub(Number((event.currentTarget as HTMLInputElement).value));
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-40
            [&::-webkit-slider-runnable-track]:h-[4px] [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:-mt-[6px]
            [&::-moz-range-track]:h-[4px] [&::-moz-range-track]:bg-transparent
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent"
        />
        {previewSec !== null && playbackDurationSec > 0 && (
          <div
            className="absolute bottom-full mb-1 -translate-x-1/2 rounded border border-line-soft bg-surface-solid px-2 py-0.5 text-[10px] font-semibold text-foreground shadow-elev-2 pointer-events-none whitespace-nowrap"
            style={{ left: `${Math.min(95, Math.max(5, (shownSec / playbackDurationSec) * 100))}%` }}
          >
            {formatPlaybackTime(shownSec)}
          </div>
        )}
        {scrubUndo && previewSec === null && (
          <button
            type="button"
            onClick={undoScrub}
            className="absolute bottom-full right-0 mb-1 inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-solid px-2.5 py-0.5 text-[11px] font-medium text-accent shadow-elev-2 hover:bg-accent-wash"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

function PanelSpeed() {
  const { audioPlayerSpeed } = useConfig();
  const { setAudioPlayerSpeedAndRestart, isProcessing } = useTTS();
  const [localSpeed, setLocalSpeed] = useState(audioPlayerSpeed);
  useEffect(() => {
    setLocalSpeed(audioPlayerSpeed);
  }, [audioPlayerSpeed]);
  const commit = useCallback(() => {
    if (localSpeed !== audioPlayerSpeed) setAudioPlayerSpeedAndRestart(localSpeed);
  }, [localSpeed, audioPlayerSpeed, setAudioPlayerSpeedAndRestart]);

  return (
    <Section title="Speed" variant="group">
      <RangeField
        label="Playback speed"
        value={localSpeed}
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={0.1}
        formatter={formatSpeed}
        description="Applies instantly without regenerating audio."
        onChange={(value) => setLocalSpeed(value)}
        onPointerUp={commit}
        onKeyUp={commit}
        onTouchEnd={commit}
        disabled={isProcessing}
      />
    </Section>
  );
}

/**
 * Docked right-hand control panel for the PDF reader: transport, speed,
 * voice selection and reader settings share one always-visible column so the
 * PDF keeps a stable 75% of the width.
 */
export function PdfControlPanel({ documentTitle, isPlaybackReady, hasReadableContent, voice, settings, onCollapse }: {
  documentTitle?: string;
  isPlaybackReady?: boolean;
  hasReadableContent?: boolean;
  /** Voice selection form (docked VoiceSidebar). */
  voice: ReactNode;
  /** Reader settings form (docked DocumentSettings). */
  settings: ReactNode;
  onCollapse: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line-soft bg-surface-solid lg:h-full">
      <div className="flex shrink-0 items-center justify-between border-b border-line-soft px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Controls</h2>
        <IconButton onClick={onCollapse} aria-label="Hide controls panel" title="Hide controls panel">
          <ChevronRightIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="min-h-0 space-y-5 px-4 py-4 lg:flex-1 lg:overflow-y-auto">
        <Section title="Playback" variant="group">
          <PanelTransport
            documentTitle={documentTitle}
            isPlaybackReady={isPlaybackReady}
            hasReadableContent={hasReadableContent}
          />
        </Section>
        <PanelSpeed />
        <div id="pdf-voice-section">
          <Section title="Voice" variant="group">
            {voice}
          </Section>
        </div>
        <div id="pdf-settings-section">
          <Section title="Reader settings" variant="group">
            {settings}
          </Section>
        </div>
      </div>
    </div>
  );
}
