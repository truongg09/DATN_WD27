import { resolveMoonlitAsset } from '../../moonlit/assetMap'
import { moonlitCssEntries } from '../../moonlit/generated/moonlitCss'

function splitCssUrl(url: string) {
  const match = url.match(/^([^?#]+)([?#].*)?$/)

  return {
    pathname: match?.[1] ?? url,
    suffix: match?.[2] ?? '',
  }
}

function normalizeAssetPath(path: string) {
  return path.split('/').reduce<string[]>((segments, segment) => {
    if (!segment || segment === '.') {
      return segments
    }

    if (segment === '..') {
      return segments.slice(0, -1)
    }

    return [...segments, segment]
  }, []).join('/')
}

function resolveCssUrl(rawUrl: string, cssPath: string) {
  const trimmedUrl = rawUrl.trim().replace(/^["']|["']$/g, '')

  if (
    !trimmedUrl ||
    trimmedUrl.startsWith('#') ||
    trimmedUrl.startsWith('data:') ||
    trimmedUrl.startsWith('http:') ||
    trimmedUrl.startsWith('https:') ||
    trimmedUrl.startsWith('//')
  ) {
    return rawUrl
  }

  const { pathname, suffix } = splitCssUrl(trimmedUrl)
  const cssDirectory = cssPath.split('/').slice(0, -1).join('/')
  const assetPath = pathname.startsWith('/moonlit/')
    ? pathname.replace(/^\/moonlit\//, '')
    : normalizeAssetPath(`${cssDirectory}/${pathname}`)
  const assetUrl = resolveMoonlitAsset(assetPath)

  return assetUrl ? `"${assetUrl}${suffix}"` : rawUrl
}

function rewriteCssUrls(css: string, cssPath: string) {
  return css.replace(/url\(([^)]+)\)/g, (_match, rawUrl: string) => {
    return `url(${resolveCssUrl(rawUrl, cssPath)})`
  }).replace(/\/moonlit\/[^"',\s<>)]+/g, (url) => {
    return resolveMoonlitAsset(url) ?? url
  })
}

const moonlitStyles = moonlitCssEntries.map(({ path, css }) => rewriteCssUrls(css, path)).join('\n')

function MoonlitStyles() {
  return <style data-moonlit-styles>{moonlitStyles}</style>
}

export default MoonlitStyles
