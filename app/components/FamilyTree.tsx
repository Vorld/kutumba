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
  NodeMouseHandler,
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
import { transformDataForReactFlow, Relationship, FamilyTreeCustomNode } from '@/lib/utils'; // Removed FamilyTreeNodeData import
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
        const baseMarker: EdgeMarker = { type: MarkerType.ArrowClosed };
        let edgeStyle = {};
        let finalMarker: EdgeMarker | undefined = baseMarker;

        switch (rel.relationship_type) {
          case 'spouse':
            edgeStyle = { stroke: '#555', strokeWidth: 2 };
            finalMarker = undefined;
            break;
          case 'child':
          case 'parent':
            edgeStyle = { stroke: '#2a9d8f', strokeWidth: 2 };
            finalMarker = { ...baseMarker, color: '#2a9d8f' };
            break;
          default:
            edgeStyle = { stroke: '#ccc', strokeWidth: 1 };
        }
        return {
          id: `e-${rel.id}`,
          source: rel.person1_id,
          target: rel.person2_id,
          label: rel.relationship_type,
          style: edgeStyle,
          markerEnd: finalMarker,
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

  const onNodeClick: NodeMouseHandler<FamilyTreeCustomNode> = useCallback(async (_event, node) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const clickedPersonId = node.id;
      const relationshipsResponse = await fetch(`/api/relationships/${clickedPersonId}`);
      if (!relationshipsResponse.ok) {
        console.error(`Failed to fetch relationships for ${clickedPersonId}:`, relationshipsResponse.statusText);
        setIsLoading(false); return;
      }
      const relationships: Relationship[] = await relationshipsResponse.json();
      
      const existingNodeIds = new Set(nodes.map(n => n.id));
      const newPersonIdsToFetch = new Set<string>();

      relationships.forEach(rel => {
        const relatedPersonId = rel.person1_id === clickedPersonId ? rel.person2_id : rel.person1_id;
        if (!existingNodeIds.has(relatedPersonId)) {
          newPersonIdsToFetch.add(relatedPersonId);
        }
      });

      const newNodes: FamilyTreeCustomNode[] = [];
      const newEdges: RFEdge[] = []; // Raw edges

      for (const personIdToFetch of newPersonIdsToFetch) {
        const personResponse = await fetch(`/api/person/${personIdToFetch}`);
        if (!personResponse.ok) {
          console.warn(`Failed to fetch person ${personIdToFetch}:`, personResponse.statusText); continue;
        }
        const personData: Person = await personResponse.json();
        
        const newPersonRelationshipsResponse = await fetch(`/api/relationships/${personIdToFetch}`);
        let newPersonRelationships: Relationship[] = [];
        if (newPersonRelationshipsResponse.ok) {
          newPersonRelationships = await newPersonRelationshipsResponse.json();
        } else {
          console.warn(`Failed to fetch relationships for ${personIdToFetch}:`, newPersonRelationshipsResponse.statusText);
        }
        
        if (personData) {
          // Get nodes and edges from transformDataForReactFlow
          const { nodes: transformedNodes, edges: transformedEdges } = transformDataForReactFlow(personData, newPersonRelationships);
          // Add new node if it doesn't exist
          transformedNodes.forEach(tn => {
            if (!existingNodeIds.has(tn.id) && !newNodes.some(nn => nn.id === tn.id)) {
              newNodes.push(tn);
            }
          });
          newEdges.push(...transformedEdges);
        }
      }

      setNodes(nds => {
        const currentNodes = new Set(nds.map(n => n.id));
        const nodesToAdd = newNodes.filter(n => !currentNodes.has(n.id));
        return [...nds, ...nodesToAdd];
      });

      setEdges(eds => {
        const existingEdgeIds = new Set(eds.map(e => e.id));
        const uniqueNewStyledEdges = newEdges
          .filter(newEdge => !existingEdgeIds.has(newEdge.id))
          .map(edge => {
            const baseMarker: EdgeMarker = { type: MarkerType.ArrowClosed };
            let edgeStyle = {};
            let finalMarker: EdgeMarker | undefined = baseMarker;
            switch (edge.label) {
              case 'spouse': 
                edgeStyle = { stroke: '#555', strokeWidth: 2 }; 
                finalMarker = undefined;
                break;
              case 'child': 
              case 'parent': 
                edgeStyle = { stroke: '#2a9d8f', strokeWidth: 2 }; 
                finalMarker = { ...baseMarker, color: '#2a9d8f' }; 
                break;
              default: 
                edgeStyle = { stroke: '#ccc', strokeWidth: 1 };
            }
            return { ...edge, style: edgeStyle, markerEnd: finalMarker };
          });
        return [...eds, ...uniqueNewStyledEdges];
      });

    } catch (error) {
      console.error(`Error expanding node ${node.id}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, isLoading, setNodes, setEdges]); 

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
        onNodeClick={onNodeClick}
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
