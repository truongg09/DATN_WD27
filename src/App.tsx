import { BrowserRouter, Route, Routes } from 'react-router-dom'
import EmptyState from './components/common/EmptyState'
import MoonlitStyles from './components/moonlit/MoonlitStyles'
import AdminLayout from './layouts/AdminLayout'
import ClientLayout from './layouts/ClientLayout'
import About from './pages/About/About'
import Account from './pages/Account/Account'
import Activities from './pages/Activities/Activities'
import AdminDashboard from './pages/Admin/AdminDashboard'
import AdminPlaceholder from './pages/Admin/AdminPlaceholder'
import Blog from './pages/Blog/Blog'
import BlogDetailPage from './pages/BlogDetail/BlogDetailPage'
import Contact from './pages/Contact/Contact'
import Events from './pages/Events/Events'
import Gallery from './pages/Gallery/Gallery'
import Home from './pages/Home/Home'
import Restaurant from './pages/Restaurant/Restaurant'
import RoomDetail from './pages/RoomDetail/RoomDetail'
import Rooms from './pages/Rooms/Rooms'
import Services from './pages/Services/Services'

function App() {
  return (
    <>
      <MoonlitStyles />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ClientLayout />}>
            <Route index element={<Home />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="rooms/:slug" element={<RoomDetail />} />
            <Route path="about" element={<About />} />
            <Route path="services" element={<Services />} />
            <Route path="restaurant" element={<Restaurant />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="events" element={<Events />} />
            <Route path="activities" element={<Activities />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogDetailPage />} />
            <Route path="contact" element={<Contact />} />
            <Route path="account" element={<Account />} />
            <Route
              path="*"
              element={
                <EmptyState title="Page not found" message="The requested page does not exist in this interface." />
              }
            />
          </Route>

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="rooms" element={<AdminPlaceholder title="Room Management" />} />
            <Route path="bookings" element={<AdminPlaceholder title="Bookings" />} />
            <Route path="customers" element={<AdminPlaceholder title="Customers" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
