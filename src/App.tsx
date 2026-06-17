<<<<<<< HEAD
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
=======
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
>>>>>>> huongtp62
    </>
  )
}

export default App
<<<<<<< HEAD
=======

>>>>>>> huongtp62
