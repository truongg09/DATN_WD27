import { images } from '../../data/assets'
import SectionTitle from '../common/SectionTitle'

function AboutSection() {
  return (
    <section className="ml-section">
      <div className="ml-container ml-split">
        <div className="ml-split__media">
          <img src={images.about} alt="Moonlit hotel lounge" />
        </div>
        <div>
          <SectionTitle
            align="left"
            eyebrow="About Moonlit"
            title="Welcome To Our Moonlit Hotel & Resort"
            description="Since 1999, Moonlit has focused on calm rooms, thoughtful service, and resort experiences that make every stay easier to plan."
          />
          <div className="ml-stats">
            <strong>25+</strong>
            <span>Years of hospitality service</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutSection
