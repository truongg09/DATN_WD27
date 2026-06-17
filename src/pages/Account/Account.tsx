import BookingForm from '../../components/booking/BookingForm'
import PageBanner from '../../components/common/PageBanner'

function Account() {
  return (
    <>
      <PageBanner title="My Account" description="A frontend shell for future login and booking history." />
      <section className="ml-section">
        <div className="ml-container ml-account">
          <div className="ml-summary">
            <h1>Guest Account</h1>
            <p>Login, profile, and booking history screens can be connected here when the core is implemented.</p>
          </div>
          <BookingForm />
        </div>
      </section>
    </>
  )
}

export default Account
