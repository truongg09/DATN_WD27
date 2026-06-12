import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import { contactInfo } from '../../data/site'

function Contact() {
  return (
    <>
      <PageBanner title="Contact Us" description="Contact form and hotel details, ready for backend integration." />
      <section className="ml-section">
        <div className="ml-container ml-contact-grid">
          <div>
            <SectionTitle align="left" eyebrow="Contact" title="Get In Touch" />
            <ul className="ml-contact-list">
              <li>{contactInfo.phone}</li>
              <li>{contactInfo.email}</li>
              <li>{contactInfo.address}</li>
            </ul>
          </div>
          <form className="ml-form">
            <label htmlFor="contact-name">Your Name</label>
            <input id="contact-name" type="text" />
            <label htmlFor="contact-email">Email Address</label>
            <input id="contact-email" type="email" />
            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" rows={5} />
            <button className="ml-btn ml-btn--primary" type="button">
              Send Message
            </button>
          </form>
        </div>
      </section>
    </>
  )
}

export default Contact
