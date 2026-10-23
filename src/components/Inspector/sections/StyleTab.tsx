import React from 'react';
import type { PathOrderCommand } from '../../../utils/maskPathOrder';
import type { BezierPath, CharacterPart, Track, Transform } from '../../../types/animator';
import { StyleColorSection } from './style/StyleColorSection';
import { StyleAppearanceSection } from './style/StyleAppearanceSection';
import { isShapeAppearanceEligible } from '../../../utils/shapeAppearance';
import { StyleTextFields } from './style/StyleTextFields';
import { StyleClonerSection } from './style/StyleClonerSection';
import { StyleParticleSection } from './style/StyleParticleSection';
import { TransformVertexEditor } from './transform/TransformVertexEditor';
import { PathGeometryCard } from './style/PathGeometryCard';
import { ColorCorrectionCard } from './style/ColorCorrectionCard';
import type { ColorCorrectionEffect, LayerMask } from '../../../types/animator';
import type { SceneCoordinateSystem } from '../../../types/composition';
import { StyleMatteSection } from './style/StyleMatteSection';
import type { MaskDrawShape } from '../../../hooks/useMaskEditing';
import { TrimPathSection, type TrimPathChannel } from './style/TrimPathSection';
import { isTrimPathEligible } from '../../../utils/trimPath';

interface StyleTabProps {
  selectedPart: CharacterPart;
  characterParts: CharacterPart[];
  handlePartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  handlePartColorChange: (key: 'fillColor' | 'strokeColor', color: string) => void;
  transform?: Transform;
  coordinateSystem?: SceneCoordinateSystem;
  onChangeMaskPath?: (maskId: string, path: BezierPath) => void;
  /** Mask IDs the layer's track still animates; a new mask never reuses one. */
  reservedMaskIds?: readonly string[];
  /** WP-02: canvas mask editing of this layer. */
  maskEditTargetId?: string | null;
  onEditMaskOnCanvas?: (maskId: string) => void;
  onExitMaskEditing?: () => void;
  /** WP-03: drawing new masks and whole-path transforms. */
  maskDrawShape?: MaskDrawShape | null;
  onStartMaskDraw?: (shape: MaskDrawShape) => void;
  onTransformMaskPath?: (maskId: string, change: { rotation?: number; scaleX?: number; scaleY?: number }) => void;
  /** WP-04: Track Matte target/source navigation. */
  matteReturnTargetId?: string | null;
  onSelectMatteSource?: (targetId: string, sourceId: string) => void;
  onBackToMatteTarget?: () => void;
  onMaskPathOrder?: (maskId: string, command: PathOrderCommand, selectedIndex: number | null) => number | null | undefined;
  onPickRefused?: (reason: string) => void;
  onSelectMatteTarget?: (targetId: string) => void;
  maskPathChannels?: Track['maskPathChannels'];
  maskVertexIndex?: number | null;
  onSelectMaskVertex?: (index: number | null) => void;
  /** Evaluated Trim Path at the current frame; the fields must show what the stage draws. */
  evaluatedTrim?: { start: number; end: number; offset: number };
  onUpdateTrimChannel?: (channel: TrimPathChannel, value: number) => void;
  /** Opens/closes ONE undo entry around a completed color pointer gesture. */
  onColorInteractionStart?: () => void;
  onColorInteractionEnd?: () => void;
  /** C6 — shape ↔ editable path: conversion, and the path's points shared with the canvas. */
  /** WP-08 — colour correction of an image layer. */
  colorCorrection?: {
    evaluatedMasks?: LayerMask[];
    onChangeEffects: (effects: ColorCorrectionEffect[] | undefined) => void;
    onDrawEffectMask: (shape: MaskDrawShape) => void;
    drawingEffectMask: MaskDrawShape | null;
    readOnlyReason: string | null;
  };
  pathEditing?: {
    tracks: Track[];
    readOnlyReason: string | null;
    onConvert: (partId: string) => void;
    onChangePath: (partId: string, path: BezierPath) => void;
    selectedIndex: number | null;
    onSelectIndex: (index: number | null) => void;
  };
}

