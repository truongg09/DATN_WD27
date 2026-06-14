import parse from 'html-react-parser'
import { resolveMoonlitAsset } from '../../moonlit/assetMap'

type MoonlitHtmlProps = {
  html: string
  className?: string
}

const moonlitRouteMap: Record<string, string> = {
  '/moonlit/index.html': '/',
  '/moonlit/about/index.html': '/about',
  '/moonlit/service/index.html': '/services',
  '/moonlit/restaurant/index.html': '/restaurant',
  '/moonlit/gallery/index.html': '/gallery',
  '/moonlit/events/index.html': '/events',
  '/moonlit/activities/index.html': '/activities',
  '/moonlit/activities-details/index.html': '/activities',
  '/moonlit/contact/index.html': '/contact',
  '/moonlit/my-account/index.html': '/account',
  '/moonlit/blog/index.html': '/blog',
  '/moonlit/blog/2025/03/06/elegantly-in-our-contemporary-suite-for-apartment-hotel/index.html':
    '/blog/guest-experience-guide',
  '/moonlit/all-rooms/index.html': '/rooms',
  '/moonlit/room-classic/index.html': '/rooms',
  '/moonlit/modern-room/index.html': '/rooms',
  '/moonlit/deluxe-room/index.html': '/rooms',
  '/moonlit/easy-hotel-archive/index.html': '/rooms',
  '/moonlit/blog/eshb_accomodation/mountain-view-room/index.html': '/rooms/mountain-view-room',
  '/moonlit/blog/eshb_accomodation/presidential-suite/index.html': '/rooms/presidential-suite',
  '/moonlit/blog/eshb_accomodation/presidential-suite/index9d5e.html': '/rooms/presidential-suite',
  '/moonlit/blog/eshb_accomodation/beachfront-bliss/index.html': '/rooms/beachfront-bliss',
  '/moonlit/blog/eshb_accomodation/premier-deluxe-room/index.html': '/rooms/premier-deluxe-room',
  '/moonlit/blog/eshb_accomodation/metropolitan-suite/index.html': '/rooms/metropolitan-suite',
  '/moonlit/blog/eshb_accomodation/four-seasons-hotels/index.html': '/rooms/four-seasons-hotels',
  '/moonlit/blog/eshb_accomodation/waldorf-astoria-hotels/index.html': '/rooms',
}

function normalizeMoonlitUrl(url: string) {
  const match = url.match(/^([^?#]+)([?#].*)?$/)
  const pathname = match?.[1] ?? url

  return moonlitRouteMap[pathname] ?? resolveMoonlitAsset(url) ?? url
}

function normalizeMoonlitLinks(html: string) {
  return html.replace(/\/moonlit\/[^"',\s<>)]+/g, normalizeMoonlitUrl)
}

function markElementorLazyContainersAsLoaded(html: string) {
  return html.replace(/class=(["'])([^"']*\be-con\b[^"']*\be-parent\b[^"']*)\1/g, (match, quote, classes) => {
    if (/\be-lazyloaded\b/.test(classes) || /\be-no-lazyload\b/.test(classes)) {
      return match
    }

    return `class=${quote}${classes} e-lazyloaded${quote}`
  })
}

function normalizeMoonlitHtml(html: string) {
  return markElementorLazyContainersAsLoaded(normalizeMoonlitLinks(html))
}

function MoonlitHtml({ html, className }: MoonlitHtmlProps) {
  return <div className={className}>{parse(normalizeMoonlitHtml(html))}</div>
}

export default MoonlitHtml
