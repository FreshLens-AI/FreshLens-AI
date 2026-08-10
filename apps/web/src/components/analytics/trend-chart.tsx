import type { TrendPoint } from "@/types/domain";

export function TrendChart({
  data,
  mode = "scans",
}: {
  data: TrendPoint[];
  mode?: "scans" | "spoiled";
}) {
  const width = 720;
  const height = 238;
  const insetX = 18;
  const insetY = 20;
  const values = data.map((item) => (mode === "scans" ? item.scans : item.spoiled));
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = insetX + (index / Math.max(values.length - 1, 1)) * (width - insetX * 2);
      const y = height - insetY - (value / max) * (height - insetY * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `${insetX},${height - insetY} ${points} ${width - insetX},${height - insetY}`;
  const color = mode === "scans" ? "#177a53" : "#d35b4b";
  const fill = mode === "scans" ? "url(#scanArea)" : "url(#spoilArea)";

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode === "scans" ? "Scan volume" : "Spoiled classification"} trend`}>
        <defs>
          <linearGradient id="scanArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5bb98a" stopOpacity="0.32" />
            <stop offset="1" stopColor="#5bb98a" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="spoilArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e98172" stopOpacity="0.28" />
            <stop offset="1" stopColor="#e98172" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
          <line key={ratio} x1="0" y1={height * ratio} x2={width} y2={height * ratio} className="trend-chart__grid" />
        ))}
        <polygon points={areaPoints} fill={fill} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => {
          const [x, y] = points.split(" ")[index].split(",");
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.5" fill="#fff" stroke={color} strokeWidth="2.5" />;
        })}
      </svg>
      <div className="trend-chart__labels" aria-hidden="true">
        {data.map((item, index) => (
          index % Math.max(Math.floor(data.length / 4), 1) === 0 || index === data.length - 1
            ? <span key={item.label}>{item.label}</span>
            : null
        ))}
      </div>
      <table className="sr-only">
        <caption>{mode === "scans" ? "Scan volume" : "Spoiled classifications"} by day</caption>
        <tbody>{data.map((item) => <tr key={item.label}><th>{item.label}</th><td>{mode === "scans" ? item.scans : item.spoiled}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function ClassificationStack({
  fresh,
  medium,
  spoiled,
}: {
  fresh: number;
  medium: number;
  spoiled: number;
}) {
  return (
    <div className="classification-stack">
      <div className="classification-stack__bar" aria-label={`Fresh ${fresh}%, Medium ${medium}%, Spoiled ${spoiled}%`}>
        <span className="classification-stack__fresh" style={{ width: `${fresh}%` }} />
        <span className="classification-stack__medium" style={{ width: `${medium}%` }} />
        <span className="classification-stack__spoiled" style={{ width: `${spoiled}%` }} />
      </div>
      <div className="classification-legend">
        <div><span className="legend-dot legend-dot--fresh" /><span>Fresh</span><strong>{fresh}%</strong></div>
        <div><span className="legend-dot legend-dot--medium" /><span>Medium</span><strong>{medium}%</strong></div>
        <div><span className="legend-dot legend-dot--spoiled" /><span>Spoiled</span><strong>{spoiled}%</strong></div>
      </div>
    </div>
  );
}
