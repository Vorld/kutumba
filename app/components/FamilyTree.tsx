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
import ELK, { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';

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

/* deterministic spouse ordering */
function chooseCoupleOrder(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/* --------------------------------------------------
 *  ELK layout helper
 * ------------------------------------------------*/
async function runELK(nodes: FamilyTreeCustomNode[], edges: Edge[]) {
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNodeBetweenLayers': '10',
      'elk.spacing.nodeNode': '150',
      'elk.layered.spacing.edgeNodeBetweenLayers': '20',
      'elk.layered.edgeRouting': 'ORTHOGONAL',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.mergeEdges': 'false',
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
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] } as ElkExtendedEdge)),
  };

  const layout = await elk.layout(elkGraph);
  const pos = new Map<string, { x: number; y: number }>();
  layout.children?.forEach((c) => pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 }));

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

  /* --- STEP 1: lift marriage circles closer to spouses --- */
  const marriageLift = 100; // px tweak to taste
  const lifted = laidNodes.map((n) =>
    n.type === 'marriage' ? { ...n, position: { ...n.position, y: n.position.y - marriageLift } } : n,
  );

  /* --- STEP 2: horizontally centre each marriage node between its two spouses --- */
  const posMap = new Map<string, { x: number; y: number }>(lifted.map((n) => [n.id, n.position]));

  const centred = lifted.map((node) => {
    if (node.type !== 'marriage') return node;
    const incomingSpouses = edges.filter((e) => e.target === node.id).map((e) => e.source);
    if (incomingSpouses.length !== 2) return node; // requires exactly two spouses
    const [s1, s2] = incomingSpouses;
    const p1 = posMap.get(s1);
    const p2 = posMap.get(s2);
    if (!p1 || !p2) return node;
    const midX = (p1.x + p2.x) / 2;
    return { ...node, position: { ...node.position, x: midX + 85 } }; // this number is based on the marriage node width and the custom node width
  });

  return { nodes: centred, edges };

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

  /* spouses → marriage node */
  rels.filter((r) => r.relationship_type === 'spouse').forEach((r) => {
    const [left, right] = chooseCoupleOrder(r.person1_id, r.person2_id);
    const key = `${left}-${right}`;
    if (!marriageMap.has(key)) {
      const mId = `marriage-${key}`;
      marriageMap.set(key, mId);
      rfNodes.push({ id: mId, type: 'marriage', data: { label: 'Marriage' } as FamilyTreeNodeData, position: { x: 0, y: 0 } });
      rfEdges.push({ id: `e-${left}-${mId}`, source: left, target: mId, sourceHandle: 'spouseOutputLeft', targetHandle: 'right', type: 'smoothstep' });
      rfEdges.push({ id: `e-${right}-${mId}`, source: right, target: mId, sourceHandle: 'spouseOutputRight', targetHandle: 'left', type: 'smoothstep' });
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

  /* parent arrays → edges */
  childParents.forEach((parents, child) => {
    if (parents.length === 2) {
      const [left, right] = chooseCoupleOrder(parents[0], parents[1]);
      const mId = marriageMap.get(`${left}-${right}`);
      if (mId) rfEdges.push({ id: `e-${mId}-${child}`, source: mId, target: child, sourceHandle: 'down', targetHandle: 'parentInput', type: 'smoothstep' });
    } else if (parents.length === 1) {
      const pId = parents[0];
      rfEdges.push({ id: `e-${pId}-${child}`, source: pId, target: child, sourceHandle: 'childOutput', targetHandle: 'parentInput', type: 'smoothstep' });
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
  }, []);

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
          nodesDraggable={false}
        >
          <Controls />
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default FamilyTree;
