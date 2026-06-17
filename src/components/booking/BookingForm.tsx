function BookingForm() {
  return (
    <form className="ml-form">
      <label>
        Check In
        <input type="date" />
      </label>
      <label>
        Check Out
        <input type="date" />
      </label>
      <label>
        Guests
        <input min="1" type="number" defaultValue="2" />
      </label>
      <button className="ml-btn ml-btn--primary" type="button">
        Check Availability
      </button>
    </form>
  )
}

export default BookingForm
