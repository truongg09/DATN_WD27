import { images } from './assets'

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  date: string
  image: string
  content: string[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'comfortable-room-with-en-suite-bathroom',
    title: 'Comfortable Room With En-Suite Bathroom',
    excerpt: 'How thoughtful room planning makes a resort stay easier from check-in to checkout.',
    date: 'February 24, 2025',
    image: images.post1,
    content: [
      'A good hotel room is not only about size. It needs clear circulation, useful storage, soft lighting, and a bathroom that works well during busy travel days.',
      'Moonlit rooms use warm textures and simple service touchpoints so guests can settle in quickly and focus on the trip.',
    ],
  },
  {
    slug: 'guest-experience-guide',
    title: 'A Simple Guide To Better Guest Experience',
    excerpt: 'Small services that make the biggest difference in a hotel booking journey.',
    date: 'March 6, 2025',
    image: images.post2,
    content: [
      'Clear booking information, fast support, and predictable room details reduce friction for guests before they arrive.',
      'For the next development phase, this interface can connect those touchpoints to real booking and customer data.',
    ],
  },
  {
    slug: 'restaurant-and-resort-stay',
    title: 'Pairing Restaurant Service With Resort Stays',
    excerpt: 'Restaurant, spa, and activity packages help guests plan a complete stay.',
    date: 'March 12, 2025',
    image: images.post3,
    content: [
      'A strong hotel booking interface should make add-on services easy to discover without overwhelming the guest.',
      'Moonlit keeps those service sections close to room discovery so the full offer feels connected.',
    ],
  },
]

export function findPost(slug: string | undefined) {
  return blogPosts.find((post) => post.slug === slug)
}
