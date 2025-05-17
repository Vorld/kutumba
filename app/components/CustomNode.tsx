'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react'; 
import { FamilyTreeCustomNode } from '../../lib/utils'; 

// Helper function to format dates in DD-MM-YYYY format
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    // Format as DD-MM-YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

const CustomNode: React.FC<NodeProps<FamilyTreeCustomNode>> = ({ data, isConnectable }) => {
  const { name, nickname, gender, birthday } = data;
  
  // Set background based on gender
  const getBackgroundColor = () => {
    if (gender === 'male') return '#e7e5e4'; // stone-200 (light)
    if (gender === 'female') return '#44403c'; // stone-700 (dark)
    return '#a8a29e'; // stone-400 (medium for unknown/other)
  };
  
  // Set text color based on gender
  const getTextColor = () => {
    if (gender === 'male') return '#44403c'; // stone-700 for light background
    if (gender === 'female') return '#fafaf9'; // stone-50 for dark background
    return '#292524'; // stone-900 for medium background
  };
  
  return (
    <div 
      style={{
        width: '180px',
        height: '100px',
        boxSizing: 'border-box',
        padding: '10px 20px',
        borderRadius: '8px',
        background: getBackgroundColor(),
        border: '1px solid #78716c', // stone-500 border for all
        color: getTextColor(),
        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      title={`Name: ${name}${nickname ? ` ('${nickname}')` : ''}\nGender: ${gender || 'N/A'}\nBirthday: ${formatDate(birthday)}`}
    >
      <Handle type="target" position={Position.Top} id="parentInput" isConnectable={isConnectable} style={{ top: '-5px' }} />
      {/* Single handle for all outgoing connections from the bottom */}
      <Handle type="source" position={Position.Bottom} id="bottomOutput" isConnectable={isConnectable} style={{ bottom: '-5px' }} />
      <div style={{ fontWeight: 'bold' }}>
        {name}
      </div>
      {nickname && (
        <div style={{ fontSize: '0.9em', opacity: 0.8, marginTop: '-2px' }}>
          &apos;{nickname}&apos;
        </div>
      )}
      {birthday && (
        <div style={{ fontSize: '0.8em', opacity: 0.9, marginTop: '4px' }}>
          Born: {formatDate(birthday)}
        </div>
      )}
    </div>
  );
};

export default memo(CustomNode);
