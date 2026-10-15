import { Node } from './node';
import { createNode, nodeClass } from './registry';
import { clone, sameValue } from './math';

/** On-disk shape of a *.scene.json file. Only properties that differ from the default are written, so files stay short and diff well. */
export interface NodeData {
  type: string;
  name: string;
  props?: Record<string, unknown>;
  script?: string;
  children?: NodeData[];
}
export interface SceneFile {
  format: 1;
  root: NodeData;
}

export function nodeToData(n: Node): NodeData {
  const d: NodeData = { type: n.type, name: n.name };
  const props: Record<string, unknown> = {};
  for (const p of nodeClass(n.type).allProps()) if (!sameValue(n.props[p.name], p.default)) props[p.name] = clone(n.props[p.name]);
  if (Object.keys(props).length) d.props = props;
  if (n.script) d.script = n.script;
  if (n.children.length) d.children = n.children.map(nodeToData);
  return d;
}

export function dataToNode(d: NodeData): Node {
  const n = createNode(d.type, d.name);
  for (const [k, v] of Object.entries(d.props || {})) if (k in n.props) n.props[k] = clone(v);
  if (d.script) n.script = d.script;
  for (const c of d.children || []) n.addChild(dataToNode(c));
  return n;
}

export function serializeScene(root: Node): string {
  return pretty({ format: 1, root: nodeToData(root) } satisfies SceneFile, '') + '\n';
}

/** One-space-indented JSON where anything that fits in 100 characters stays on one line, so scenes stay short and diff per node. */
function pretty(v: unknown, ind: string): string {
  const one = inline(v);
  if (v === null || typeof v !== 'object' || (ind && one.length <= 100)) return one;
  const inner = ind + ' ';
  const items = Array.isArray(v) ? v.map((x) => inner + pretty(x, inner)) : Object.entries(v).map(([k, x]) => inner + JSON.stringify(k) + ': ' + pretty(x, inner));
  const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}'];
  return items.length ? `${open}\n${items.join(',\n')}\n${ind}${close}` : open + close;
}

function inline(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(inline).join(', ') + ']';
  const e = Object.entries(v);
  return e.length ? '{ ' + e.map(([k, x]) => JSON.stringify(k) + ': ' + inline(x)).join(', ') + ' }' : '{}';
}

export function parseScene(text: string): Node {
  const f = JSON.parse(text) as SceneFile;
  if (!f || f.format !== 1 || !f.root) throw new Error('씬 파일 형식이 아니에요 (format: 1 필요)');
  return dataToNode(f.root);
}
