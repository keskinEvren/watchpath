'use client';

import {
  getSmoothStepPath,
  type EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';

const EDGE_STYLES: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  prerequisite: { stroke: '#a8a29e', strokeWidth: 2 },
  related: { stroke: '#d6d3d1', strokeWidth: 1 },
  optional: { stroke: '#d6d3d1', strokeWidth: 1, strokeDasharray: '6 4' },
};

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
}: EdgeProps) {
  const edgeType = (data?.edgeType as string) ?? 'prerequisite';
  const style = EDGE_STYLES[edgeType] ?? EDGE_STYLES.prerequisite;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
        }}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
              fontSize: '11px',
              fontWeight: 400,
              color: '#a8a29e',
              background: '#f7f7f3',
              padding: '2px 6px',
              borderRadius: '4px',
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
