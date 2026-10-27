import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { matteTargetsOfSource, resolveEffectiveMatteRelationship } from '../../../../utils/matteRelationship';

interface TrackMatteSummaryProps {
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  /** The target the user arrived from with "Select Source", if any. */
  returnTargetId?: string | null;
  onSelectSource?: (targetId: string, sourceId: string) => void;
  onBackToTarget?: () => void;
  onSelectTarget?: (targetId: string) => void;
}

const MODE_LABEL: Record<string, string> = { alpha: 'Alpha', luminance: 'Luma', clip: 'Clip' };
const nameOf = (part: CharacterPart | undefined, fallbackId: string): string => part?.name || fallbackId;

/**
 * WP-04 — the one Track Matte reading of the selected layer, in product
 * language: which layer it uses as its matte (V2 or legacy, through the shared
 * precedence authority), whether that source is really painted, which other
 * targets hide it, and the transient navigation between target and source.
 * Purely presentational: every action is a selection change.
 */
export const TrackMatteSummary: React.FC<TrackMatteSummaryProps> = ({
  selectedPart,
  characterParts,
  returnTargetId = null,
  onSelectSource,
  onBackToTarget,
  onSelectTarget,
}) => {
  const relationship = resolveEffectiveMatteRelationship(selectedPart, characterParts);
  const targets = matteTargetsOfSource(selectedPart.id, characterParts);
  const returnTarget = returnTargetId ? characterParts.find((part) => part.id === returnTargetId) : undefined;

  return (
    <div className="matte-span-full track-matte-summary" data-testid="track-matte-summary">
      {/* C12 — a layer with no matte of its own (shown here only because it is
          another layer's source) gets no "No track matte" line. */}
      {relationship && (
        <div className="track-matte-summary-row" data-relationship-kind={relationship.kind} data-relationship-status={relationship.status}>
          <span>
            Matte source: <strong>{nameOf(relationship.source, relationship.sourceId)}</strong>
            {' · '}
            {MODE_LABEL[relationship.mode] ?? relationship.mode}
            {relationship.inverted ? ' · Inverted' : ''}
            {relationship.kind === 'legacy' ? ' · Legacy clip matte' : ''}
          </span>
          {relationship.status === 'active' && onSelectSource && (
            <button
              type="button"
              className="btn-secondary"
              data-lock-exempt
              title="Select the source layer to move or edit it; the target stays where it is"
              onClick={() => onSelectSource(selectedPart.id, relationship.sourceId)}
            >
              Select Source
            </button>
          )}
        </div>
      )}
      {relationship?.status === 'missing' && (
        <div className="track-matte-summary-warning" role="status">
          The matte source ({relationship.sourceId}) is missing, so no matte is applied. Undo restores a deleted source.
        </div>
      )}
      {relationship?.status === 'self' && (
        <div className="track-matte-summary-warning" role="status">A layer cannot be its own matte source; no matte is applied.</div>
      )}
      {relationship?.status === 'active' && relationship.kind === 'track' && relationship.showSourceSetting && !relationship.sourcePainted && (
        <div className="track-matte-summary-warning" role="status" data-testid="track-matte-visibility-conflict">
          “Show source” is on, but the source is hidden in the composition by another matte target:{' '}
          {relationship.hiddenByOtherTargets.map((part) => part.name || part.id).join(', ')}.
        </div>
      )}
      {relationship?.legacyShadowed && (
        <div className="track-matte-summary-note">Legacy clip matte settings are preserved but inactive while this Track Matte is enabled.</div>
      )}
      {targets.length > 0 && (
        <div className="track-matte-summary-row" data-testid="track-matte-targets">
          <span>Used as the matte of: {targets.map((part) => part.name || part.id).join(', ')}</span>
          {returnTarget && onBackToTarget ? (
            <button type="button" className="btn-primary" data-lock-exempt onClick={onBackToTarget}>
              Back to {nameOf(returnTarget, returnTarget.id)}
            </button>
          ) : (
            targets.length === 1 && onSelectTarget && (
              <button type="button" className="btn-secondary" data-lock-exempt onClick={() => onSelectTarget(targets[0].id)}>
                Select {nameOf(targets[0], targets[0].id)}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
