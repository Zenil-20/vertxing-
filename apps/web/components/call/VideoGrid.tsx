/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/VideoGrid.tsx
 * Layer:   Web / Call UI
 * Purpose: The speaker/grid surface. Built directly on `useTracks` + a plain CSS
 *          grid — deliberately NOT LiveKit's paginated <GridLayout>, whose
 *          `updatePages()` races when a camera placeholder swaps to a live track.
 *          Tiles are keyed by `identity:source` so a placeholder→track swap
 *          updates in place instead of remounting. Columns adapt to headcount.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import {
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

export function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const cols = columnsFor(tracks.length);

  return (
    <div
      style={{
        display: 'grid',
        gap: 12,
        width: '100%',
        height: '100%',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: '1fr',
        placeItems: 'stretch',
      }}
    >
      {tracks.map((trackRef) => (
        <ParticipantTile
          key={`${trackRef.participant.identity}:${trackRef.source}`}
          trackRef={trackRef}
          style={{ minHeight: 0, borderRadius: 14, overflow: 'hidden' }}
        />
      ))}
      {/* Renders all subscribed audio — without this you see video but hear nothing. */}
      <RoomAudioRenderer />
    </div>
  );
}
