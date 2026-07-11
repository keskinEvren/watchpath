/**
 * WatchPath progress tracking helper.
 * Uses localStorage to save and load node completion status.
 */

export function getProgress(slug: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`wp_progress_${slug}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setNodeComplete(slug: string, nodeId: string, done: boolean): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const current = getProgress(slug);
    if (done) {
      current[nodeId] = true;
    } else {
      delete current[nodeId];
    }
    localStorage.setItem(`wp_progress_${slug}`, JSON.stringify(current));
    return current;
  } catch {
    return {};
  }
}

/**
 * Calculates the progress of a specific category/chapter.
 * Returns a value between 0 and 100.
 */
export function getCategoryProgress(
  slug: string,
  categoryNodeId: string,
  allNodes: any[],
  allEdges: any[],
): number {
  const progressMap = getProgress(slug);

  // DFS/BFS to find all descendant topic and video nodes under this category
  const descendants = new Set<string>();
  const queue = [categoryNodeId];
  const edgesBySource = new Map<string, string[]>();

  for (const e of allEdges) {
    const list = edgesBySource.get(e.source) ?? [];
    list.push(e.target);
    edgesBySource.set(e.source, list);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = edgesBySource.get(current) ?? [];
    for (const childId of children) {
      const childNode = allNodes.find((n) => n.id === childId);
      if (!childNode) continue;
      // Do not traverse into other categories or root nodes
      if (childNode.node_type === 'category' || childNode.node_type === 'root') continue;

      if (!descendants.has(childId)) {
        descendants.add(childId);
        queue.push(childId);
      }
    }
  }

  // Count only milestone & video nodes
  const totalNodes = Array.from(descendants).filter((id) => {
    const n = allNodes.find((node) => node.id === id);
    return n && (n.node_type === 'video' || n.node_type === 'milestone');
  });

  if (totalNodes.length === 0) return 0;

  const completedCount = totalNodes.filter((id) => !!progressMap[id]).length;
  return Math.round((completedCount / totalNodes.length) * 100);
}
