import type { BlogPost } from '../../data/blog'

type BlogDetailProps = {
  post: BlogPost
}

function BlogDetail({ post }: BlogDetailProps) {
  return (
    <article className="ml-article">
      <img src={post.image} alt={post.title} />
      <span>{post.date}</span>
      <h1>{post.title}</h1>
      {post.content.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </article>
  )
}

export default BlogDetail
