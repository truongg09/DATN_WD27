import { Link } from 'react-router-dom'
import type { BlogPost } from '../../data/blog'

type BlogListProps = {
  posts: BlogPost[]
}

function BlogList({ posts }: BlogListProps) {
  return (
    <div className="ml-card-grid">
      {posts.map((post) => (
        <article className="ml-post-card" key={post.slug}>
          <img src={post.image} alt={post.title} />
          <div>
            <span>{post.date}</span>
            <h2>
              <Link to={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p>{post.excerpt}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

export default BlogList
