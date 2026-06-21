import HeroBanner from '../../components/HeroBanner/HeroBanner';
import SearchForm from '../../components/SearchForm/SearchForm';
import AboutHotel from '../../components/AboutHotel/AboutHotel';
import FeaturedRooms from '../../components/FeaturedRooms/FeaturedRooms';
import Amenities from '../../components/Amenities/Amenities';
import Gallery from '../../components/Gallery/Gallery';
import Testimonials from '../../components/Testimonials/Testimonials';
import ContactSection from '../../components/ContactSection/ContactSection';

function Home() {
  return (
    <div>
      <HeroBanner />
      <SearchForm />
      <AboutHotel />
      <FeaturedRooms />
      <Amenities />
      <Gallery />
      <Testimonials />
      <ContactSection />
    </div>
  );
}

export default Home;