export const StyleTab: React.FC<StyleTabProps> = ({
  selectedPart,
  characterParts,
  handlePartPropChange,
  handlePartColorChange,
  transform,
  coordinateSystem,
  onChangeMaskPath,
  reservedMaskIds,
  maskEditTargetId,
  onEditMaskOnCanvas,
  onExitMaskEditing,
  maskDrawShape,
  onStartMaskDraw,
  onTransformMaskPath,
  matteReturnTargetId,
  onSelectMatteSource,
  onBackToMatteTarget,
  onMaskPathOrder,
  onPickRefused,
  onSelectMatteTarget,
  maskPathChannels,
  maskVertexIndex,
  onSelectMaskVertex,
  evaluatedTrim,
  onUpdateTrimChannel,
  onColorInteractionStart,
  onColorInteractionEnd,
  pathEditing,
  colorCorrection,
}) => {
  const isTextBearing =
    selectedPart.type === 'custom_card' ||
    selectedPart.type === 'custom_text' ||
    selectedPart.type === 'custom_banner';

  return (
    <>
      {isTrimPathEligible(selectedPart.type) && (
        <TrimPathSection
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
          evaluatedTrim={evaluatedTrim}
          onUpdateTrimChannel={onUpdateTrimChannel}
        />
      )}
      {isShapeAppearanceEligible(selectedPart.type) && (
        <StyleAppearanceSection
          selectedPart={selectedPart}
          onPartPropChange={handlePartPropChange}
          onInteractionStart={onColorInteractionStart}
          onInteractionEnd={onColorInteractionEnd}
        />
      )}
      {!isTextBearing && (
        <StyleColorSection
          selectedPart={selectedPart}
          onPartColorChange={handlePartColorChange}
          onPartPropChange={handlePartPropChange}
          onColorInteractionStart={onColorInteractionStart}
          onColorInteractionEnd={onColorInteractionEnd}
        />
      )}
      <StyleTextFields
        selectedPart={selectedPart}
        onPartColorChange={handlePartColorChange}
        onPartPropChange={handlePartPropChange}
        onColorInteractionStart={onColorInteractionStart}
        onColorInteractionEnd={onColorInteractionEnd}
      />
      {colorCorrection && selectedPart.type === 'custom_image' && (
        <ColorCorrectionCard
          part={selectedPart}
          evaluatedMasks={colorCorrection.evaluatedMasks}
          onChangeEffects={colorCorrection.onChangeEffects}
          onDrawEffectMask={colorCorrection.onDrawEffectMask}
          drawingEffectMask={colorCorrection.drawingEffectMask}
          readOnlyReason={colorCorrection.readOnlyReason}
          onInteractionStart={onColorInteractionStart}
          onInteractionEnd={onColorInteractionEnd}
        />
      )}
      {pathEditing && (
        <PathGeometryCard
          selectedPart={selectedPart}
          tracks={pathEditing.tracks}
          readOnlyReason={pathEditing.readOnlyReason}
          onConvert={pathEditing.onConvert}
          onChangePath={pathEditing.onChangePath}
          selectedIndex={pathEditing.selectedIndex}
          onSelectIndex={pathEditing.onSelectIndex}
          onInteractionStart={onColorInteractionStart}
          onInteractionEnd={onColorInteractionEnd}
        />
      )}
      {selectedPart.type === 'custom_freeform' && !selectedPart.booleanOperandIds?.length && transform && coordinateSystem && (
        <TransformVertexEditor
          selectedPart={selectedPart}
          transform={transform}
          coordinateSystem={coordinateSystem}
          onPartPropChange={handlePartPropChange}
          onChangePath={pathEditing ? (path) => pathEditing.onChangePath(selectedPart.id, path) : undefined}
        />
      )}
      <StyleMatteSection
        selectedPart={selectedPart}
        characterParts={characterParts}
        onPartPropChange={handlePartPropChange}
        onInteractionStart={onColorInteractionStart}
        onInteractionEnd={onColorInteractionEnd}
        onChangeMaskPath={onChangeMaskPath}
        reservedMaskIds={reservedMaskIds}
        maskEditTargetId={maskEditTargetId}
        onEditMaskOnCanvas={onEditMaskOnCanvas}
        onExitMaskEditing={onExitMaskEditing}
        maskDrawShape={maskDrawShape}
        onStartMaskDraw={onStartMaskDraw}
        onTransformMaskPath={onTransformMaskPath}
        matteReturnTargetId={matteReturnTargetId}
        onSelectMatteSource={onSelectMatteSource}
        onBackToMatteTarget={onBackToMatteTarget}
        onMaskPathOrder={onMaskPathOrder}
        onPickRefused={onPickRefused}
        onSelectMatteTarget={onSelectMatteTarget}
        maskPathChannels={maskPathChannels}
        maskVertexIndex={maskVertexIndex}
        onSelectMaskVertex={onSelectMaskVertex}
      />
      <StyleClonerSection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />
      <StyleParticleSection selectedPart={selectedPart} onPartPropChange={handlePartPropChange} />
    </>
  );
};
