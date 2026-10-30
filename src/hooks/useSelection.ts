import { useState, useCallback, useRef } from 'react';

/** How a new set of keyframe ids folds into the selection the app already has. */
type KeyframeSelectionMode = 'replace' | 'toggle';

const foldKeyframes = (
  previous: string[],
  ids: string[],
  mode: KeyframeSelectionMode,
): string[] => {
  if (mode === 'replace') return Array.from(new Set(ids));
  const next = new Set(previous);
  for (const id of ids) {
    if (next.has(id)) next.delete(id);
    else next.add(id);
  }
  return Array.from(next);
};

export const useSelection = () => {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [booleanOperandEditingGroupId, setBooleanOperandEditingGroupId] = useState<string | null>(null);
  
  const handleSelectPart = useCallback((id: string | null, isMulti: boolean = false) => {
    if (!id) {
      setSelectedPartId(null);
      setSelectedPartIds([]);
      setBooleanOperandEditingGroupId(null);
      return;
    }
    
    if (isMulti) {
      setSelectedPartIds((prev) => {
        if (prev.includes(id)) {
          const newIds = prev.filter((p) => p !== id);
          setSelectedPartId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
          return newIds;
        } else {
          setSelectedPartId(id);
          return [...prev, id];
        }
      });
    } else {
      setSelectedPartId(id);
      setSelectedPartIds([id]);
    }
  }, []);

  const [focusModeNodeId, setFocusModeNodeId] = useState<string | null>(null);

  /**
   * Timeline keyframe selection — ONE canonical set.
   *
   * `selectedKeyframeIds` is the whole selection; `selectedKeyframeId` is its
   * PRIMARY member: the last key the user added, which is the key the single-key
   * authorities (curve editor, delete-frame-group, copy) keep operating on. A
   * single selection is therefore the same thing as a one-member set, and no
   * caller has to reason about two different notions of "selected key".
   */
  const [selectedKeyframeIds, setSelectedKeyframeIds] = useState<string[]>([]);
  const [selectedKeyframeId, setSelectedKeyframeIdState] = useState<string | null>(null);
  // The marquee folds its hits into the selection it captured at pointerdown, so
  // it reads the live set without depending on a render that has not happened.
  const selectedKeyframeIdsRef = useRef<string[]>([]);

  const applyKeyframeSelection = useCallback((next: string[]) => {
    selectedKeyframeIdsRef.current = next;
    setSelectedKeyframeIds(next);
    setSelectedKeyframeIdState(next.length > 0 ? next[next.length - 1] : null);
  }, []);

  /** One key (or none) — the single-key path every existing caller uses. */
  const setSelectedKeyframeId = useCallback((id: string | null) => {
    applyKeyframeSelection(id === null ? [] : [id]);
  }, [applyKeyframeSelection]);

  /** Many keys: `ids` replaces the selection, or toggles into it. */
  const selectKeyframes = useCallback((ids: string[], mode: KeyframeSelectionMode = 'replace') => {
    applyKeyframeSelection(foldKeyframes(selectedKeyframeIdsRef.current, ids, mode));
  }, [applyKeyframeSelection]);

  return {
    selectedPartId,
    setSelectedPartId,
    selectedPartIds,
    setSelectedPartIds,
    handleSelectPart,
    booleanOperandEditingGroupId,
    setBooleanOperandEditingGroupId,
    focusModeNodeId,
    setFocusModeNodeId,
    selectedKeyframeId,
    setSelectedKeyframeId,
    selectedKeyframeIds,
    selectKeyframes,
  };
};
