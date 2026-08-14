import { Routes, Route } from "react-router-dom";

// Layouts
import ClientLayout from "../layouts/ClientLayout";
import AdminLayout from "../layouts/AdminLayout";
import StaffLayout from "../layouts/StaffLayout";
import AuthLayout from "../layouts/AuthLayout";
import AdminRoute from "./AdminRoute";
import StaffRoute from "./StaffRoute";

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
import ResetPassword from "../pages/ForgotPassword/ResetPassword";
import EmployeeManagement from "../pages/Admin/EmployeeManagement";

import Booking from "../pages/Booking/Booking";
import BookingHistory from "../pages/Booking/BookingHistory";
import BookingDetail from "../pages/Booking/BookingDetail";
import PaymentPage from "../pages/Booking/Payment";
import PaymentSandbox from "../pages/Booking/PaymentSandbox";

import Profile from "../pages/Profile/Profile";
import ChangePassword from "../pages/Profile/ChangePassword";

import ReviewPage from "../pages/Review/ReviewPage";

// Admin Pages
import Dashboard from "../pages/Admin/Dashboard";
import RoomManagement from "../pages/Admin/RoomManagement";
import RoomTypeManagement from "../pages/Admin/RoomTypeManagement";
import BookingManagement from "../pages/Admin/BookingManagement";
import BookingDetailPage from "../pages/Admin/BookingDetailPage";
import CustomerManagement from "../pages/Admin/CustomerManagement";
import CustomerDetail from "../pages/Admin/CustomerDetail";
import ServiceManagement from "../pages/Admin/ServiceManagement";
import VoucherManagement from "../pages/Admin/VoucherManagement";
import ReviewManagement from "../pages/Admin/ReviewManagement";
import PaymentManagement from "../pages/Admin/PaymentManagement";
import InvoiceManagement from "../pages/Admin/InvoiceManagement";
import PaymentSettings from "../pages/Admin/PaymentSettings";
import ReportManagement from "../pages/Admin/ReportManagement";

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
          <Route path=":id/payment/sandbox" element={<PaymentSandbox />} />
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
        <Route path="reset-password" element={<ResetPassword />} />
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

          <Route
            path="bookings/:id"
            element={<BookingDetailPage />}
          />

          <Route path="customers">
            <Route index element={<CustomerManagement />} />
            <Route path=":id" element={<CustomerDetail />} />
          </Route>

          {/* Trang quản lý nhân viên đã có sẵn nhưng chưa từng được khai route
              nên không có đường dẫn nào mở được. */}
          <Route path="employees" element={<EmployeeManagement />} />

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

      {/* STAFF */}
      <Route element={<StaffRoute />}>
        <Route path="/staff" element={<StaffLayout />}>

          <Route index element={<Dashboard />} />

          <Route path="rooms" element={<RoomManagement />} />

          <Route
            path="bookings"
            element={<BookingManagement />}
          />

          <Route
            path="bookings/:id"
            element={<BookingDetailPage />}
          />

          <Route path="customers">
            <Route index element={<CustomerManagement />} />
            <Route path=":id" element={<CustomerDetail />} />
          </Route>

          <Route
            path="services"
            element={<ServiceManagement />}
          />

          <Route path="invoices" element={<InvoiceManagement />} />

          <Route
            path="payments"
            element={<PaymentManagement />}
          />

        </Route>
      </Route>

    </Routes>
  );
};

export default AppRoutes;
