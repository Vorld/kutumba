# Kutumba Family Tree Documentation

## Overview

The Family Tree component is a React-based interactive genealogy visualization that displays family relationships using a graph layout. It uses React Flow for rendering the graph and ELK.js for automated layout calculations. The component renders persons as custom nodes and marriages as special junction nodes, connecting them with edges to represent relationships.

## Component Architecture

### Core Technologies
- **React Flow (`@xyflow/react`)**: Provides the interactive graph rendering framework
- **ELK.js**: Powers the automatic layout algorithm for positioning nodes
- **React/TypeScript**: Base implementation technologies

### Custom Node Types
1. **CustomNode**: Represents individual persons in the family tree
   - Displays name, nickname, gender, and birthday
   - Has multiple connection handles for parent, child, and spouse relationships
   - Visual styling based on gender

2. **MarriageNode**: Represents a marriage between two people
   - Displayed as a small circular node
   - Has three connection points (ports):
     - Left port: Connects to one spouse
     - Right port: Connects to the other spouse
     - Bottom port: Connects to children of the marriage

## Data Flow

1. The component fetches two data sets from APIs:
   - Persons data (`/api/persons`)
   - Relationships data (`/api/relationships/all`)

2. The data is transformed into a graph structure through the `buildGraph` function:
   - Creates nodes for each person and marriage
   - Creates edges to connect persons to marriages and marriages to children

3. The graph is laid out using ELK's layered algorithm with the following steps:
   - ELK positions nodes and edges in a hierarchical layout
   - Marriage nodes are lifted up closer to the spouse level for better visualization
   - Marriage nodes are horizontally centered between the two spouses

4. The final positioned nodes and edges are rendered using React Flow

## Relationship Model

The system models three types of relationships:
- `parent`: Person1 is a parent of Person2
- `child`: Person1 is a child of Person2
- `spouse`: Person1 and Person2 are married/partners

## Key Assumptions

1. **Marriage-centric Family Structure**:
   - Most children are connected to a marriage node (representing both parents)
   - Single parents are supported but handled differently (direct parent-to-child connections)
   - The system assumes most family units follow a traditional structure

2. **Relationship Directionality**:
   - A `spouse` relationship is bidirectional (unordered)
   - Parent-child relationships have a direction that needs to be preserved

3. **Data Consistency Requirements**:
   - Each child typically has relationship entries for both parents
   - For a properly displayed family unit:
     - Two persons need to have a spouse relationship connecting them
     - Each child needs either:
       - Two relationship entries (one to each parent) OR
       - A single relationship entry (for single parent cases)

4. **Deterministic Layout**:
   - Spouse ordering is deterministic (lexicographically sorted by ID) via `chooseCoupleOrder`
   - Ensures consistent visual representation across sessions

5. **Single Marriage Assumption**:
   - The system only shows one marriage connection between any two persons
   - Multiple marriages over time for the same person would be represented as separate marriage nodes

## Layout Algorithm Details

The layout process consists of multiple steps:

1. **Initial ELK Layout**:
   - Sets up a layered, downward-flowing layout
   - Configures marriage nodes with special port constraints for the left, right, and down connections

2. **Marriage Node Adjustments**:
   - Marriage nodes are lifted up closer to spouse level (via `marriageLift` parameter)
   - Marriage nodes are horizontally centered between the two connected spouses

3. **Visual Connection Handling**:
   - Different edge types for various relationships
   - Step connections ensure clear, orthogonal paths
   - Special handling for different types of parent-child combinations (married parents vs. single parent)

## Edge Cases and Limitations

1. **Single Parents**:
   - Handled differently from married couples
   - Direct connections from parent to child nodes

2. **Complex Family Structures**:
   - More than 2 parents per child would require special handling
   - Adoptions or other non-traditional relationships may not be ideally represented

3. **Multiple Marriages**:
   - A person can be connected to multiple marriage nodes
   - Layout may need optimization for complex multi-marriage scenarios

4. **Visual Space**:
   - Large families may create dense visualizations
   - Manual adjustments or zooming might be necessary

## Data Model Integration

