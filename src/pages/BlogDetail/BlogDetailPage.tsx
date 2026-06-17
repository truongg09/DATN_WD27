import { useParams } from 'react-router-dom'
import BlogDetail from '../../components/blog/BlogDetail'
import EmptyState from '../../components/common/EmptyState'
import { findPost } from '../../data/blog'

function BlogDetailPage() {
  const { slug } = useParams()
  const post = findPost(slug)

  if (!post) {
    return (
      <EmptyState
        title="Article not found"
        message="The article you are looking for is not available."
        actionLabel="View Blog"
        actionTo="/blog"
      />
    )
  }

  return (
    <section className="ml-section">
      <div className="ml-container ml-article-wrap">
        <BlogDetail post={post} />
      </div>
    </section>
  )
}

export default BlogDetailPage
