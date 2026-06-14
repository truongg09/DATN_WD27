import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import { images } from '../../data/assets'

function Restaurant() {
  return (
    <>
      <PageBanner title="Restaurant" description="Dining service for guests and stay packages." image={images.restaurant} />
      <section className="ml-section">
        <div className="ml-container ml-split">
          <img className="ml-rounded-image" src={images.restaurant} alt="Moonlit restaurant" />
          <div>
            <SectionTitle
              align="left"
              eyebrow="Dining"
              title="Seasonal Dining For Every Stay"
              description="Restaurant content is now a React page and can later connect to package booking, menus, and event reservations."
            />
            <ul className="ml-amenities">
              <li>Breakfast buffet</li>
              <li>Private dinner service</li>
              <li>Group events</li>
              <li>Room dining</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

export default Restaurant
