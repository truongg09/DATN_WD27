import { Outlet } from 'react-router-dom'
import Footer from '../components/layout/Footer'
import Header from '../components/layout/Header'

function ClientLayout() {
  return (
    <div className="ml-app">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default ClientLayout
