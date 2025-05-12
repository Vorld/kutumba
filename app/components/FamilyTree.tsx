'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
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
import ELK, { ElkNode } from 'elkjs/lib/elk.bundled.js';

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
// keep in‑sync with MarriageNode visual size (10×10)
const marriageNodeWidth = 10;
const marriageNodeHeight = 10;

const elk = new ELK();

/* Improved spouse ordering with flexibility for better layout 
 * This function determines the order of the spouses in the family tree
 * It ensures a consistent order but can be extended to handle special cases
 */
function chooseCoupleOrder(a: string, b: string, personData?: Map<string, Person>): [string, string] {
  // If we have person data, we can make smarter decisions
  if (personData) {
    const personA = personData.get(a);
    const personB = personData.get(b);
    
    // If gender information is available, use traditional ordering (male-female)
    if (personA?.gender && personB?.gender) {
      if (personA.gender === 'male' && personB.gender === 'female') {
        return [a, b];
      } else if (personA.gender === 'female' && personB.gender === 'male') {
        return [b, a];
      }
    }
  }
  
  // Default to deterministic ordering if no other rules apply
  return a < b ? [a, b] : [b, a];
}

/* --------------------------------------------------
 *  ELK layout helper
 * ------------------------------------------------*/
async function runELK(nodes: FamilyTreeCustomNode[], edges: Edge[]) {
  // Create node map for quick access
  // const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Find marriage nodes and their connected spouses
  const marriageSpousesMap = new Map<string, string[]>();
  
  // For each marriage node, find its connected spouses
  nodes.filter(n => n.type === 'marriage').forEach(marriageNode => {
    const marriageId = marriageNode.id;
    const spouseEdges = edges.filter(e => e.target === marriageId);
    
    if (spouseEdges.length === 2) {
      const spouseIds = [spouseEdges[0].source, spouseEdges[1].source];
      marriageSpousesMap.set(marriageId, spouseIds);
    }
  });
  
  // Create map of persons to their spouse (if they have one)
  const personToSpouseMap = new Map<string, string>();
  
  // Extract spouse relationships for quick lookup
  marriageSpousesMap.forEach((spouseIds) => {
    if (spouseIds.length === 2) {
      const [spouse1, spouse2] = spouseIds;
      personToSpouseMap.set(spouse1, spouse2);
      personToSpouseMap.set(spouse2, spouse1);
    }
  });
  
  // Create ELK Graph structure with improved layout options
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNodeBetweenLayers': '50',  // Increased vertical spacing between generations
      'elk.spacing.nodeNode': '20',               // Increased horizontal spacing between nodes
      'elk.layered.spacing.edgeNodeBetweenLayers': '25',
      'elk.layered.edgeRouting': 'ORTHOGONAL',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.mergeEdges': 'false',
      'elk.layered.thoroughness': '100',         
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', // Network simplex for better alignment
      'elk.layered.considerModelOrder': 'true',   
      'elk.layered.compaction.connectedComponents': 'true',
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true', // Force node order in layers
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST', // Better for family tree hierarchies
    },
    children: nodes.map((n) => {
      const isMarriage = n.type === 'marriage';
      const width = isMarriage ? marriageNodeWidth : customNodeWidth;
      const height = isMarriage ? marriageNodeHeight : customNodeHeight;

      if (isMarriage) {
        return {
          id: n.id,
          width,
          height,
          properties: { 'elk.portConstraints': 'FIXED_ORDER' },
          ports: [
            { id: 'left',  properties: { 'port.side': 'WEST',  'port.index': '0' } },
            { id: 'right', properties: { 'port.side': 'EAST',  'port.index': '1' } },
            { id: 'down',  properties: { 'port.side': 'SOUTH' } },
          ],
        } as unknown as ElkNode;
      }
      return { id: n.id, width, height } as ElkNode;
    }),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  // Apply the layout using ELK
  const layout = await elk.layout(elkGraph);
  const pos = new Map<string, { x: number; y: number }>();
  layout.children?.forEach((c) => pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 }));

  // Apply basic positioning from ELK layout
  const laidNodes = nodes.map((n) => {
    const p = pos.get(n.id) ?? { x: 0, y: 0 };
    const isMarriage = n.type === 'marriage';
    return {
      ...n,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: p.x - (isMarriage ? marriageNodeWidth / 2 : customNodeWidth / 2),
        y: p.y - (isMarriage ? marriageNodeHeight / 2 : customNodeHeight / 2),
      },
    };
  });

  // Store marriage nodes and their connected spouses for processing
  const marriageConnections = new Map<string, { marriageNode: FamilyTreeCustomNode, spouses: string[] }>();
  
  // Find all marriage nodes and their spouses for processing
  laidNodes.filter(n => n.type === 'marriage').forEach(marriageNode => {
    const spouseIds = edges
      .filter(e => e.target === marriageNode.id)
      .map(e => e.source);
      
    if (spouseIds.length === 2) {
      marriageConnections.set(marriageNode.id, {
        marriageNode,
        spouses: spouseIds
      });
    }
  });
  
  // Group nodes by layer (same Y position indicates same generation)
  const layerMap = new Map<number, FamilyTreeCustomNode[]>();
  
  // Create a map to track node positions
  const posMap = new Map<string, { x: number; y: number }>(
    laidNodes.map((n) => [n.id, n.position])
  );
  
  // First group nodes by their Y position (layer)
  laidNodes.forEach(node => {
    if (node.type === 'custom') { // Only consider person nodes for layer grouping
      const layerY = Math.round(node.position.y / 10) * 10; // Round to nearest 10px to group nodes in same layer
      if (!layerMap.has(layerY)) {
        layerMap.set(layerY, []);
      }
      layerMap.get(layerY)!.push(node);
    }
  });

  // For each layer, identify spouse pairs and ensure they're adjacent
  const adjustedNodes = [...laidNodes];
  
  // First pass: ensure spouses are at the same vertical level and adjacent horizontally
  layerMap.forEach((layerNodes, layerY) => {
    // Sort nodes by x position
    const sortedNodes = [...layerNodes].sort((a, b) => a.position.x - b.position.x);
    
    // Find spouse pairs in this layer
    const processedNodes = new Set<string>();
    const spousePairs: Array<[FamilyTreeCustomNode, FamilyTreeCustomNode]> = [];
    const nonSpouseNodes: FamilyTreeCustomNode[] = [];
    
    // First identify all spouse pairs
    sortedNodes.forEach(node => {
      if (!processedNodes.has(node.id)) {
        processedNodes.add(node.id);
        const spouseId = personToSpouseMap.get(node.id);
        
        if (spouseId) {
          const spouse = sortedNodes.find(n => n.id === spouseId);
          if (spouse && !processedNodes.has(spouseId)) {
            processedNodes.add(spouseId);
            spousePairs.push([node, spouse]);
          } else if (!spouse) {
            // Spouse not in this layer
            nonSpouseNodes.push(node);
          }
        } else {
          // No spouse
          nonSpouseNodes.push(node);
        }
      }
    });
    
    // Now rearrange the nodes in this layer
    if (spousePairs.length > 0) {
      // Calculate new X positions to keep spouses together and separate from other nodes
      let currentX = 0;
      const spacing = customNodeWidth + 20; // Space between nodes
      const spouseSpacing = customNodeWidth + 200; // Increased spacing between spouses
      
      // Position spouse pairs first
      spousePairs.forEach(([node1, node2]) => {
        // Find these nodes in the adjustedNodes array
        const index1 = adjustedNodes.findIndex(n => n.id === node1.id);
        const index2 = adjustedNodes.findIndex(n => n.id === node2.id);
        
        if (index1 !== -1 && index2 !== -1) {
          // Update positions to keep spouses adjacent with increased spacing
          adjustedNodes[index1] = {
            ...adjustedNodes[index1],
            position: {
              x: currentX,
              y: layerY // Ensure same vertical level
            }
          };
          
          adjustedNodes[index2] = {
            ...adjustedNodes[index2],
            position: {
              x: currentX + spouseSpacing,
              y: layerY // Ensure same vertical level
            }
          };
          
          // Update position map
          posMap.set(node1.id, { x: currentX, y: layerY });
          posMap.set(node2.id, { x: currentX + spouseSpacing, y: layerY });
          
          // Add more spacing between family units
          currentX += spouseSpacing + spacing + 60;
        }
      });
      
      // Then position remaining nodes
      nonSpouseNodes.forEach(node => {
        const index = adjustedNodes.findIndex(n => n.id === node.id);
        
        if (index !== -1) {
          adjustedNodes[index] = {
            ...adjustedNodes[index],
            position: {
              x: currentX,
              y: layerY
            }
          };
          
          // Update position map
          posMap.set(node.id, { x: currentX, y: layerY });
          currentX += spacing;
        }
      });
    }
  });
  
  // Update position map with adjusted node positions
  adjustedNodes
    .filter(node => node.type === 'custom')
    .forEach(node => {
      posMap.set(node.id, node.position);
    });
  
  // STEP 2: Lift and center marriage circles between spouses
  const marriageLift = 100; // px to lift marriage node
  
  // STEP 3: Center marriage nodes between spouses and adjust spacing
  const finalNodes = adjustedNodes.map((node) => {
    if (node.type === 'marriage') {
      // Get the spouse connection for this marriage node
      const connection = marriageConnections.get(node.id);
      
      if (connection && connection.spouses.length === 2) {
        const [s1, s2] = connection.spouses;
        const p1 = posMap.get(s1);
        const p2 = posMap.get(s2);
        
        if (p1 && p2) {
          // Calculate the midpoint between spouses
          const midX = (p1.x + p2.x) / 2;
          
          // Lift the marriage node closer to the spouse level
          const liftedY = node.position.y - marriageLift;
          
          return {
            ...node,
            position: {
              x: midX + 85, // based on size of marriage node and custom node
              y: liftedY
            }
          };
        }
      }
    }
    return node;
  });
  
  // Final cleanup - make sure everything is properly positioned
  return { nodes: finalNodes, edges };

}

