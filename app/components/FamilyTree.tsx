'use client';

import React, { useEffect, useState, useCallback, ChangeEvent, useMemo } from 'react';
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
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Fuse from 'fuse.js';
import dagre from 'dagre';

import CustomNode from './CustomNode';
import { Relationship, FamilyTreeCustomNode } from '@/lib/utils';
import type { Person } from '@/types';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// Dagre layout function
const getLayoutedElements = (nodes: FamilyTreeCustomNode[], edges: RFEdge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({})); // Default for edges passed to Dagre
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 120 }); // Adjusted ranksep for more space

  nodes.forEach((node) => {
    // Ensure node dimensions are considered. These are estimates; might need adjustment.
    // Or, get actual dimensions if CustomNode renders with fixed size or after first render.
    const nodeWidth = 150; // Approximate width of CustomNode
    const nodeHeight = 100; // Approximate height of CustomNode
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // ONLY add hierarchical (parent-child) edges to Dagre for layout calculation.
  // Spouse edges are in the 'edges' array for React Flow to render but are not used by Dagre for ranking here.
  edges.forEach((edge) => {
    if (edge.label === 'is parent of') {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top, // For dagre layout, good to specify
      sourcePosition: Position.Bottom, // For dagre layout
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };
  });
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

      const initialNodes: FamilyTreeCustomNode[] = allPersonsData.map(person => ({
        id: person.id,
        type: 'custom',
        data: { ...person, label: person.name || person.id },
        position: { x: 0, y: 0 }, // Initial position, dagre will overwrite
      }));

      const initialEdges: RFEdge[] = allRelationshipsData.map(rel => {
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

      // Apply Dagre layout
      const layoutedNodes = getLayoutedElements(initialNodes, initialEdges);
      setNodes(layoutedNodes);
      setEdges(initialEdges);

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
        nodesDraggable={false}
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
