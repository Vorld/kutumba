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
import { stratify as d3Stratify, tree as d3Tree, HierarchyNode, HierarchyPointNode } from 'd3-hierarchy'; // Updated d3-hierarchy import

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

const customNodeWidth = 180;
const customNodeHeight = 100;
const marriageNodeWidth = 50;
const marriageNodeHeight = 50;

interface StratifyInputData {
  id: string;
  parentId: string | null;
  originalData?: FamilyTreeCustomNode; // Made originalData optional
}

const getLayoutedElements = (
  nodesToLayout: FamilyTreeCustomNode[],
  edgesToLayout: Edge[],
  direction = 'TB'
): { nodes: FamilyTreeCustomNode[]; edges: Edge[] } => {
  const isHorizontal = direction === 'LR';

  if (nodesToLayout.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodeDataForStratify: StratifyInputData[] = nodesToLayout.map(n => ({
    id: n.id,
    parentId: null,
    originalData: n,
  }));

  const nodeDataMap = new Map(nodeDataForStratify.map(n => [n.id, n]));

  edgesToLayout.forEach(edge => {
    const targetNode = nodeDataMap.get(edge.target);
    const sourceNode = nodeDataMap.get(edge.source);

    if (targetNode && sourceNode) {
      // Prefer parent-child relationships for hierarchy if possible
      // This logic might need to be more sophisticated depending on how parent/child is defined
      // For now, if an edge exists, we assume source is parent of target for tree structure
      // This will likely make marriage nodes children of one of the spouses in the D3 tree.
      if (targetNode.parentId === null) {
        targetNode.parentId = edge.source;
      }
    }
  });

  // Identify potential roots (nodes with no parentId set yet)
  let potentialRoots = nodeDataForStratify.filter(n => n.parentId === null);

  // If no roots found (e.g. circular dependencies or all nodes have parents),
  // or multiple roots, we might need a strategy. For now, pick the first node if no explicit root.
  if (potentialRoots.length === 0 && nodeDataForStratify.length > 0) {
    // Fallback: if no node has parentId null, try to find a node that is not a target of any edge
    const allTargetIds = new Set(edgesToLayout.map(e => e.target));
    potentialRoots = nodeDataForStratify.filter(n => !allTargetIds.has(n.id));
    if (potentialRoots.length === 0 && nodeDataForStratify.length > 0) { // If still no root, pick the first node as a last resort
        const firstNodeAsRoot = nodeDataMap.get(nodeDataForStratify[0].id);
        if (firstNodeAsRoot) firstNodeAsRoot.parentId = "__D3_VIRTUAL_ROOT__";
        nodeDataForStratify.push({ id: "__D3_VIRTUAL_ROOT__", parentId: null }); // No originalData for virtual root
        potentialRoots = nodeDataForStratify.filter(n => n.id === "__D3_VIRTUAL_ROOT__");
    }
  } else if (potentialRoots.length > 1) {
    // If multiple roots, create a virtual root to connect them
    const virtualRootId = "__D3_VIRTUAL_ROOT__";
    nodeDataForStratify.push({ id: virtualRootId, parentId: null }); // No originalData for virtual root
    potentialRoots.forEach(rootNode => {
        const actualRootNode = nodeDataMap.get(rootNode.id);
        if (actualRootNode) actualRootNode.parentId = virtualRootId;
    });
    potentialRoots = nodeDataForStratify.filter(n => n.id === virtualRootId); 
  }

  let rootHierarchyNode: HierarchyNode<StratifyInputData>;
  try {
    const stratifyFunc = d3Stratify<StratifyInputData>()
      .id(d => d.id)
      .parentId(d => d.parentId);
    rootHierarchyNode = stratifyFunc(nodeDataForStratify.filter(n => nodeDataMap.has(n.id) || n.id === "__D3_VIRTUAL_ROOT__"));
  } catch (e) {
    console.error("FamilyTree: Failed to stratify data for D3 layout. Check for cycles or parent issues.", e, nodeDataForStratify);
    return {
      nodes: nodesToLayout.map(n => ({
        ...n,
        position: n.position || { x: Math.random() * 500, y: Math.random() * 500 },
        width: n.type === 'marriage' ? marriageNodeWidth : customNodeWidth,
        height: n.type === 'marriage' ? marriageNodeHeight : customNodeHeight,
      })),
      edges: edgesToLayout,
    };
  }

  const treeLayout = d3Tree<StratifyInputData>();
  const avgNodeW = customNodeWidth;
  const avgNodeH = customNodeHeight;

  if (isHorizontal) {
    treeLayout.nodeSize([avgNodeH + 70, avgNodeW + 70]); // [height, width] for horizontal
  } else {
    treeLayout.nodeSize([avgNodeW + 70, avgNodeH + 70]); // [width, height] for vertical
  }

  const d3RootPointNode = treeLayout(rootHierarchyNode);

  const layoutedNodesFromD3 = d3RootPointNode.descendants()
    .filter(d3Node => d3Node.data.id !== "__D3_VIRTUAL_ROOT__") // Exclude virtual root
    .map((d3Node: HierarchyPointNode<StratifyInputData>) => {
    const originalNode = d3Node.data.originalData!; // Non-null assertion, as virtual root is filtered
    const nodeW = originalNode.type === 'marriage' ? marriageNodeWidth : customNodeWidth;
    const nodeH = originalNode.type === 'marriage' ? marriageNodeHeight : customNodeHeight;

    let x, y;
    if (isHorizontal) {
      x = d3Node.y - nodeW / 2; // d3.tree uses x for depth, y for breadth in horizontal
      y = d3Node.x - nodeH / 2;
    } else {
      x = d3Node.x - nodeW / 2; // d3.tree uses x for breadth, y for depth in vertical
      y = d3Node.y - nodeH / 2;
    }

    return {
      ...originalNode,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x, y },
      width: nodeW,
      height: nodeH,
    };
  });

  const layoutedNodeMap = new Map(layoutedNodesFromD3.map(n => [n.id, n]));
  const finalNodes = nodesToLayout.map(n => {
    return layoutedNodeMap.get(n.id) || {
        ...n,
        position: n.position || { x: Math.random() * 200, y: Math.random() * 200 },
        width: n.type === 'marriage' ? marriageNodeWidth : customNodeWidth,
        height: n.type === 'marriage' ? marriageNodeHeight : customNodeHeight,
    };
  });

  return { nodes: finalNodes, edges: edgesToLayout };
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