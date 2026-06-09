import { Outlet, Link } from 'react-router-dom'

const menu = [
  { label: 'Tổng quan', to: '/admin' },
  { label: 'Quản lý phòng', to: '/admin/rooms' },
  { label: 'Đặt phòng', to: '/admin/bookings' },
  { label: 'Khách hàng', to: '/admin/customers' },
]

function AdminLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          background: 'var(--green-dark)',
          color: '#fff',
          padding: '24px 16px',
        }}
      >
        <h3 style={{ color: '#fff', marginBottom: 24 }}>☾ Moonlit Admin</h3>
        <nav>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {menu.map((m) => (
              <li key={m.to}>
                <Link
                  to={m.to}
                  style={{
                    display: 'block',
                    padding: '10px 12px',
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 32, background: 'var(--cream)' }}>
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
