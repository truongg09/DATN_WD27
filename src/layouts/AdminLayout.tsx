import { NavLink, Outlet } from 'react-router-dom'
import { adminNavigation } from '../data/navigation'

function AdminLayout() {
  return (
    <div className="ml-admin">
      <aside className="ml-admin__sidebar">
        <h2>Moonlit Admin</h2>
        <nav aria-label="Admin navigation">
          <ul>
            {adminNavigation.map((item) => (
              <li key={item.to}>
                <NavLink end={item.to === '/admin'} to={item.to}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="ml-admin__content">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
