'use client';

import React, { useEffect, useState, useCallback, ChangeEvent, useMemo, MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Edge as RFEdge,
  MarkerType,
  EdgeMarker,
  ConnectionLineType,
  OnConnect,
  useReactFlow,
  ReactFlowProvider,
  NodeTypes,
  OnNodeDrag, 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Fuse from 'fuse.js';

import CustomNode from './CustomNode'; 
import { Relationship, FamilyTreeCustomNode } from '@/lib/utils'; 
import type { Person } from '@/types';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

interface FamilyTreeProps {
  initialPersonId: string;
}

const FamilyTree: React.FC<FamilyTreeProps> = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyTreeCustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fuse, setFuse] = useState<Fuse<FamilyTreeCustomNode> | null>(null);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodes.length > 0) {
      setFuse(new Fuse(nodes, {
        keys: ['data.name', 'data.label', 'data.nickname'],
        includeScore: true,
        threshold: 0.4,
      }));
    } else {
      setFuse(null);
    }
  }, [nodes]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Updated fetchDataAndSetFlow to load ALL persons and ALL relationships
  const fetchDataAndSetFlow = useCallback(async () => {
    setIsLoading(true);
    try {
      const allPersonsResponse = await fetch('/api/persons');
      if (!allPersonsResponse.ok) {
        console.error('Failed to fetch all persons data:', allPersonsResponse.statusText);
        setIsLoading(false); return;
      }
      const allPersonsData: Person[] = await allPersonsResponse.json();

      const allRelationshipsResponse = await fetch('/api/relationships/all');
      if (!allRelationshipsResponse.ok) {
        console.error('Failed to fetch all relationships:', allRelationshipsResponse.statusText);
        setIsLoading(false); return;
      }
      const allRelationshipsData: Relationship[] = await allRelationshipsResponse.json();

      if (!allPersonsData || allPersonsData.length === 0) {
        console.warn('No persons data found. The tree will be empty.');
        setNodes([]);
        setEdges([]);
        setIsLoading(false);
        return;
      }

      const reactFlowNodes: FamilyTreeCustomNode[] = allPersonsData.map(person => ({
        id: person.id,
        type: 'custom',
        data: { ...person, label: person.name || person.id },
        position: { x: Math.random() * 1200, y: Math.random() * 800 }, // Spread them out a bit more
      }));

      const reactFlowEdges: RFEdge[] = allRelationshipsData.map(rel => {
        const baseMarkerColor = '#2a9d8f';
        const baseMarker: EdgeMarker = { type: MarkerType.ArrowClosed, color: baseMarkerColor };
        let edgeStyle = {};
        let finalMarker: EdgeMarker | undefined = baseMarker;
        let sourceId = rel.person1_id;
        let targetId = rel.person2_id;
        let edgeLabel: string = rel.relationship_type;
        let sHandle: string | undefined = undefined;
        let tHandle: string | undefined = undefined;

        switch (rel.relationship_type) {
          case 'spouse':
            edgeStyle = { stroke: '#555', strokeWidth: 2 };
            finalMarker = undefined; // No arrow for spouses
            sHandle = 'spouseOutputRight'; 
            tHandle = 'spouseInputLeft';
            // edgeLabel remains 'spouse'
            break;
          case 'child': // API means: rel.person1_id is CHILD, rel.person2_id is PARENT
            sourceId = rel.person2_id; // Parent
            targetId = rel.person1_id; // Child
            edgeStyle = { stroke: baseMarkerColor, strokeWidth: 2 };
            finalMarker = { ...baseMarker };
            sHandle = 'childOutput';    // From parent's bottom
            tHandle = 'parentInput';    // To child's top
            edgeLabel = 'is parent of';
            break;
          case 'parent': // API means: rel.person1_id is PARENT, rel.person2_id is CHILD
            sourceId = rel.person1_id; // Parent
            targetId = rel.person2_id; // Child
            edgeStyle = { stroke: baseMarkerColor, strokeWidth: 2 };
            finalMarker = { ...baseMarker };
            sHandle = 'childOutput';    // From parent's bottom
            tHandle = 'parentInput';    // To child's top
            edgeLabel = 'is parent of';
            break;
          default: // Unknown relationship types
            edgeStyle = { stroke: '#ccc', strokeWidth: 1 };
            finalMarker = { type: MarkerType.ArrowClosed, color: '#ccc' };
            // Default handles will be used if sHandle/tHandle remain undefined
        }
        return {
          id: `e-${rel.id}`,
          source: sourceId,
          target: targetId,
          label: edgeLabel,
          style: edgeStyle,
          markerEnd: finalMarker,
          sourceHandle: sHandle,
          targetHandle: tHandle,
        };
      });

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);

    } catch (error) {
      console.error('Error fetching initial data for the entire tree:', error);
      setNodes([]); 
      setEdges([]); 
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    // initialPersonId is no longer used for the primary data fetch here,
    // as we are fetching all data. It could be used later for focusing the view.
    fetchDataAndSetFlow();
  }, [fetchDataAndSetFlow]);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: ConnectionLineType.SmoothStep, animated: true }, eds)),
    [setEdges],
  );

  // Correctly type onNodeDragStop and remove unused _nodesSnapshot
  const onNodeDragStop: OnNodeDrag<FamilyTreeCustomNode> = useCallback((_event: ReactMouseEvent, node: FamilyTreeCustomNode) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id ? { ...n, position: node.position } : n
      )
    );
    console.log('Node dragged and stopped:', node.id, node.position);
  }, [setNodes]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const searchResults = useMemo(() => {
    if (!debouncedSearchTerm.trim() || !fuse) {
      return [];
    }
    return fuse.search(debouncedSearchTerm.trim()).map(result => result.item as FamilyTreeCustomNode);
  }, [debouncedSearchTerm, fuse]);

  useEffect(() => {
    if (searchResults.length > 0) {
      const primaryResultId = searchResults[0].id;
      const nodeToFocus = nodes.find(n => n.id === primaryResultId);
      if (nodeToFocus) {
        console.log('Primary search result:', nodeToFocus);
        fitView({ nodes: [{id: primaryResultId}], duration: 800, padding: 0.2 });
      }
    }
  }, [searchResults, fitView, nodes]);

  function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);
    return debouncedValue;
  }

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <div style={{ padding: '10px', position: 'absolute', zIndex: 4 }}>
        <input
          type="text"
          placeholder="Search by name or nickname..."
          value={searchTerm}
          onChange={handleSearchChange}
          style={{ padding: '8px', marginRight: '10px' }}
        />
        {isLoading && <span>Loading...</span>}
      </div>
      <ReactFlow
        nodes={nodes.map(node => ({
          ...node,
          style: searchResults.find(n => n.id === node.id) ? { ...node.style, border: '2px solid blue', boxShadow: '0 0 10px blue' } : node.style,
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        zoomOnScroll
        panOnDrag
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{ animated: true, type: 'smoothstep' }}
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
};

const FamilyTreeWrapper: React.FC<FamilyTreeProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FamilyTree {...props} />
    </ReactFlowProvider>
  );
};

export default FamilyTreeWrapper;
