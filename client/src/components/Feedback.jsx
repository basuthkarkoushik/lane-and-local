export function Loading({ text = 'Loading...' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="error-box">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}