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
  
  // Group marriage nodes with their spouses for better positioning
  const spouseGroups = new Map<string, string[]>();
  nodes.filter(n => n.type === 'marriage').forEach(marriageNode => {
    const spouses = edges
      .filter(e => e.target === marriageNode.id && (e.targetHandle === 'left' || e.targetHandle === 'right'))
      .map(e => e.source);
    
    if (spouses.length === 2) {
      spouseGroups.set(marriageNode.id, spouses);
    }
  });
  
  // Create ELK Graph structure with specialized layout options for family trees
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNodeBetweenLayers': '80',  // Increased vertical spacing between generations
      'elk.spacing.nodeNode': '150',               // Moderate spacing for better compactness
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.edgeRouting': 'ORTHOGONAL',            // Use orthogonal routing for cleaner lines
      'elk.layered.unnecessaryBendpoints': 'true', // Remove unnecessary bendpoints
      'elk.layered.wrapping.additionalEdgeSpace': '30', // Add space around edges
      'elk.layered.spacing.nodeNodeBetweenLayers': '120', // Increased spacing between generations
      'elk.layered.spacing.edgeEdgeBetweenLayers': '30', // Space between edges
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', // Better for family trees
      'elk.layered.mergeEdges': 'false',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED', // Better aligned nodes
      'elk.layered.thoroughness': '10',           // Higher thoroughness for better quality
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', // Better for family relations
      'elk.layered.considerModelOrder': 'true',   // Respect order from construction
      'elk.layered.compaction.connectedComponents': 'true', // Keep families together
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST', // Better for family trees
      'elk.spacing.componentComponent': '80',     // Space between family subgraphs
      'elk.alignment': 'CENTER',                  // Center aligned nodes
      'elk.partitioning.activate': 'true',        // Activate partitioning for family groups
      'elk.contentAlignment': 'V_CENTER,H_CENTER', // Align content centrally
      'elk.spacing.baseValue': '40',              // Base spacing value
      'elk.layered.nodePlacement.linearSegments': 'true', // Improved segment handling
      'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',  // Prioritize edge-based ordering
      'elk.layered.highDegreeNodes.treatment': 'true', // Better handling of high-degree nodes like marriages
      'elk.layered.spacing.nodeNodeBetweenLayers.upward': '80', // Control upward spacing
      'elk.separateConnectedComponents': 'false' // Keep components together
    },
    children: nodes.map((n) => {
      const isMarriage = n.type === 'marriage';
      const width = isMarriage ? marriageNodeWidth : customNodeWidth;
      const height = isMarriage ? marriageNodeHeight : customNodeHeight;

      // Track if node is part of a spouse pair
      const isPartOfSpousePair = !isMarriage && 
        Array.from(spouseGroups.values()).some(spouses => 
          spouses.includes(n.id)
        );

      // Find if this node is part of a spouse group and which one
      let spouseGroupId = '';
      if (!isMarriage && isPartOfSpousePair) {
        // Find which marriage node this person belongs to
        for (const [marriageId, spouses] of spouseGroups.entries()) {
          if (spouses.includes(n.id)) {
            spouseGroupId = marriageId;
            break;
          }
        }
      }

      if (isMarriage) {
        return {
          id: n.id,
          width,
          height,
          properties: { 
            'elk.portConstraints': 'FIXED_ORDER',
            'elk.padding': '[top=5,left=5,bottom=5,right=5]',
            'elk.layered.layering.layerConstraint': 'SAME_LAYER',
            // This is a marriage node - needs special handling
            'elk.partitioning.partition': `marriage-${n.id}`,
          },
          ports: [
            { id: 'left',  properties: { 'port.side': 'WEST',  'port.index': '0' } },
            { id: 'right', properties: { 'port.side': 'EAST',  'port.index': '1' } },
            { id: 'down',  properties: { 'port.side': 'SOUTH' } },
          ],
          // Include labels to aid debugging
          labels: [{ text: "Marriage" }]
        } as unknown as ElkNode;
      } else {
        // Person node - customize based on relationships
        return { 
          id: n.id, 
          width, 
          height,
          properties: {
            'elk.padding': '[top=15,left=15,bottom=15,right=15]',
            // If this person is part of a spouse pair, mark it to keep them together
            ...(isPartOfSpousePair ? { 
              'elk.layered.layering.layerConstraint': 'SAME_LAYER',
              // Group spouses with their marriage node
              'elk.partitioning.partition': spouseGroupId ? `family-${spouseGroupId}` : `family-${n.id}`,
            } : {}),
          },
          // Add label with name from the data for easier debugging
          labels: [{ text: n.data.label || n.id }]
        } as ElkNode;
      }
    }),
    edges: edges.map((e) => {
      // Determine the edge type based on source/target handles
      const isSpouseEdge = e.targetHandle === 'left' || e.targetHandle === 'right';
      const isChildEdge = e.sourceHandle === 'down' || e.targetHandle === 'parentInput';
      
      // Extract any custom data from the edge
      const weight = isSpouseEdge ? 30 : (isChildEdge ? 10 : 1);
      const family = e.data?.family;
      
      // Add specialized edge routing based on the edge type
      return { 
        id: e.id, 
        sources: [e.source], 
        targets: [e.target],
        // Apply properties to influence ELK layout
        properties: { 
          'edgeWeight': weight.toString(),
          // For spouse edges, give strong preference to keep them close together
          ...(isSpouseEdge ? {
            'elk.layered.priority': '20',  // Higher priority than other edges
            'elk.layered.nodePlacement.favoredPosition': 'SAME_LAYER',
            'elk.layered.layering.layerConstraint': 'SAME_LAYER', // Force nodes on same layer
            'elk.layered.compaction.groupCompactionStrategy': 'EDGE', // Group based on edges
            'elk.bendpoints': '[{"x":0,"y":0}]', // Help with edge routing
            'elk.layering.strategy': 'NETWORK_SIMPLEX', // Improved layer assignment for spouse edges
          } : {}),
          // For child edges, ensure proper parent-child hierarchical layout
          ...(isChildEdge ? {
            'elk.layered.priority': '5',
            'elk.layered.nodePlacement.favoredPosition': 'HIERARCHY',
          } : {}),
          // Apply family constraints if specified
          ...(family ? { 'elk.layered.layering.layerConstraint': 'SAME_LAYER' } : {})
        }
      };
    }),
  };

  // Apply the layout using ELK
  const layout = await elk.layout(elkGraph);
  const pos = new Map<string, { x: number; y: number }>();
  layout.children?.forEach((c) => pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 }));

  // Apply basic positioning from ELK layout with minor adjustments for centering
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

  // Find all marriage nodes and associated spouses
  const marriageConnections = new Map<string, { 
    marriageNode: FamilyTreeCustomNode, 
    spouses: string[],
    children: string[] 
  }>();
  
  // Collect marriage-spouse relationships for fine-tuning
  laidNodes.filter(n => n.type === 'marriage').forEach(marriageNode => {
    const spouseEdges = edges.filter(e => 
      e.target === marriageNode.id && 
      (e.targetHandle === 'left' || e.targetHandle === 'right')
    );
    
    const childEdges = edges.filter(e => 
      e.source === marriageNode.id && 
      e.sourceHandle === 'down'
    );
    
    if (spouseEdges.length === 2) {
      const spouseIds = spouseEdges.map(e => e.source);
      const childIds = childEdges.map(e => e.target);
      
      marriageConnections.set(marriageNode.id, {
        marriageNode,
        spouses: spouseIds,
        children: childIds
      });
    }
  });
  
  // Create a position map for quick access
    // Create a copy of nodes that we'll modify
  // But we will ONLY adjust marriage nodes for aesthetic reasons
  const adjustedNodes = [...laidNodes];
  
  // ONLY make aesthetic adjustments to marriage nodes
  // Center marriage nodes between their spouses for visual clarity
  const marriageAdjustedNodes = adjustedNodes.map(node => {
    if (node.type === 'marriage') {
      const connection = marriageConnections.get(node.id);
      if (connection && connection.spouses.length === 2) {
        const [spouse1Id, spouse2Id] = connection.spouses;
        
        // Find the spouse nodes using original ELK positions
        const spouse1Node = laidNodes.find(n => n.id === spouse1Id);
        const spouse2Node = laidNodes.find(n => n.id === spouse2Id);
        
        if (spouse1Node && spouse2Node) {
          // Calculate the midpoint between spouses for horizontal positioning
          const midX = (spouse1Node.position.x + spouse2Node.position.x) / 2;
          
          // Keep marriage node at its ELK Y position but center it horizontally
          return {
            ...node,
            position: {
              x: midX + 85, // Center horizontally only
              y: node.position.y // Keep ELK's vertical positioning
            }
          };
        }
      }
    }
    return node;
  });

  // No manual adjustments to any nodes except the minimal aesthetic adjustment to marriage nodes
  // This ensures we fully rely on ELK for the layout
  return { nodes: marriageAdjustedNodes, edges };

}

