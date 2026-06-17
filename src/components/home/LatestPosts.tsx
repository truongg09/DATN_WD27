import { Link } from 'react-router-dom'
import { blogPosts } from '../../data/blog'
import SectionTitle from '../common/SectionTitle'

function LatestPosts() {
  return (
    <section className="ml-section">
      <div className="ml-container">
        <SectionTitle eyebrow="Blog" title="Latest News" />
        <div className="ml-card-grid">
          {blogPosts.map((post) => (
            <article className="ml-post-card" key={post.slug}>
              <img src={post.image} alt={post.title} />
              <div>
                <span>{post.date}</span>
                <h3>
                  <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                </h3>
                <p>{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LatestPosts
