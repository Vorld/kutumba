'use client';

import React, { useCallback, useEffect, useState } from 'react';
import  { // Standard default import
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  ReactFlowProvider,
  ConnectionLineType,
  Edge,
  Position,
} from '@xyflow/react';
import dagre from 'dagre';

import CustomNode from './CustomNode';
import MarriageNode from './MarriageNode';
import { Person } from '../../types';
import { FamilyTreeCustomNode, FamilyTreeNodeData } from '../../lib/utils';

import '@xyflow/react/dist/style.css';

// Helper function to generate a random hex color
const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

interface ApiRelationship {
  id: string;
  person1_id: string;
  person2_id: string;
  relationship_type: 'parent' | 'child' | 'spouse';
}

const nodeTypes = {
  custom: CustomNode,
  marriage: MarriageNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const customNodeWidth = 180;
const customNodeHeight = 100;
const marriageNodeWidth = 50;
const marriageNodeHeight = 50;

const getLayoutedElements = (
  nodesToLayout: FamilyTreeCustomNode[],
  edgesToLayout: Edge[],
  direction = 'TB'
): { nodes: FamilyTreeCustomNode[]; edges: Edge[] } => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 70, ranksep: 70 });

  // Add all nodes to dagre
  nodesToLayout.forEach((node) => {
    let width = customNodeWidth;
    let height = customNodeHeight;
    if (node.type === 'marriage') {
      width = marriageNodeWidth;
      height = marriageNodeHeight;
    }
    dagreGraph.setNode(node.id, { width, height });
  });

  // --- Dummy node trick for spouse adjacency (if at least one spouse has no parents in the tree) ---
  let dummyIdx = 0;
  // Build a set of all child node ids (i.e., all nodes that are a child in a parent/child relationship)
  const childNodeIds = new Set(
    edgesToLayout
      .filter(e => e.target && !e.target.startsWith('marriage-') && e.target !== e.source)
      .map(e => e.target)
  );
  nodesToLayout.forEach((node) => {
    if (node.type === 'marriage') {
      const spouseEdges = edgesToLayout.filter(
        (e) => e.target === node.id && e.source !== node.id
      );
      if (spouseEdges.length === 2) {
        // Apply dummy node if EITHER spouse is not a child in the tree (i.e., has no parents in the tree)
        const atLeastOneSpouseIsRoot = spouseEdges.some(edge => !childNodeIds.has(edge.source));
        if (atLeastOneSpouseIsRoot) {
          const dummyId = `dummy-marriage-${node.id}-${dummyIdx++}`;
          dagreGraph.setNode(dummyId, { width: 1, height: 1 });
          spouseEdges.forEach((edge) => {
            dagreGraph.setEdge(edge.source, dummyId, { minlen: 1, weight: 5 });
          });
          dagreGraph.setEdge(dummyId, node.id, { minlen: 1, weight: 5 });
        }
      }
    }
  });

  // --- Sibling adjacency for leaf nodes (no children, no spouses) ---
  // Find all nodes that are not marriage nodes, have no children, and have no spouse edges
  // const nodeIdToNode = Object.fromEntries(nodesToLayout.map(n => [n.id, n]));
  // // Find all parent-child edges
  // const parentChildEdges = edgesToLayout.filter(e =>
  //   (e.source.startsWith('marriage-') || nodeIdToNode[e.source]?.type === 'custom') &&
  //   nodeIdToNode[e.target]?.type === 'custom' &&
  //   e.source !== e.target
  // );
  // // Build a map from parent to children
  // const parentToChildren: Record<string, string[]> = {};
  // parentChildEdges.forEach(e => {
  //   if (!parentToChildren[e.source]) parentToChildren[e.source] = [];
  //   parentToChildren[e.source].push(e.target);
  // });
  // // Find all nodes that are not marriage nodes, have no children, and have no spouse edges
  // const leafNodes = nodesToLayout.filter(node => {
  //   if (node.type !== 'custom') return false;
  //   // No outgoing parent-child edge
  //   const hasChildren = parentChildEdges.some(e => e.source === node.id);
  //   // No spouse edge
  //   const hasSpouse = edgesToLayout.some(e => e.source === node.id && nodeIdToNode[e.target]?.type === 'marriage');
  //   return !hasChildren && !hasSpouse;
  // });
  // // Group leaf nodes by parent
  // const parentToLeafSiblings: Record<string, string[]> = {};
  // leafNodes.forEach(node => {
  //   // Find parents (edges where this node is the target)
  //   const parentEdges = parentChildEdges.filter(e => e.target === node.id);
  //   parentEdges.forEach(e => {
  //     if (!parentToLeafSiblings[e.source]) parentToLeafSiblings[e.source] = [];
  //     parentToLeafSiblings[e.source].push(node.id);
  //   });
  // });
  // // For each group of leaf siblings, add a dummy node, connect parent to dummy, and all siblings to dummy
  // let siblingDummyIdx = 0;
  // Object.entries(parentToLeafSiblings).forEach(([parentId, siblingIds]) => {
  //   if (siblingIds.length > 1) {
  //     const dummyId = `dummy-siblings-${siblingDummyIdx++}`;
  //     dagreGraph.setNode(dummyId, { width: 1, height: 1 });
  //     // Connect parent to dummy node (strongly)
  //     dagreGraph.setEdge(parentId, dummyId, { minlen: 0, weight: 10 });
  //     // Connect all siblings to dummy node (strongly)
  //     siblingIds.forEach((siblingId: string) => {
  //       dagreGraph.setEdge(dummyId, siblingId, { minlen: 0, weight: 10 });
  //     });
  //   }
  // });

  // Add all edges to dagre, with weights to encourage parent-child proximity
  edgesToLayout.forEach((edge) => {
    // Encourage parent-child edges to be straight and short
    if (
      (edge.source.startsWith('marriage-') && edge.target && !edge.target.startsWith('marriage-')) ||
      (edge.source && !edge.source.startsWith('marriage-') && edge.target && !edge.target.startsWith('marriage-'))
    ) {
      // This is a marriage-to-child or single-parent-to-child edge
      dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 4 });
    } else {
      // Spouse-to-marriage or other edges
      dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 1 });
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodesToLayout.map((node): FamilyTreeCustomNode => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const position = {
      x: nodeWithPosition.x - (node.type === 'marriage' ? marriageNodeWidth / 2 : customNodeWidth / 2),
      y: nodeWithPosition.y - (node.type === 'marriage' ? marriageNodeHeight / 2 : customNodeHeight / 2),
    };

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position,
    };
  });

  return { nodes: layoutedNodes, edges: edgesToLayout };
};

