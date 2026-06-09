import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClientLayout from './layouts/ClientLayout'
import AdminLayout from './layouts/AdminLayout'
import Home from './pages/Home/Home'

function AdminDashboard() {
  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Tổng quan</h2>
      <p>Khu vực quản trị Moonlit (đang phát triển).</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Giao diện khách hàng */}
        <Route path="/" element={<ClientLayout />}>
          <Route index element={<Home />} />
        </Route>

        {/* Khu vực quản trị */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
