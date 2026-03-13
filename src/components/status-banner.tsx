interface StatusBannerProps {
  status: 'loading' | 'error'
  message: string
}

export function StatusBanner({ status, message }: StatusBannerProps) {
  return <div className={`status-banner status-banner--${status}`}>{message}</div>
}
