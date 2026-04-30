'use client';

interface SparklineProps {
  data: number[];
  optMin?: number | null;
  optMax?: number | null;
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
}

export function Sparkline({
  data,
  optMin,
  optMax,
  width = 72,
  height = 28,
  color = 'hsl(var(--primary))',
  ariaLabel,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const range = hi - lo || 1;
  const py = (v: number) => height - (((v - lo) / range) * (height - 6) + 3);
  const pts = data.map<[number, number]>((v, i) => [
    (i / (data.length - 1)) * width,
    py(v),
  ]);
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
  const fillPath = `${linePath} L${width},${height} L0,${height} Z`;

  let optY1: number | null = null;
  let optY2: number | null = null;
  if (optMin != null && optMax != null && optMax > optMin) {
    optY1 = py(Math.min(optMax, hi));
    optY2 = py(Math.max(optMin, lo));
  }

  const last = pts[pts.length - 1];

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible', display: 'block', flexShrink: 0 }}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {optY1 != null && optY2 != null && (
        <rect
          x={0}
          y={Math.max(0, optY1)}
          width={width}
          height={Math.min(height, optY2 - optY1)}
          fill="hsl(var(--status-optimal))"
          opacity={0.13}
          rx={2}
        />
      )}
      <path d={fillPath} fill={color} opacity={0.08} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}
