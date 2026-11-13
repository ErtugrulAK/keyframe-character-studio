import type { BodyPartType, CharacterPart } from '../../types/animator';

/**
 * "what am I editing right now?", answered ONCE.
 *
 * The canvas status strip, the Inspector header and the canvas highlight all
 * read this one description, so they can never name different targets. It is
 * derived from the existing session state (selection, mask edit target, mask
 * draw session, matte navigation trail, active tool and drawing draft); it
 * stores nothing.
 *
 * Priority (the most specific session wins): drawing a shape → drawing a
 * mask → editing a mask path → a new shape tool armed → the matte source
 * reached from its target → the selected layer(s).
 */
export type EditTargetKind = 'drawing-shape' | 'drawing-mask' | 'mask' | 'new-shape' | 'matte-source' | 'layer' | 'layers';

export interface EditTarget {
  kind: EditTargetKind;
  /** The mode name ("Mask editing", "Layer" …). */
  mode: string;
  /** The target path, outermost first ("Photo", "Mask 1"). */
  path: string[];
  /** A short qualifier ("3 points", "matte of Photo", "locked"). */
  detail?: string;
}

export interface EditTargetInput {
  characterParts: CharacterPart[];
  selectedPartId: string | null;
  selectedPartIds: string[];
  maskEditTarget: { ownerPartId: string; maskId: string } | null;
  maskDrawSession: { ownerPartId: string; shape: 'rectangle' | 'ellipse' | 'pen' } | null;
  matteReturnTargetId: string | null;
  activeTool: string;
  pendingShapeType: BodyPartType | null;
  /** Points of an open freeform (Pen) drawing, or null when none is open. */
  freeformPointCount: number | null;
  lockedIds?: ReadonlySet<string>;
}

const nameOf = (part: CharacterPart | undefined, fallback: string): string => part?.name || fallback;

const SHAPE_NAMES: Partial<Record<BodyPartType, string>> = {
  custom_rect: 'Rectangle',
  custom_box: 'Square',
  custom_circle: 'Ellipse',
  custom_star: 'Star',
  custom_triangle: 'Triangle',
  custom_diamond: 'Diamond',
  custom_parallelogram: 'Parallelogram',
  custom_text: 'Text',
};

const shapeName = (type: BodyPartType): string => SHAPE_NAMES[type] ?? type.replace(/^custom_/, '').replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());

/**
 * The plain-language kind of a layer for the Inspector header
 * ("Rectangle", "Path", "Image", "Group"…), never an internal type id.
 */
export const layerTypeLabel = (part: Pick<CharacterPart, 'type' | 'isGroup' | 'booleanOperation'>): string => {
  if (part.isGroup) return 'Group';
  if (part.booleanOperation) return 'Boolean group';
  if (part.type === 'custom_freeform') return 'Path';
  if (part.type === 'custom_image') return 'Image';
  if (part.type === 'custom_video') return 'Video';
  return shapeName(part.type);
};

export const resolveEditTarget = (input: EditTargetInput): EditTarget | null => {
  const partById = new Map(input.characterParts.map((part) => [part.id, part]));
  if (input.freeformPointCount !== null) {
    const count = input.freeformPointCount;
    return { kind: 'drawing-shape', mode: 'Drawing shape', path: ['Pen'], detail: `${count} point${count === 1 ? '' : 's'}` };
  }
  if (input.maskDrawSession) {
    const owner = partById.get(input.maskDrawSession.ownerPartId);
    const shape = input.maskDrawSession.shape === 'pen' ? 'Pen' : input.maskDrawSession.shape === 'ellipse' ? 'Ellipse' : 'Rectangle';
    return { kind: 'drawing-mask', mode: 'Drawing mask', path: [nameOf(owner, input.maskDrawSession.ownerPartId), `${shape} mask`] };
  }
  if (input.maskEditTarget) {
    const owner = partById.get(input.maskEditTarget.ownerPartId);
    const mask = owner?.masks?.find((candidate) => candidate.id === input.maskEditTarget?.maskId);
    return { kind: 'mask', mode: 'Mask editing', path: [nameOf(owner, input.maskEditTarget.ownerPartId), mask?.name || input.maskEditTarget.maskId] };
  }
  if (input.activeTool === 'freeform_draw') return { kind: 'new-shape', mode: 'New shape', path: ['Pen'], detail: 'click: corner · drag: smooth' };
  if (input.activeTool === 'shape_create' && input.pendingShapeType) {
    return { kind: 'new-shape', mode: 'New shape', path: [shapeName(input.pendingShapeType)], detail: 'drag on the canvas' };
  }
  const selected = input.selectedPartId ? partById.get(input.selectedPartId) : undefined;
  if (!selected) return null;
  if (input.matteReturnTargetId && partById.has(input.matteReturnTargetId)) {
    return { kind: 'matte-source', mode: 'Matte source', path: [nameOf(selected, selected.id)], detail: `matte of ${nameOf(partById.get(input.matteReturnTargetId), input.matteReturnTargetId)}` };
  }
  const count = input.selectedPartIds.filter((id) => partById.has(id)).length;
  if (count > 1) return { kind: 'layers', mode: 'Layers', path: [`${count} selected`], detail: `primary ${nameOf(selected, selected.id)}` };
  return {
    kind: 'layer',
    mode: selected.isGroup ? 'Group' : 'Layer',
    path: [nameOf(selected, selected.id)],
    ...(input.lockedIds?.has(selected.id) ? { detail: 'locked' } : {}),
  };
};

/** One line of text for the target ("Mask editing · Photo / Mask 1"). */
export const editTargetText = (target: EditTarget): string => (
  `${target.mode} · ${target.path.join(' / ')}${target.detail ? ` · ${target.detail}` : ''}`
);
