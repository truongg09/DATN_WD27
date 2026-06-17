import BlogList from '../../components/blog/BlogList'
import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import { blogPosts } from '../../data/blog'

function Blog() {
  return (
    <>
      <PageBanner title="Blog" description="Hotel stories and booking interface notes." />
      <section className="ml-section">
        <div className="ml-container">
          <SectionTitle eyebrow="Blog" title="Latest Articles" />
          <BlogList posts={blogPosts} />
        </div>
      </section>
    </>
  )
}

export default Blog
