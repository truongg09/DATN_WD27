import { images } from '../../data/assets'

type PageBannerProps = {
  eyebrow?: string
  title: string
  description?: string
  image?: string
}

function PageBanner({ eyebrow = 'Moonlit Hotel', title, description, image = images.banner }: PageBannerProps) {
  return (
    <section className="ml-page-banner" style={{ backgroundImage: `url(${image})` }}>
      <div className="ml-page-banner__overlay" />
      <div className="ml-container ml-page-banner__content">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
    </section>
  )
}

export default PageBanner
