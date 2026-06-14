import '@testing-library/jest-dom/vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
})

function renderAt(path: string) {
  window.history.pushState({}, 'Moonlit route', path)
  return render(<App />)
}

const renderTimeout = 20000

function collectFilesWithExtensions(directory: string, extensions: string[]): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry)
    const stats = statSync(entryPath)

    if (stats.isDirectory()) {
      return collectFilesWithExtensions(entryPath, extensions)
    }

    return extensions.some((extension) => entryPath.endsWith(extension)) ? [entryPath] : []
  })
}

describe('Moonlit React base', () => {
  it('renders the converted Moonlit home page with rewritten assets', () => {
    const { container } = renderAt('/')

    const moonlitStyles = document.querySelector('style[data-moonlit-styles]')
    const moonlitImages = Array.from(container.querySelectorAll('img'))
    const videoSection = container.querySelector('.elementor-element-7346d32.e-con.e-parent')

    expect(container.querySelector('.rt-static-hero__title')).toHaveTextContent(/Where Luxury\s*Meets Comfort/i)
    expect(container).toHaveTextContent(/Welcome To Our Moonlit Hotel/i)
    expect(container.querySelector('.hfe-site-logo-img')).toBeInTheDocument()
    expect(container.querySelector('.rt-static-hero')).toBeInTheDocument()
    expect(container.querySelector('.elementor-page-9784')).toBeInTheDocument()
    expect(container.querySelector('#colophon')).toBeInTheDocument()
    expect(container.querySelector('a[href="/about"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/contact"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/rooms"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/rooms/presidential-suite"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/moonlit/about/index.html"]')).not.toBeInTheDocument()
    expect(moonlitStyles).toBeInTheDocument()
    expect(moonlitStyles?.textContent).toContain('.elementor')
    expect(moonlitStyles?.textContent?.includes('/moonlit/wp-content')).toBe(false)
    expect(container.querySelector('img[src^="/moonlit/"]')).not.toBeInTheDocument()
    expect(moonlitImages.some((image) => image.getAttribute('src')?.includes('wp-content/uploads'))).toBe(true)
    expect(videoSection).toHaveClass('e-lazyloaded')
    expect(container.querySelectorAll('.e-con.e-parent:not(.e-lazyloaded)')).toHaveLength(0)
  }, renderTimeout)

  it('renders the main client routes', () => {
    renderAt('/rooms')

    expect(
      screen.getByRole('heading', { name: /Rooms and Suites/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Mountain View Room/i)).toBeInTheDocument()
    expect(screen.getByText(/Presidential Suite/i)).toBeInTheDocument()

    cleanup()
    renderAt('/rooms/presidential-suite')

    expect(
      screen.getByRole('heading', { name: /Presidential Suite/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Private balcony/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reserve Room/i })).toBeInTheDocument()

    cleanup()
    renderAt('/contact')

    expect(screen.getByRole('heading', { level: 1, name: /Contact Us/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument()
  }, renderTimeout)

  it('renders the admin shell route', () => {
    renderAt('/admin')

    expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument()
    expect(screen.getByText(/Room Management/i)).toBeInTheDocument()
  })

  it('keeps generated Moonlit base files consolidated under src', () => {
    const projectRoot = cwd()
    const moonlitPath = join(projectRoot, 'src', 'moonlit')
    const moonlitAssetsPath = join(projectRoot, 'src', 'moonlit', 'assets')
    const sourceHtmlFiles = collectFilesWithExtensions(moonlitPath, ['.html'])
    const leftoverScriptFiles = existsSync(moonlitAssetsPath)
      ? collectFilesWithExtensions(moonlitAssetsPath, ['.js'])
      : []
    const standaloneCssFiles = existsSync(moonlitAssetsPath)
      ? collectFilesWithExtensions(moonlitAssetsPath, ['.css'])
      : []
    const indexHtml = readFileSync(join(projectRoot, 'index.html'), 'utf8')

    if (existsSync(join(projectRoot, 'src', 'styles', 'moonlit-react.css'))) {
      standaloneCssFiles.push(join(projectRoot, 'src', 'styles', 'moonlit-react.css'))
    }

    expect(existsSync(join(projectRoot, 'src', 'moonlit', 'generated', 'moonlitHtml.ts'))).toBe(true)
    expect(sourceHtmlFiles).toEqual([])
    expect(leftoverScriptFiles).toEqual([])
    expect(existsSync(join(projectRoot, 'public'))).toBe(false)
    expect(indexHtml).not.toContain('/moonlit/')
    expect(indexHtml).not.toContain("rel='stylesheet'")
    expect(indexHtml).not.toContain('rel="stylesheet"')
    expect(standaloneCssFiles).toEqual([])
  })
})
