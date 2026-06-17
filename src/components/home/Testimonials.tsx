import { testimonials } from '../../data/site'
import SectionTitle from '../common/SectionTitle'

function Testimonials() {
  return (
    <section className="ml-section ml-section--dark">
      <div className="ml-container">
        <SectionTitle eyebrow="Testimonials" title="What Guests Say" />
        <div className="ml-card-grid">
          {testimonials.map((item) => (
            <article className="ml-testimonial" key={item.name}>
              <p>"{item.quote}"</p>
              <h3>{item.name}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
