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

  nodesToLayout.forEach((node) => {
    let width = customNodeWidth;
    let height = customNodeHeight;
    if (node.type === 'marriage') {
      width = marriageNodeWidth;
      height = marriageNodeHeight;
    }
    dagreGraph.setNode(node.id, { width, height });
  });

  edgesToLayout.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
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
      const marriages = new Map<string, { p1: string; p2: string; marriageNodeId: string }>();
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
            initialNodes.push({
              id: marriageNodeId,
              type: 'marriage',
              data: { label: 'Marriage' } as FamilyTreeNodeData,
              position: { x: 0, y: 0 },
            });
            marriages.set(sortedSpouseIds, { p1: person1_id, p2: person2_id, marriageNodeId });

            initialEdges.push({
              id: `edge-${person1_id}-${marriageNodeId}`,
              source: person1_id,
              target: marriageNodeId,
              sourceHandle: 'spouseOutputRight',
              targetHandle: 'spouseInputLeft',
              type: 'smoothstep',
            });

            initialEdges.push({
              id: `edge-${person2_id}-${marriageNodeId}`,
              source: person2_id,
              target: marriageNodeId,
              sourceHandle: 'spouseOutputLeft',
              targetHandle: 'spouseInputRight',
              type: 'smoothstep',
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
            });
          } else {
            console.warn(`Marriage node not found for parents of child ${childId}: ${parentIds.join(', ')}`);
          }
        } else if (parentIds.length === 1) {
             console.warn(`Child ${childId} has only one parent listed: ${parentIds[0]}. Cannot form a marriage link for parents.`);
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

  if (isLoading) return <div style={{ padding: '20px' }}>Loading family tree data...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error loading family tree: {error}</div>;
  if (nodes.length === 0 && !isLoading) return <div style={{ padding: '20px' }}>No family data found or processed.</div>;

  return (
    <div style={{ width: '100%', height: '100vh'}}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          proOptions={{ hideAttribution: true }}
          connectionLineType={ConnectionLineType.SmoothStep}
        >
          <Controls />
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default FamilyTree;