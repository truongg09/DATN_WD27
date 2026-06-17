import { facilities } from '../../data/site'
import SectionTitle from '../common/SectionTitle'

function FacilitySection() {
  return (
    <section className="ml-section ml-section--cream">
      <div className="ml-container">
        <SectionTitle
          eyebrow="Facilities"
          title="Hotel Facilities"
          description="Core services from the Moonlit template, rebuilt as reusable React data."
        />
        <div className="ml-card-grid">
          {facilities.map((facility) => (
            <article className="ml-info-card" key={facility.title}>
              <span className="ml-info-card__icon">+</span>
              <h3>{facility.title}</h3>
              <p>{facility.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FacilitySection
