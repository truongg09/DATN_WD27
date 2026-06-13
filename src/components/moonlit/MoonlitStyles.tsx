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

const customReactStyles = `
.ml-room-tools {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(160px, 1fr));
  gap: 16px;
  align-items: end;
  margin: 0 0 18px;
  padding: 22px;
  background: var(--ml-white);
  border: 1px solid var(--ml-border);
  border-radius: 6px;
  box-shadow: 0 18px 44px rgba(18, 26, 22, 0.08);
}

.ml-room-tools label {
  display: grid;
  gap: 8px;
  color: var(--ml-dark);
  font-weight: 600;
}

.ml-room-tools input,
.ml-room-tools select {
  width: 100%;
  min-height: 46px;
  border: 1px solid var(--ml-border);
  border-radius: 4px;
  padding: 10px 12px;
  color: var(--ml-dark);
  background: var(--ml-white);
  font: inherit;
}

.ml-room-results {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  color: var(--ml-muted);
}

.ml-room-results p {
  margin: 0;
}

.ml-room-results strong {
  color: var(--ml-dark);
}

.ml-room-reset {
  border: 0;
  padding: 0;
  color: var(--ml-gold);
  background: transparent;
  font: 600 14px/1 var(--ml-body);
  cursor: pointer;
}

.ml-empty-state--compact {
  max-width: 620px;
  margin: 0 auto;
  text-align: center;
}

@media (max-width: 980px) {
  .ml-room-tools {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .ml-room-tools {
    grid-template-columns: 1fr;
    padding: 18px;
  }

  .ml-room-results {
    align-items: flex-start;
    flex-direction: column;
  }
}
`

const moonlitStyles = `${moonlitCssEntries.map(({ path, css }) => rewriteCssUrls(css, path)).join('\n')}\n${customReactStyles}`

function MoonlitStyles() {
  return <style data-moonlit-styles>{moonlitStyles}</style>
}

export default MoonlitStyles
