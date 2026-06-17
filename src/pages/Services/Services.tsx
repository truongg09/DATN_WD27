import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import { serviceCards } from '../../data/site'

function Services() {
  return (
    <>
      <PageBanner title="Services" description="Guest services prepared as reusable React content blocks." />
      <section className="ml-section">
        <div className="ml-container">
          <SectionTitle eyebrow="Services" title="Guest Services" />
          <div className="ml-card-grid">
            {serviceCards.map((service) => (
              <article className="ml-image-card" key={service.title}>
                <img src={service.image} alt={service.title} />
                <div>
                  <h2>{service.title}</h2>
                  <p>{service.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default Services
