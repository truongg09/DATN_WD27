import { Link } from 'react-router-dom'

type EmptyStateProps = {
  title: string
  message: string
  actionLabel?: string
  actionTo?: string
}

function EmptyState({ title, message, actionLabel = 'Back Home', actionTo = '/' }: EmptyStateProps) {
  return (
    <section className="ml-section">
      <div className="ml-container ml-empty-state">
        <h1>{title}</h1>
        <p>{message}</p>
        <Link className="ml-btn ml-btn--primary" to={actionTo}>
          {actionLabel}
        </Link>
      </div>
    </section>
  )
}

export default EmptyState
