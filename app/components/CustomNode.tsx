'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react'; 
import { FamilyTreeCustomNode } from '../../lib/utils'; 

const CustomNode: React.FC<NodeProps<FamilyTreeCustomNode>> = ({ data, isConnectable }) => {
  const { name, nickname, gender, birthday } = data;
  
  return (
    <div 
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: gender === 'male' ? '#lightblue' : gender === 'female' ? '#pink' : '#lightgray',
        border: '1px solid #555',
        textAlign: 'center'
      }}
      title={`Name: ${name}${nickname ? ` ('${nickname}')` : ''}\nGender: ${gender || 'N/A'}\nBirthday: ${birthday ? new Date(birthday + 'T00:00:00').toLocaleDateString() : 'N/A'}`}
    >
      <Handle type="target" position={Position.Top} id="parentInput" isConnectable={isConnectable} style={{ top: '-5px' }} />
      <Handle type="source" position={Position.Bottom} id="childOutput" isConnectable={isConnectable} style={{ bottom: '-5px' }} />
      <Handle type="source" position={Position.Left} id="spouseOutputLeft" isConnectable={isConnectable} style={{ left: '-5px' }} />
      <Handle type="target" position={Position.Left} id="spouseInputLeft" isConnectable={isConnectable} style={{ left: '-5px' }} />
      <Handle type="source" position={Position.Right} id="spouseOutputRight" isConnectable={isConnectable} style={{ right: '-5px' }} />
      <Handle type="target" position={Position.Right} id="spouseInputRight" isConnectable={isConnectable} style={{ right: '-5px' }} />
      <div>
        <strong>{name}</strong>
      </div>
      {birthday && (
        <div style={{ fontSize: '0.8em', color: '#333' }}>
          Born: {new Date(birthday).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

export default memo(CustomNode);