The component integrates with the backend through:
- TypeScript interfaces defining the structure of Person and Relationship data
- API endpoints that provide the necessary data
- Transformation functions that convert raw data into the graph structure

## Key UI Features

- Non-draggable nodes (prevents accidental repositioning)
- Interactive selection and highlighting
- Auto-fit view of the entire family tree
- Background grid and controls for navigation

## Code Implementation

### Graph Building Process

```typescript
function buildGraph(persons: Person[], rels: ApiRelationship[]) {
  // Create person nodes
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

  /* Process spouse relationships to create marriage nodes */
  rels.filter((r) => r.relationship_type === 'spouse').forEach((r) => {
    const [left, right] = chooseCoupleOrder(r.person1_id, r.person2_id);
    const key = `${left}-${right}`;
    if (!marriageMap.has(key)) {
      const mId = `marriage-${key}`;
      marriageMap.set(key, mId);
      rfNodes.push({ id: mId, type: 'marriage', data: { label: 'Marriage' } as FamilyTreeNodeData, position: { x: 0, y: 0 } });
      rfEdges.push({ id: `e-${left}-${mId}`, source: left, target: mId, sourceHandle: 'spouseOutputLeft', targetHandle: 'right', type: 'step' });
      rfEdges.push({ id: `e-${right}-${mId}`, source: right, target: mId, sourceHandle: 'spouseOutputRight', targetHandle: 'left', type: 'step' });
    }
  });

  /* Process parent-child relationships */
  rels.forEach((r) => {
    let child: string | undefined; let parent: string | undefined;
    if (r.relationship_type === 'parent') { parent = r.person1_id; child = r.person2_id; }
    else if (r.relationship_type === 'child') { child = r.person1_id; parent = r.person2_id; }
    if (child && parent) {
      if (!childParents.has(child)) childParents.set(child, []);
      if (!childParents.get(child)!.includes(parent)) childParents.get(child)!.push(parent);
    }
  });

  /* Create parent-child edges */
  childParents.forEach((parents, child) => {
    if (parents.length === 2) {
      // Child has two parents - connect through marriage node
      const [left, right] = chooseCoupleOrder(parents[0], parents[1]);
      const mId = marriageMap.get(`${left}-${right}`);
      if (mId) rfEdges.push({ id: `e-${mId}-${child}`, source: mId, target: child, sourceHandle: 'down', targetHandle: 'parentInput', type: 'step' });
    } else if (parents.length === 1) {
      // Single parent - direct connection
      const pId = parents[0];
      rfEdges.push({ id: `e-${pId}-${child}`, source: pId, target: child, sourceHandle: 'childOutput', targetHandle: 'parentInput', type: 'step' });
    }
  });

  return { nodes: rfNodes, edges: rfEdges };
}
```

### Layout Process

```typescript
async function runELK(nodes: FamilyTreeCustomNode[], edges: Edge[]) {
  // Configure ELK layout
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
      'elk.layered.thoroughness': '100',
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

  // Run ELK layout
  const layout = await elk.layout(elkGraph);
  const pos = new Map<string, { x: number; y: number }>();
  layout.children?.forEach((c) => pos.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 }));

  // Post-process layout for better visualization
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

  /* Lift marriage circles closer to spouses */
  const marriageLift = 100;
  const lifted = laidNodes.map((n) =>
    n.type === 'marriage' ? { ...n, position: { ...n.position, y: n.position.y - marriageLift } } : n,
  );

  /* Horizontally center marriage nodes between spouses */
  const posMap = new Map<string, { x: number; y: number }>(lifted.map((n) => [n.id, n.position]));

  const centred = lifted.map((node) => {
    if (node.type !== 'marriage') return node;
    const incomingSpouses = edges.filter((e) => e.target === node.id).map((e) => e.source);
    if (incomingSpouses.length !== 2) return node;
    const [s1, s2] = incomingSpouses;
    const p1 = posMap.get(s1);
    const p2 = posMap.get(s2);
    if (!p1 || !p2) return node;
    const midX = (p1.x + p2.x) / 2;
    return { ...node, position: { ...node.position, x: midX + 85 } };
  });

  return { nodes: centred, edges };
}
```
