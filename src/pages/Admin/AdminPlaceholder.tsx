type AdminPlaceholderProps = {
  title: string
}

function AdminPlaceholder({ title }: AdminPlaceholderProps) {
  return (
    <div className="ml-admin-page">
      <h1>{title}</h1>
      <p>This admin page is a frontend shell. It is ready for CRUD tables when the backend core is added.</p>
    </div>
  )
}

export default AdminPlaceholder
