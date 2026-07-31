export function ProgressBar({
  value,
  tone = "green",
  label,
}: {
  value: number;
  tone?: "green" | "amber" | "red" | "blue";
  label?: string;
}) {
  return (
    <div className="progress" aria-label={label}>
      <div className="progress__track">
        <span
          className={`progress__bar progress__bar--${tone}`}
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
      {label ? <span className="sr-only">{label}: {value}%</span> : null}
    </div>
  );
}
