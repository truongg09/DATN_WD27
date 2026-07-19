import { Routes, Route } from "react-router-dom";

// Layouts
import ClientLayout from "../layouts/ClientLayout";
import AdminLayout from "../layouts/AdminLayout";
import EmployeeLayout from "../layouts/EmployeeLayout";
import AuthLayout from "../layouts/AuthLayout";
import AdminRoute from "./AdminRoute";
import EmployeeRoute from "./EmployeeRoute";

// Public Pages
import Home from "../pages/Home/Home";
import RoomList from "../pages/RoomList/RoomList";
import RoomDetail from "../pages/RoomDetail/RoomDetail";
import RoomTypeDetail from "../pages/RoomTypeDetail/RoomTypeDetail";
import Contact from "../pages/Contact/Contact";
import About from "../pages/About/About";

import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import ForgotPassword from "../pages/ForgotPassword/ForgotPassword";

import Booking from "../pages/Booking/Booking";
import BookingHistory from "../pages/Booking/BookingHistory";
import BookingDetail from "../pages/Booking/BookingDetail";
import PaymentPage from "../pages/Booking/Payment";

import Profile from "../pages/Profile/Profile";
import ChangePassword from "../pages/Profile/ChangePassword";

import ReviewPage from "../pages/Review/ReviewPage";

// Admin Pages
import Dashboard from "../pages/Admin/Dashboard";
import RoomManagement from "../pages/Admin/RoomManagement";
import RoomTypeManagement from "../pages/Admin/RoomTypeManagement";
import BookingManagement from "../pages/Admin/BookingManagement";
import CustomerManagement from "../pages/Admin/CustomerManagement";
import CustomerDetail from "../pages/Admin/CustomerDetail";
import EmployeeManagement from "../pages/Admin/EmployeeManagement";
import ServiceManagement from "../pages/Admin/ServiceManagement";
import VoucherManagement from "../pages/Admin/VoucherManagement";
import ReviewManagement from "../pages/Admin/ReviewManagement";
import PaymentManagement from "../pages/Admin/PaymentManagement";
import InvoiceManagement from "../pages/Admin/InvoiceManagement";
import PaymentSettings from "../pages/Admin/PaymentSettings";
import ReportManagement from "../pages/Admin/ReportManagement";

// Employee Pages
import EmployeeDashboard from "../pages/Employee/EmployeeDashboard";
import BookingCalendar from "../pages/Employee/BookingCalendar";
import ReceiveBooking from "../pages/Employee/ReceiveBooking";
import RoomStatus from "../pages/Employee/RoomStatus";
import Customers from "../pages/Employee/Customers";
import CheckinCheckout from "../pages/Employee/CheckinCheckout";
import Payment from "../pages/Employee/Payment";
import CustomerService from "../pages/Employee/CustomerService";
import RoomRequests from "../pages/Employee/RoomRequests";
import Reviews from "../pages/Employee/Reviews";

const AppRoutes = () => {
  return (
    <Routes>

      {/* PUBLIC */}
      <Route element={<ClientLayout />}>

        <Route path="/" element={<Home />} />

        <Route path="/rooms">
          <Route index element={<RoomList />} />
          <Route path=":id" element={<RoomDetail />} />
        </Route>

        <Route path="/room-types/:id" element={<RoomTypeDetail />} />

        <Route path="/booking">
          <Route index element={<Booking />} />
          <Route path="history" element={<BookingHistory />} />
          <Route path=":id/payment" element={<PaymentPage />} />
          <Route path=":id" element={<BookingDetail />} />
        </Route>

        <Route path="/profile">
          <Route index element={<Profile />} />
          <Route path="change-password" element={<ChangePassword />} />
        </Route>

        <Route path="/reviews" element={<ReviewPage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />

      </Route>

      {/* Auth Routes with Home as Background */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* ADMIN */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>

          <Route index element={<Dashboard />} />

          <Route path="rooms" element={<RoomManagement />} />

          <Route
            path="room-types"
            element={<RoomTypeManagement />}
          />

          <Route
            path="bookings"
            element={<BookingManagement />}
          />

          <Route path="customers">
            <Route index element={<CustomerManagement />} />
            <Route path=":id" element={<CustomerDetail />} />
          </Route>

          <Route
            path="employees"
            element={<EmployeeManagement />}
          />

          <Route
            path="services"
            element={<ServiceManagement />}
          />

          <Route
            path="vouchers"
            element={<VoucherManagement />}
          />

          <Route
            path="reviews"
            element={<ReviewManagement />}
          />

          <Route
            path="payments"
            element={<PaymentManagement />}
          />

          <Route path="invoices" element={<InvoiceManagement />} />

          <Route
            path="payment-settings"
            element={<PaymentSettings />}
          />

          <Route
            path="reports"
            element={<ReportManagement />}
          />

        </Route>
      </Route>

      {/* EMPLOYEE */}
      <Route element={<EmployeeRoute />}>
        <Route path="/employee" element={<EmployeeLayout />}>

          <Route index element={<EmployeeDashboard />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />

          <Route path="booking-calendar" element={<BookingCalendar />} />

          <Route
            path="receive-booking"
            element={<ReceiveBooking />}
          />

          <Route
            path="room-status"
            element={<RoomStatus />}
          />

          <Route
            path="customers"
            element={<Customers />}
          />

          <Route
            path="checkin-checkout"
            element={<CheckinCheckout />}
          />

          <Route
            path="payment"
            element={<Payment />}
          />

          <Route
            path="customer-service"
            element={<CustomerService />}
          />

          <Route
            path="room-requests"
            element={<RoomRequests />}
          />

          <Route
            path="reviews"
            element={<Reviews />}
          />

        </Route>
      </Route>

    </Routes>
  );
};

export default AppRoutes;
