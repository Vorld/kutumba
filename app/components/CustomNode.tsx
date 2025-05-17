'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react'; 
import { FamilyTreeCustomNode } from '../../lib/utils'; 

const CustomNode: React.FC<NodeProps<FamilyTreeCustomNode>> = ({ data, isConnectable }) => {
  const { name, nickname, gender, birthday } = data;
  
  return (
    <div 
      style={{
        width: '180px',
        height: '100px',
        boxSizing: 'border-box',
        padding: '10px 20px',
        borderRadius: '8px',
        background: gender === 'male' ? '#lightblue' : gender === 'female' ? '#pink' : '#lightgray',
        border: '1px solid #555',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      title={`Name: ${name}${nickname ? ` ('${nickname}')` : ''}\nGender: ${gender || 'N/A'}\nBirthday: ${birthday ? new Date(birthday).toLocaleDateString() : 'N/A'}`}
    >
      <Handle type="target" position={Position.Top} id="parentInput" isConnectable={isConnectable} style={{ top: '-5px' }} />
      {/* Original childOutput and spouseOutputBottom handles are replaced by a single bottomOutput handle */}
      {/* <Handle type="source" position={Position.Bottom} id="childOutput" isConnectable={isConnectable} style={{ bottom: '-5px', left: '25%' }} /> */}
      {/* <Handle type="source" position={Position.Bottom} id="spouseOutputBottom" isConnectable={isConnectable} style={{ bottom: '-5px', left: '75%'}} /> */}

      {/* Single handle for all outgoing connections from the bottom (e.g., to marriage node as spouse, or to children as parent) */}
      <Handle type="source" position={Position.Bottom} id="bottomOutput" isConnectable={isConnectable} style={{ bottom: '-5px' }} />
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