/* --------------------------------------------------
 *  Build React‑Flow graph from API
 * ------------------------------------------------*/

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

  /* Group spouse pairs with better semantics for ELK layout */
  // First collect all spouse relationships to process together
  const spouseRelationships: Array<{person1_id: string, person2_id: string}> = [];
  rels.filter((r) => r.relationship_type === 'spouse').forEach((r) => {
    spouseRelationships.push({person1_id: r.person1_id, person2_id: r.person2_id});
  });
  
  // Then process all spouse relationships
  spouseRelationships.forEach((r) => {
    // Use enhanced ordering with person data
    const [left, right] = chooseCoupleOrder(r.person1_id, r.person2_id, personMap);
    const key = `${left}-${right}`;
    if (!marriageMap.has(key)) {
      const mId = `marriage-${key}`;
      marriageMap.set(key, mId);
      
      // Add marriage node
      rfNodes.push({ 
        id: mId, 
        type: 'marriage', 
        data: { 
          label: 'Marriage',
          // Add relationship info to help layout algorithm
          spouses: [left, right]
        } as FamilyTreeNodeData, 
        position: { x: 0, y: 0 } 
      });
      
      // Add edges from spouses to marriage node with weight to keep them close
      rfEdges.push({ 
        id: `e-${left}-${mId}`, 
        source: left, 
        target: mId, 
        sourceHandle: 'spouseOutputLeft', 
        targetHandle: 'right', 
        type: 'step',
        data: { weight: 10 } // Higher weight for spouse connections
      });
      
      rfEdges.push({ 
        id: `e-${right}-${mId}`, 
        source: right, 
        target: mId, 
        sourceHandle: 'spouseOutputRight', 
        targetHandle: 'left', 
        type: 'step',
        data: { weight: 10 } // Higher weight for spouse connections
      });
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

  /* Create parent-child edges with family grouping hints for ELK */
  
  // Create a map to track family units (parents with their children)
  const familyUnits = new Map<string, string[]>(); // marriageId -> childIds[]
  
  childParents.forEach((parents, child) => {
    if (parents.length === 2) {
      // This child has two parents - find their marriage node
      const [left, right] = chooseCoupleOrder(parents[0], parents[1], personMap);
      const key = `${left}-${right}`;
      const mId = marriageMap.get(key);
      
      if (mId) {
        // Add child to this family unit
        if (!familyUnits.has(mId)) {
          familyUnits.set(mId, []);
        }
        familyUnits.get(mId)!.push(child);
        
        // Create the edge from marriage node to child
        rfEdges.push({ 
          id: `e-${mId}-${child}`, 
          source: mId, 
          target: child, 
          sourceHandle: 'down', 
          targetHandle: 'parentInput', 
          type: 'step',
          // Add specific weight to help ELK
          data: { weight: 5, family: mId } 
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
            type: 'step',
            data: { weight: 3 } 
          });
        });
      }
    } else if (parents.length === 1) {
      // Single parent case
      const pId = parents[0];
      rfEdges.push({ 
        id: `e-${pId}-${child}`, 
        source: pId, 
        target: child, 
        sourceHandle: 'childOutput', 
        targetHandle: 'parentInput', 
        type: 'step',
        data: { weight: 3 }
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