const FamilyTree: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyTreeCustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const processFamilyData = useCallback(
    (
      persons: Person[],
      apiRelationships: ApiRelationship[]
    ): { initialNodes: FamilyTreeCustomNode[]; initialEdges: Edge[] } => {
      const initialNodes: FamilyTreeCustomNode[] = [];
      const initialEdges: Edge[] = [];
      const marriages = new Map<string, { p1: string; p2: string; marriageNodeId: string, color: string }>();
      const childToParentsMap = new Map<string, string[]>();

      persons.forEach((person) => {
        initialNodes.push({
          id: person.id,
          type: 'custom',
          data: {
            id: person.id,
            label: person.name,
            name: person.name,
            nickname: person.nickname,
            birthday: person.birthday,
            gender: person.gender,
          } as FamilyTreeNodeData,
          position: { x: 0, y: 0 },
        });
      });

      apiRelationships
        .filter((rel) => rel.relationship_type === 'spouse')
        .forEach((rel) => {
          const person1_id = rel.person1_id;
          const person2_id = rel.person2_id;
          const sortedSpouseIds = [person1_id, person2_id].sort().join('-');

          if (!marriages.has(sortedSpouseIds)) {
            const marriageNodeId = `marriage-${sortedSpouseIds}`;
            const marriageColor = getRandomColor(); // Generate a unique color for the marriage
            
            initialNodes.push({
              id: marriageNodeId,
              type: 'marriage',
              data: { label: 'Marriage', color: marriageColor } as FamilyTreeNodeData,
              position: { x: 0, y: 0 },
            });
            marriages.set(sortedSpouseIds, { p1: person1_id, p2: person2_id, marriageNodeId, color: marriageColor });

            initialEdges.push({
              id: `edge-${person1_id}-${marriageNodeId}`,
              source: person1_id,
              target: marriageNodeId,
              sourceHandle: 'bottomOutput',
              targetHandle: 'spouseInputTop',
              type: 'smoothstep',
              style: { stroke: marriageColor }, // Apply color to edge
            });

            initialEdges.push({
              id: `edge-${person2_id}-${marriageNodeId}`,
              source: person2_id,
              target: marriageNodeId,
              sourceHandle: 'bottomOutput',
              targetHandle: 'spouseInputTop',
              type: 'smoothstep',
              style: { stroke: marriageColor }, // Apply color to edge
            });

          }
        });

      apiRelationships.forEach((rel) => {
        let childId: string | undefined;
        let parentId: string | undefined;

        if (rel.relationship_type === 'parent') {
          parentId = rel.person1_id;
          childId = rel.person2_id;
        } else if (rel.relationship_type === 'child') {
          childId = rel.person1_id;
          parentId = rel.person2_id;
        }

        if (childId && parentId) {
          if (!childToParentsMap.has(childId)) {
            childToParentsMap.set(childId, []);
          }
          if (!childToParentsMap.get(childId)!.includes(parentId)) {
            childToParentsMap.get(childId)!.push(parentId);
          }
        }
      });
      
      childToParentsMap.forEach((parentIds, childId) => {
        if (parentIds.length === 2) {
          const sortedParentIds = [...parentIds].sort().join('-');
          if (marriages.has(sortedParentIds)) {
            const marriage = marriages.get(sortedParentIds)!;
            initialEdges.push({
              id: `edge-${marriage.marriageNodeId}-${childId}`,
              source: marriage.marriageNodeId,
              target: childId,
              sourceHandle: 'childOutput',
              targetHandle: 'parentInput',
              type: 'smoothstep',
              style: { stroke: marriage.color }, // Apply color to edge
            });
          } else {
            console.warn(`Marriage node not found for parents of child ${childId}: ${parentIds.join(', ')}`);
          }
        } else if (parentIds.length === 1) {
            // If a single parent, connect parent directly to child
            const parentId = parentIds[0];
            initialEdges.push({
                id: `edge-${parentId}-${childId}`,
                source: parentId, // Source is CustomNode (parent)
                target: childId, // Target is CustomNode (child)
                sourceHandle: 'bottomOutput', // From CustomNode's (parent) bottom
                targetHandle: 'parentInput', // To CustomNode's (child) top
                type: 'smoothstep',
            });
            console.warn(`Child ${childId} has only one parent listed: ${parentId}. Creating direct parent-child link.`);
        } else if (parentIds.length > 2) {
            console.warn(`Child ${childId} has more than two parents listed: ${parentIds.join(', ')}. This is unusual.`);
        }
      });

      return { initialNodes, initialEdges };
    },
    []
  );

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [personsResponse, relationshipsResponse] = await Promise.all([
          fetch('/api/persons'),
          fetch('/api/relationships/all'),
        ]);

        if (!personsResponse.ok) throw new Error(`Failed to fetch persons: ${personsResponse.statusText}`);
        if (!relationshipsResponse.ok) throw new Error(`Failed to fetch relationships: ${relationshipsResponse.statusText}`);

        const persons: Person[] = await personsResponse.json();
        const apiRelationships: ApiRelationship[] = await relationshipsResponse.json();
        
        if (!Array.isArray(persons)) throw new Error('Fetched persons data is not an array.');
        if (!Array.isArray(apiRelationships)) throw new Error('Fetched relationships data is not an array.');

        const { initialNodes, initialEdges } = processFamilyData(persons, apiRelationships);
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          initialNodes,
          initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } catch (err) {
        console.error('Error fetching or processing family data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [processFamilyData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-screen bg-[#f8f7f4]">
      <div className="text-stone-600 flex flex-col items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-stone-600 mb-4"></div>
        <div>Loading family tree data...</div>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="p-8 flex items-center justify-center h-screen bg-[#f8f7f4]">
      <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm max-w-xl">
        <p className="font-medium">Error loading family tree:</p>
        <p className="mt-1">{error}</p>
      </div>
    </div>
  );
  
  if (nodes.length === 0 && !isLoading) return (
    <div className="p-8 flex items-center justify-center h-screen bg-[#f8f7f4]">
      <div className="bg-stone-100 border-l-4 border-stone-500 text-stone-700 p-4 rounded shadow-sm max-w-xl">
        <p className="font-medium">No family data found</p>
        <p className="mt-1">No family data has been processed or is available.</p>
      </div>
    </div>
  );

  return (
    <div className="w-full h-screen bg-[#f8f7f4] text-stone-900"> 
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          connectionLineType={ConnectionLineType.SmoothStep}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            style: {
              strokeWidth: 2,
            },
            type: 'smoothstep',
          }}
        >
          <Controls className="bg-stone-100 border border-stone-200 shadow-md m-4" />
          {/* Use a cream color for the React Flow background */}
          <Background color="#a8a29e" gap={16} bgColor="#e7e5e4" size={1} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default FamilyTree;