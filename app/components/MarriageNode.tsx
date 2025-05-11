'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FamilyTreeCustomNode } from '@/lib/utils';

/**
 * Marriage node with THREE fixed ports
 *   • id="left"   (target, Position.Left)   – left-side spouse
 *   • id="right"  (target, Position.Right)  – right-side spouse
 *   • id="down"   (source, Position.Bottom) – children
 *
 * Port IDs line up 1-for-1 with the ELK ports declared in FamilyTreeElk.tsx.
 */
const MarriageNode: React.FC<NodeProps<FamilyTreeCustomNode>> = ({ isConnectable }) => (
  <div
    style={{
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: '#888',
      border: '1.5px solid #555',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      fontSize: '0.7em',
    }}
  >
    {/* LEFT spouse */}
    <Handle
      type="target"
      id="left"
      position={Position.Left}
      isConnectable={isConnectable}
      style={{ background: '#777' }}
    />
    {/* RIGHT spouse */}
    <Handle
      type="target"
      id="right"
      position={Position.Right}
      isConnectable={isConnectable}
      style={{ background: '#777' }}
    />
    {/* Children */}
    <Handle
      type="source"
      id="down"
      position={Position.Bottom}
      isConnectable={isConnectable}
      style={{ background: '#777' }}
    />
  </div>
);

export default memo(MarriageNode);
