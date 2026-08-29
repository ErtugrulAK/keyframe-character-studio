import { useState, useCallback } from 'react';

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
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

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
  };
};
