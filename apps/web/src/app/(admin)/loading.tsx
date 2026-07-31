export default function Loading() {
  return (
    <div className="loading-grid" aria-busy="true" aria-label="Loading admin workspace">
      <div className="skeleton" style={{ width: "38%", height: 36 }} />
      <div className="skeleton" style={{ width: "62%", height: 14 }} />
      <div className="stat-grid">
        {[0, 1, 2, 3].map((item) => <div className="skeleton" style={{ height: 124 }} key={item} />)}
      </div>
      <div className="dashboard-main-grid">
        <div className="skeleton" style={{ height: 360 }} />
        <div className="skeleton" style={{ height: 360 }} />
      </div>
    </div>
  );
}
