'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FamilyTreeCustomNode } from '@/lib/utils';

const MarriageNode: React.FC<NodeProps<FamilyTreeCustomNode>> = ({ data, isConnectable }) => {
  // data prop is available if needed for future use (e.g., displaying marriage date)
  // The type for `data` will be FamilyTreeCustomNode['data'], which is FamilyTreeNodeData
  // Accessing data.color should be fine if FamilyTreeNodeData includes an optional color property.
  const nodeColor = (data as any)?.color || '#888'; 
  return (
    <div
      style={{
        width: '10px', // Reduced size
        height: '10px', // Reduced size
        borderRadius: '50%',
        background: nodeColor, 
        border: '1.5px solid #555', // Thinner border
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontSize: '0.7em', // Slightly smaller font if we add text later
      }}
    >
      {/* Handles for spouses (target) and children (source) */}
      <Handle type="target" position={Position.Top} id="spouseInputTop" isConnectable={isConnectable} style={{ top: '-5px', background: '#777' }} />
      <Handle type="source" position={Position.Bottom} id="childOutput" isConnectable={isConnectable} style={{ bottom: '-5px', background: '#777' }} />
    </div>
  );
};

export default memo(MarriageNode);