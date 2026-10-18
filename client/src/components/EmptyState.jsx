export default function EmptyState({ title, text }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}