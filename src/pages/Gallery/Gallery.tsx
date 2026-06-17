import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import { galleryImages } from '../../data/site'

function Gallery() {
  return (
    <>
      <PageBanner title="Gallery" description="Visual assets from the Moonlit theme in a React grid." />
      <section className="ml-section">
        <div className="ml-container">
          <SectionTitle eyebrow="Gallery" title="Moonlit Spaces" />
          <div className="ml-gallery">
            {galleryImages.map((image) => (
              <img key={image} src={image} alt="Moonlit hotel view" />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default Gallery
