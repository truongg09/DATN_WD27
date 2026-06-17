import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import { images } from '../../data/assets'

const events = ['Private Celebration', 'Business Retreat', 'Wedding Weekend']

function Events() {
  return (
    <>
      <PageBanner title="Events" description="Event packages prepared for later booking logic." />
      <section className="ml-section">
        <div className="ml-container">
          <SectionTitle eyebrow="Events" title="Meetings And Celebrations" />
          <div className="ml-card-grid">
            {events.map((event) => (
              <article className="ml-image-card" key={event}>
                <img src={images.gallery3} alt={event} />
                <div>
                  <h2>{event}</h2>
                  <p>Flexible room blocks, restaurant service, and planning support for hotel guests.</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default Events
