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
import MarriageNode from './MarriageNode';
import { Relationship, FamilyTreeCustomNode } from '@/lib/utils';
import type { Person } from '@/types';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
  marriage: MarriageNode,
};

// Dagre layout function
const getLayoutedElements = (nodes: FamilyTreeCustomNode[], edges: RFEdge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  // Adjust ranksep for vertical spacing; nodesep for horizontal
  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 30 }); // Reduced ranksep

  nodes.forEach((node) => {
    const nodeWidth = node.type === 'marriage' ? 40 : 150; // Made marriage node smaller
    const nodeHeight = node.type === 'marriage' ? 40 : 100; // Made marriage node smaller
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    if (edge.data?.layoutType === 'hierarchical') {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.type === 'marriage' ? 40 : 150;
    const height = node.type === 'marriage' ? 40 : 100;
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
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
      setFuse(new Fuse(nodes.filter(n => n.type === 'custom'), { // Only search person nodes
        keys: ['data.name', 'data.label', 'data.nickname'],
        includeScore: true,
        threshold: 0.4,
      }));
    } else {
      setFuse(null);
    }
  }, [nodes]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchDataAndSetFlow = useCallback(async () => {
    setIsLoading(true);
    try {
      const allPersonsResponse = await fetch('/api/persons');
      if (!allPersonsResponse.ok) throw new Error(`Failed to fetch persons: ${allPersonsResponse.statusText}`);
      const allPersonsData: Person[] = await allPersonsResponse.json();

      const allRelationshipsResponse = await fetch('/api/relationships/all');
      if (!allRelationshipsResponse.ok) throw new Error(`Failed to fetch relationships: ${allRelationshipsResponse.statusText}`);
      const allRelationshipsData: Relationship[] = await allRelationshipsResponse.json();

      if (!allPersonsData || allPersonsData.length === 0) {
        console.warn('No persons data found.');
        setNodes([]);
        setEdges([]);
        setIsLoading(false);
        return;
      }

      const personNodes: FamilyTreeCustomNode[] = allPersonsData.map(person => ({
        id: person.id,
        type: 'custom',
        data: { ...person, label: person.name || person.id, id: person.id, name: person.name },
        position: { x: 0, y: 0 },
      }));

      const tempProcessedEdges: RFEdge[] = [];
      const marriageNodesMap = new Map<string, FamilyTreeCustomNode>();
      const newMarriageNodes: FamilyTreeCustomNode[] = [];

      allRelationshipsData.forEach(rel => {
        if (rel.relationship_type === 'spouse') {
          const spouse1Id = rel.person1_id;
          const spouse2Id = rel.person2_id;
          const marriageNodeId = `marriage-${[spouse1Id, spouse2Id].sort().join('-')}`;

          if (!marriageNodesMap.has(marriageNodeId)) {
            const marriageNode: FamilyTreeCustomNode = {
              id: marriageNodeId,
              type: 'marriage',
              data: { label: '' }, // No label for marriage node itself needed for display
              position: { x: 0, y: 0 },
            };
            marriageNodesMap.set(marriageNodeId, marriageNode);
            newMarriageNodes.push(marriageNode);
          }

          tempProcessedEdges.push({
            id: `e-${spouse1Id}-to-${marriageNodeId}`,
            source: spouse1Id,
            target: marriageNodeId,
            type: 'smoothstep',
            sourceHandle: 'spouseOutputRight',
            targetHandle: 'spouseInputLeft',
            style: { stroke: '#a0a0a0', strokeWidth: 1.5 }, // Spouse-marriage edge style
            data: { layoutType: 'hierarchical' }
          });
          tempProcessedEdges.push({
            id: `e-${spouse2Id}-to-${marriageNodeId}`,
            source: spouse2Id,
            target: marriageNodeId,
            type: 'smoothstep',
            sourceHandle: 'spouseOutputLeft',
            targetHandle: 'spouseInputRight',
            style: { stroke: '#a0a0a0', strokeWidth: 1.5 }, // Spouse-marriage edge style
            data: { layoutType: 'hierarchical' }
          });
        }
      });
      
      const allProcessedNodes = [...personNodes, ...newMarriageNodes];

      const parentChildRels = allRelationshipsData.filter(
        rel => rel.relationship_type === 'parent' || rel.relationship_type === 'child'
      );

      parentChildRels.forEach(rel => {
        const parentId = rel.relationship_type === 'parent' ? rel.person1_id : rel.person2_id;
        const childId = rel.relationship_type === 'parent' ? rel.person2_id : rel.person1_id;

        let childConnectedToMarriageNode = false;
        for (const marriageNodeId of marriageNodesMap.keys()) {
          const spousesOfMarriageNode = tempProcessedEdges
            .filter(e => e.target === marriageNodeId && e.data?.layoutType === 'hierarchical')
            .map(e => e.source);

          if (spousesOfMarriageNode.includes(parentId)) {
            const otherSpouseId = spousesOfMarriageNode.find(sId => sId !== parentId);
            if (otherSpouseId) {
              const isOtherSpouseAlsoParent = parentChildRels.some(r =>
                (r.relationship_type === 'parent' && r.person1_id === otherSpouseId && r.person2_id === childId) ||
                (r.relationship_type === 'child' && r.person2_id === otherSpouseId && r.person1_id === childId)
              );

              if (isOtherSpouseAlsoParent) {
                if (!tempProcessedEdges.some(e => e.source === marriageNodeId && e.target === childId)) {
                    tempProcessedEdges.push({
                        id: `e-${marriageNodeId}-to-${childId}`,
                        source: marriageNodeId,
                        target: childId,
                        type: 'smoothstep',
                        sourceHandle: 'childOutput',
                        targetHandle: 'parentInput',
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#2a9d8f' },
                        style: { stroke: '#2a9d8f', strokeWidth: 2 }, // Marriage-child edge style
                        data: { layoutType: 'hierarchical' }
                    });
                }
                childConnectedToMarriageNode = true;
                break;
              }
            }
          }
        }

        if (!childConnectedToMarriageNode) {
          // Ensure this direct parent-child edge doesn't already exist from the other direction if data is duplicated
          if (!tempProcessedEdges.some(e => e.source === parentId && e.target === childId && e.data?.layoutType === 'hierarchical')) {
            tempProcessedEdges.push({
              id: `e-${parentId}-to-${childId}-${rel.id}`,
              source: parentId,
              target: childId,
              type: 'smoothstep',
              sourceHandle: 'childOutput',
              targetHandle: 'parentInput',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#2a9d8f' },
              style: { stroke: '#2a9d8f', strokeWidth: 2 }, // Parent-child edge style
              data: { layoutType: 'hierarchical' }
            });
          }
        }
      });
      
      const finalEdges = tempProcessedEdges.filter(edge => {
        // Keep spouse-to-marriage and marriage-to-child edges
        if (edge.source.startsWith('marriage-') || edge.target.startsWith('marriage-')) {
            return true;
        }
        // For direct parent-child edges, check for redundancy
        if (edge.data?.layoutType === 'hierarchical') {
            const parent = edge.source;
            const child = edge.target;

            const marriageEdgeForParent = tempProcessedEdges.find(
                e => e.source === parent && e.target.startsWith('marriage-') && e.data?.layoutType === 'hierarchical'
            );
            if (marriageEdgeForParent) {
                const marriageNodeId = marriageEdgeForParent.target;
                const childToMarriageEdge = tempProcessedEdges.find(
                    e => e.source === marriageNodeId && e.target === child && e.data?.layoutType === 'hierarchical'
                );
                if (childToMarriageEdge) {
                    return false; // Redundant direct parent-child edge, remove it
                }
            }
        }
        return true; 
      });

      const layoutedNodes = getLayoutedElements(allProcessedNodes, finalEdges);

      // Custom positioning for marriage nodes
      const adjustedNodes = layoutedNodes.map(node => {
        if (node.type === 'marriage') {
          const spouses = finalEdges
            .filter(edge => edge.target === node.id)
            .map(edge => layoutedNodes.find(n => n.id === edge.source))
            .filter(spouse => spouse !== undefined);

          if (spouses.length === 2) {
            const spouse1 = spouses[0];
            const spouse2 = spouses[1];

            // Calculate the desired vertical position for the spouses
            const desiredVerticalSpacing = 15; // Adjust this value as needed
            spouse1.position.y = node.position.y - desiredVerticalSpacing;
            spouse2.position.y = node.position.y - desiredVerticalSpacing;
          }
        }
        return node;
      });

      setNodes(adjustedNodes);
      setEdges(finalEdges);

    } catch (error) {
      console.error('Error processing family tree data:', error);
      setNodes([]);
      setEdges([]);
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
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
    // Fuse instance is already filtered to personNodes in useEffect
    return fuse.search(debouncedSearchTerm.trim()).map(result => result.item as FamilyTreeCustomNode);
  }, [debouncedSearchTerm, fuse]);

  useEffect(() => {
    if (searchResults.length > 0) {
      const primaryResultId = searchResults[0].id;
      if (primaryResultId) {
        const nodeToFocus = nodes.find(n => n.id === primaryResultId);
        if (nodeToFocus) {
          fitView({ nodes: [{id: primaryResultId}], duration: 800, padding: 0.2 });
        }
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
          style: searchResults.find(n => n.id === node.id && node.type === 'custom') ? { ...node.style, border: '2px solid blue', boxShadow: '0 0 10px blue' } : node.style,
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
