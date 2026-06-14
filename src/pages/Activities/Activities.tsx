import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import { images } from '../../data/assets'

const activities = ['Resort Pool Day', 'Local City Walk', 'Wellness Morning']

function Activities() {
  return (
    <>
      <PageBanner title="Activities" description="Activity cards ready for guest package selection." />
      <section className="ml-section">
        <div className="ml-container">
          <SectionTitle eyebrow="Activities" title="Things To Do" />
          <div className="ml-card-grid">
            {activities.map((activity) => (
              <article className="ml-image-card" key={activity}>
                <img src={images.gallery1} alt={activity} />
                <div>
                  <h2>{activity}</h2>
                  <p>Curated experiences guests can add to a room stay in a later booking phase.</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default Activities
