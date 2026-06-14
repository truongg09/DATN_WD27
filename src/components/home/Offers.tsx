import { offers } from '../../data/site'
import SectionTitle from '../common/SectionTitle'

function Offers() {
  return (
    <section className="ml-section ml-section--cream">
      <div className="ml-container">
        <SectionTitle eyebrow="Offers" title="Special Packages" />
        <div className="ml-card-grid">
          {offers.map((offer) => (
            <article className="ml-offer-card" key={offer.title}>
              <h3>{offer.title}</h3>
              <p>{offer.description}</p>
              <strong>${offer.price}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Offers
