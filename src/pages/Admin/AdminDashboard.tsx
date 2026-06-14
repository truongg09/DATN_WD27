import { rooms } from '../../data/rooms'

function AdminDashboard() {
  return (
    <div className="ml-admin-page">
      <h1>Dashboard</h1>
      <p>Moonlit admin shell for managing rooms, bookings, customers, payments, and reviews.</p>
      <div className="ml-admin-stats">
        <article>
          <span>{rooms.length}</span>
          <strong>Rooms Ready</strong>
        </article>
        <article>
          <span>0</span>
          <strong>Bookings</strong>
        </article>
        <article>
          <span>0</span>
          <strong>Customers</strong>
        </article>
      </div>
    </div>
  )
}

export default AdminDashboard
