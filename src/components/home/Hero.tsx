import { Link } from 'react-router-dom'
import { images } from '../../data/assets'

function Hero() {
  return (
    <section className="ml-hero" style={{ backgroundImage: `url(${images.hero})` }}>
      <div className="ml-hero__overlay" />
      <div className="ml-container ml-hero__content">
        <span>Welcome to Moonlit</span>
        <h1>Where Luxury Meets Comfort</h1>
        <p>Experience a refined hotel and resort stay with rooms, services, and packages ready to become a full booking system.</p>
        <Link className="ml-btn ml-btn--primary" to="/rooms">
          Explore Rooms
        </Link>
      </div>
    </section>
  )
}

export default Hero
