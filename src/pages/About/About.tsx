import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import AboutSection from '../../components/home/AboutSection'
import FacilitySection from '../../components/home/FacilitySection'

function About() {
  return (
    <>
      <PageBanner title="About Moonlit" description="A hotel and resort interface ready for the booking core." />
      <AboutSection />
      <section className="ml-section">
        <div className="ml-container">
          <SectionTitle
            eyebrow="Story"
            title="Built For Comfortable Stays"
            description="This React base keeps the Moonlit visual system but splits content into maintainable modules for thesis development."
          />
        </div>
      </section>
      <FacilitySection />
    </>
  )
}

export default About
