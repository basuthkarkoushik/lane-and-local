export default function StatCard({ label, value, hint, icon: Icon, tone = '' }) {
  return (
    <div className="card stat-card">
      <div className="stat-top">
        <span>{label}</span>
        {Icon && (
          <span className={`stat-icon ${tone}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}