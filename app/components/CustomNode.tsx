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
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <div>
        <strong>{name}</strong>
      </div>
      {birthday && (
        <div style={{ fontSize: '0.8em', color: '#333' }}>
          Born: {new Date(birthday).toLocaleDateString()}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
};

export default memo(CustomNode);