/* --------------------------------------------------
 *  Build React‑Flow graph from API
 * ------------------------------------------------*/
function buildGraph(persons: Person[], rels: ApiRelationship[]) {
  const rfNodes: FamilyTreeCustomNode[] = persons.map((p) => ({
    id: p.id,
    type: 'custom',
    data: {
      id: p.id,
      label: p.name,
      name: p.name,
      nickname: p.nickname,
      birthday: p.birthday,
      gender: p.gender,
    } as FamilyTreeNodeData,
    position: { x: 0, y: 0 },
  }));

  const rfEdges: Edge[] = [];
  const marriageMap = new Map<string, string>();
  const childParents = new Map<string, string[]>();

  /* Create a map for quick access to person data */
  const personMap = new Map<string, Person>(persons.map(p => [p.id, p]));

  /* spouses → marriage node with improved ordering */
  rels.filter((r) => r.relationship_type === 'spouse').forEach((r) => {
    // Use enhanced ordering with person data
    const [left, right] = chooseCoupleOrder(r.person1_id, r.person2_id, personMap);
    const key = `${left}-${right}`;
    if (!marriageMap.has(key)) {
      const mId = `marriage-${key}`;
      marriageMap.set(key, mId);
      rfNodes.push({ id: mId, type: 'marriage', data: { label: 'Marriage' } as FamilyTreeNodeData, position: { x: 0, y: 0 } });
      rfEdges.push({ id: `e-${left}-${mId}`, source: left, target: mId, sourceHandle: 'spouseOutputLeft', targetHandle: 'right', type: 'step' });
      rfEdges.push({ id: `e-${right}-${mId}`, source: right, target: mId, sourceHandle: 'spouseOutputRight', targetHandle: 'left', type: 'step' });
    }
  });

  /* collect parent arrays */
  rels.forEach((r) => {
    let child: string | undefined; let parent: string | undefined;
    if (r.relationship_type === 'parent') { parent = r.person1_id; child = r.person2_id; }
    else if (r.relationship_type === 'child') { child = r.person1_id; parent = r.person2_id; }
    if (child && parent) {
      if (!childParents.has(child)) childParents.set(child, []);
      if (!childParents.get(child)!.includes(parent)) childParents.get(child)!.push(parent);
    }
  });

  /* parent arrays → edges with improved ordering */
  childParents.forEach((parents, child) => {
    if (parents.length === 2) {
      // Use enhanced ordering with person data
      const [left, right] = chooseCoupleOrder(parents[0], parents[1], personMap);
      const key = `${left}-${right}`;
      const mId = marriageMap.get(key);
      
      if (mId) {
        rfEdges.push({ 
          id: `e-${mId}-${child}`, 
          source: mId, 
          target: child, 
          sourceHandle: 'down', 
          targetHandle: 'parentInput', 
          type: 'step' 
        });
      } else {
        // No marriage node found - handle as separate parents
        parents.forEach(pId => {
          rfEdges.push({ 
            id: `e-${pId}-${child}`, 
            source: pId, 
            target: child, 
            sourceHandle: 'childOutput', 
            targetHandle: 'parentInput', 
            type: 'step' 
          });
        });
      }
    } else if (parents.length === 1) {
      const pId = parents[0];
      rfEdges.push({ 
        id: `e-${pId}-${child}`, 
        source: pId, 
        target: child, 
        sourceHandle: 'childOutput', 
        targetHandle: 'parentInput', 
        type: 'step' 
      });
    }
  });

  return { nodes: rfNodes, edges: rfEdges };
}

/* --------------------------------------------------
 *  Component
 * ------------------------------------------------*/
const FamilyTree: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyTreeCustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, rRes] = await Promise.all([fetch('/api/persons'), fetch('/api/relationships/all')]);
        if (!pRes.ok || !rRes.ok) throw new Error('Fetch failed');
        const persons: Person[] = await pRes.json();
        const rels: ApiRelationship[] = await rRes.json();
        const raw = buildGraph(persons, rels);
        const laid = await runELK(raw.nodes, raw.edges);
        setNodes(laid.nodes); setEdges(laid.edges);
      } catch (e) { setError((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, [setNodes, setEdges]);

  const onConnect = useCallback((p: Connection | Edge) => setEdges((eds) => addEdge(p, eds)), [setEdges]);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
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
          // nodesDraggable={false}
        >
          <Controls />
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default FamilyTree;
