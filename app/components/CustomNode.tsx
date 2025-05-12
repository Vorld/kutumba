'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react'; 
import { FamilyTreeNodeData } from '../../lib/utils'; 

// This adds an onNodeClick prop to the standard node props
interface CustomNodeProps extends NodeProps {
  onNodeClick?: (nodeId: string, data: FamilyTreeNodeData) => void;
}

const CustomNode = ({ data, isConnectable, id, onNodeClick }: CustomNodeProps) => {
  // Cast data to FamilyTreeNodeData to access the properties safely
  const nodeData = data as FamilyTreeNodeData;
  const { name, nickname, gender, birthday } = nodeData;
  
  const handleNodeClick = () => {
    if (onNodeClick) {
      onNodeClick(id, nodeData);
    }
  };
  
  return (
    <div
      style={{
        width: '180px', // Fixed width
        height: '100px', // Fixed height
        padding: '10px', // Adjusted padding
        borderRadius: '8px',
        background: gender === 'male' ? 'lightblue' : gender === 'female' ? 'pink' : 'lightgray',
        border: '1px solid #555',
        textAlign: 'center',
        display: 'flex', // Added for centering content
        flexDirection: 'column', // Added for centering content
        justifyContent: 'center', // Added for centering content
        boxSizing: 'border-box', // Ensure padding and border are included in width/height
        overflow: 'hidden', // Hide overflow
        cursor: 'pointer', // Show pointer cursor on hover
      }}
      onClick={handleNodeClick}
      title={`Name: ${name || ''}${nickname ? ` ('${nickname}')` : ''}\nGender: ${gender || 'N/A'}\nBirthday: ${birthday ? new Date(birthday).toLocaleDateString() : 'N/A'}\nClick to edit`}
    >
      <Handle type="target" position={Position.Top} id="parentInput" isConnectable={isConnectable} style={{ top: '-5px' }} />
      <Handle type="source" position={Position.Bottom} id="childOutput" isConnectable={isConnectable} style={{ bottom: '-5px' }} />
      <Handle type="source" position={Position.Left} id="spouseOutputLeft" isConnectable={isConnectable} style={{ left: '-5px' }} />
      <Handle type="target" position={Position.Left} id="spouseInputLeft" isConnectable={isConnectable} style={{ left: '-5px' }} />
      <Handle type="source" position={Position.Right} id="spouseOutputRight" isConnectable={isConnectable} style={{ right: '-5px' }} />
      <Handle type="target" position={Position.Right} id="spouseInputRight" isConnectable={isConnectable} style={{ right: '-5px' }} />
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <strong>{name || ''}</strong>
      </div>
      {nickname && (
        <div style={{ fontSize: '0.8em', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ({nickname})
        </div>
      )}
      {birthday && (
        <div style={{ fontSize: '0.8em', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Born: {new Date(birthday).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

export default memo(CustomNode);
