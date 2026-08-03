interface Props {
  error: string;
  onRetry?: () => void;
}

export function ErrorAlert({ error, onRetry }: Props) {
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
      <span>
        <i className="feather-alert-circle me-2" />
        {error}
      </span>
      {onRetry && (
        <button className="btn btn-sm btn-outline-danger ms-3" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
