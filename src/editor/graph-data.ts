import { api } from './api';
import { on } from './state';

// The project's "who uses what" map from the server (server/graph.mjs), shared by the graph view and the asset previews.

export type GraphKind = 'project' | 'scene' | 'script' | 'image' | 'model' | 'audio' | 'data' | 'other' | 'missing';
export interface GraphNode { path: string; kind: GraphKind; size?: number; used: boolean }
export interface GraphEdge { from: string; to: string; label: string }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

let cache: Promise<Graph> | null = null;
on('files', () => { cache = null; });

export function getGraph(): Promise<Graph> {
  if (!cache) cache = api<Graph>('project/graph').catch((e) => { cache = null; throw e; });
  return cache;
}
