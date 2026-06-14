function SearchBox() {
  return (
    <section className="ml-search-wrap">
      <form className="ml-container ml-search">
        <label>
          <span>Check In</span>
          <input type="date" defaultValue="2026-06-12" />
        </label>
        <label>
          <span>Check Out</span>
          <input type="date" defaultValue="2026-06-14" />
        </label>
        <label>
          <span>Adult</span>
          <input min="1" type="number" defaultValue="2" />
        </label>
        <label>
          <span>Children</span>
          <input min="0" type="number" defaultValue="0" />
        </label>
        <button className="ml-btn ml-btn--primary" type="button">
          Search
        </button>
      </form>
    </section>
  )
}

export default SearchBox
