import type { Grid } from '@/domain/structural/types';

interface Props {
  grids: Grid[];
  extent: number; // how far lines extend
}

export function GridLayer({ grids, extent }: Props) {
  const xGrids = grids.filter((g) => g.axis === 'X');
  const yGrids = grids.filter((g) => g.axis === 'Y');

  const minY = yGrids.length > 0 ? Math.min(...yGrids.map((g) => g.position)) : 0;
  const maxY = yGrids.length > 0 ? Math.max(...yGrids.map((g) => g.position)) : extent;
  const minX = xGrids.length > 0 ? Math.min(...xGrids.map((g) => g.position)) : 0;
  const maxX = xGrids.length > 0 ? Math.max(...xGrids.map((g) => g.position)) : extent;

  const margin = 2000;

  return (
    <g className="layer-grid">
      {xGrids.map((g) => (
        <g key={g.id}>
          <line
            x1={g.position}
            y1={minY - margin}
            x2={g.position}
            y2={maxY + margin}
            stroke="var(--color-grid)"
            strokeWidth={20}
            strokeDasharray="100 100"
            opacity={0.5}
          />
          <g transform={`translate(${g.position}, ${minY - margin - 300})`}>
            <circle r={300} fill="none" stroke="var(--color-grid)" strokeWidth={20} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={350}
              fill="var(--color-grid)"
              transform="scale(1, -1)"
            >
              {g.name}
            </text>
          </g>
        </g>
      ))}
      {yGrids.map((g) => (
        <g key={g.id}>
          <line
            x1={minX - margin}
            y1={g.position}
            x2={maxX + margin}
            y2={g.position}
            stroke="var(--color-grid)"
            strokeWidth={20}
            strokeDasharray="100 100"
            opacity={0.5}
          />
          <g transform={`translate(${minX - margin - 300}, ${g.position})`}>
            <circle r={300} fill="none" stroke="var(--color-grid)" strokeWidth={20} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={350}
              fill="var(--color-grid)"
              transform="scale(1, -1)"
            >
              {g.name}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}
