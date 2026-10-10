import { describe, expect, test } from 'vitest';
import {
  isPlaybackBufferReady,
  measurePlaybackBuffer,
  PLAYBACK_RECOVERY_BUFFER_WALL_MS,
} from '@openreader/tts/playback-buffer';

describe('playback ahead buffer', () => {
  const segments = [
    { ordinal: 4, durationMs: 3_000, generated: true },
    { ordinal: 5, durationMs: 8_000, generated: true },
    { ordinal: 6, durationMs: 20_000, generated: false },
  ];

  test('counts contiguous generated audio from the cursor and subtracts its offset', () => {
    expect(measurePlaybackBuffer({
      segments,
      startOrdinal: 4,
      offsetWithinStartSegmentMs: 1_000,
      playbackRate: 1,
    })).toMatchObject({ durationMs: 10_000, wallMs: 10_000, segmentCount: 2 });
  });

  test('scales runway by playback rate and stops at a cache hole', () => {
    const buffer = measurePlaybackBuffer({ segments, startOrdinal: 4, playbackRate: 2 });
    expect(buffer.wallMs).toBe(5_500);
    expect(buffer.reachedDocumentEnd).toBe(false);
    expect(isPlaybackBufferReady({
      segments,
      startOrdinal: 4,
      playbackRate: 1,
      minimumWallMs: PLAYBACK_RECOVERY_BUFFER_WALL_MS,
    })).toBe(false);
  });

  test('dead segments do not deadlock start readiness', () => {
    // An errored chunk at the cursor is streamed as frame-quantized silence;
    // readiness must measure across it instead of timing out forever.
    const withDeadChunk = [
      { ordinal: 0, durationMs: 0, generated: false },
      { ordinal: 1, durationMs: 6_000, generated: true },
      { ordinal: 2, durationMs: 6_000, generated: true },
    ];
    const buffer = measurePlaybackBuffer({ segments: withDeadChunk, startOrdinal: 0, playbackRate: 1 });
    expect(buffer.skippedDead).toBe(1);
    expect(buffer.segmentCount).toBe(2);
    expect(buffer.wallMs).toBe(12_000);
    expect(isPlaybackBufferReady({ segments: withDeadChunk, startOrdinal: 0, playbackRate: 1 })).toBe(true);
  });
});
