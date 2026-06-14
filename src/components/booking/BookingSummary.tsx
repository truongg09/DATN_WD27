type BookingSummaryProps = {
  title: string
  price: number
}

function BookingSummary({ title, price }: BookingSummaryProps) {
  return (
    <div className="ml-summary">
      <h3>{title}</h3>
      <p>Estimated from ${price} per night before taxes and service fees.</p>
    </div>
  )
}

export default BookingSummary
