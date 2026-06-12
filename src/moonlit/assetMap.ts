const moonlitAssetModules = import.meta.glob(
  [
    './assets/**/*.webp',
    './assets/**/*.png',
    './assets/**/*.jpg',
    './assets/**/*.jpeg',
    './assets/**/*.svg',
    './assets/**/*.gif',
    './assets/**/*.woff',
    './assets/**/*.woff2',
    './assets/**/*.ttf',
    './assets/**/*.eot',
    './assets/**/*.cur',
    './assets/**/*.webm',
  ],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>

export function moonlitPathFromGlobKey(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\/assets\//, '')
    .replace(/^.*?\/moonlit\/assets\//, '')
}

const moonlitAssetUrls = Object.fromEntries(
  Object.entries(moonlitAssetModules).map(([path, url]) => [moonlitPathFromGlobKey(path), url]),
)

function splitUrlSuffix(url: string) {
  const match = url.match(/^([^?#]+)([?#].*)?$/)

  return {
    pathname: match?.[1] ?? url,
    suffix: match?.[2] ?? '',
  }
}

export function moonlitAsset(path: string) {
  const normalizedPath = path.replace(/^\/?moonlit\//, '').replace(/^\//, '')
  const { pathname, suffix } = splitUrlSuffix(normalizedPath)
  const assetUrl = moonlitAssetUrls[pathname]

  return assetUrl ? `${assetUrl}${suffix}` : `/moonlit/${normalizedPath}`
}

export function resolveMoonlitAsset(path: string) {
  const normalizedPath = path.replace(/^\/?moonlit\//, '').replace(/^\//, '')
  const { pathname, suffix } = splitUrlSuffix(normalizedPath)
  const assetUrl = moonlitAssetUrls[pathname]

  return assetUrl ? `${assetUrl}${suffix}` : undefined
}

export function rewriteMoonlitAssetUrls(value: string) {
  return value.replace(/\/moonlit\/[^"',\s<>)]+/g, (url) => {
    return resolveMoonlitAsset(url) ?? url
  })
}
