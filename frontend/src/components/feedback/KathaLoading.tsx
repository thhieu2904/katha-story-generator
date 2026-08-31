interface KathaLoadingIndicatorProps {
  label: string;
  detail?: string;
  progress?: number;
  compact?: boolean;
  className?: string;
}

export function KathaLoadingIndicator({
  label,
  detail,
  progress,
  compact = false,
  className = '',
}: KathaLoadingIndicatorProps) {
  const normalizedProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.round(Math.min(100, Math.max(0, progress)))
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`katha-loading-indicator ${compact ? 'katha-loading-indicator--compact' : ''} ${className}`}
    >
      <div className="katha-loading-emblem" aria-hidden="true">
        <span className="katha-loading-halo" />
        <span className="katha-loading-orbit">
          <i />
          <i />
          <i />
        </span>
        <span className="katha-loading-logo-shell">
          <span className="katha-loading-logo" />
        </span>
      </div>
      <div className="text-center">
        <p className="katha-loading-label">{label}</p>
        {detail ? <p className="katha-loading-detail">{detail}</p> : null}
      </div>
      <div className="katha-loading-progress-wrap">
        {normalizedProgress !== null ? (
          <span className="katha-loading-progress-value" aria-hidden="true">
            {normalizedProgress}%
          </span>
        ) : null}
        <span
          className={`katha-loading-progress ${normalizedProgress === null ? 'katha-loading-progress--indeterminate' : 'katha-loading-progress--determinate'}`}
          role="progressbar"
          aria-label={label}
          aria-valuemin={normalizedProgress === null ? undefined : 0}
          aria-valuemax={normalizedProgress === null ? undefined : 100}
          aria-valuenow={normalizedProgress ?? undefined}
        >
          <i style={normalizedProgress === null ? undefined : { width: `${normalizedProgress}%` }} />
        </span>
      </div>
    </div>
  );
}

export function KathaLoadingScreen({
  label,
  detail,
  progress,
  className = '',
}: Omit<KathaLoadingIndicatorProps, 'compact'>) {
  return (
    <main className={`katha-loading-screen min-h-dvh bg-katha-surface ${className}`}>
      <span className="katha-loading-glow katha-loading-glow--one" aria-hidden="true" />
      <span className="katha-loading-glow katha-loading-glow--two" aria-hidden="true" />
      <KathaLoadingIndicator label={label} detail={detail} progress={progress} />
    </main>
  );
}
