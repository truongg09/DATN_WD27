import { Routes, Route } from "react-router-dom";

// Layouts
import ClientLayout from "../layouts/ClientLayout";
import AdminLayout from "../layouts/AdminLayout";

// Public Pages
import Home from "../pages/Home/Home";
import RoomList from "../pages/RoomList/RoomList";
import RoomDetail from "../pages/RoomDetail/RoomDetail";

import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import ForgotPassword from "../pages/ForgotPassword/ForgotPassword";

import Booking from "../pages/Booking/Booking";
import BookingHistory from "../pages/Booking/BookingHistory";
import BookingDetail from "../pages/Booking/BookingDetail";

import Profile from "../pages/Profile/Profile";
import ChangePassword from "../pages/Profile/ChangePassword";

import ReviewPage from "../pages/Review/ReviewPage";

// Admin Pages
import Dashboard from "../pages/Admin/Dashboard";
import RoomManagement from "../pages/Admin/RoomManagement";
import RoomTypeManagement from "../pages/Admin/RoomTypeManagement";
import BookingManagement from "../pages/Admin/BookingManagement";
import CustomerManagement from "../pages/Admin/CustomerManagement";
import EmployeeManagement from "../pages/Admin/EmployeeManagement";
import ServiceManagement from "../pages/Admin/ServiceManagement";
import VoucherManagement from "../pages/Admin/VoucherManagement";
import ReviewManagement from "../pages/Admin/ReviewManagement";
import PaymentManagement from "../pages/Admin/PaymentManagement";
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

        <Route path="/booking">
          <Route index element={<Booking />} />
          <Route path="history" element={<BookingHistory />} />
          <Route path=":id" element={<BookingDetail />} />
        </Route>

        <Route path="/profile">
          <Route index element={<Profile />} />
          <Route path="change-password" element={<ChangePassword />} />
        </Route>

        <Route path="/reviews" element={<ReviewPage />} />

      </Route>

      {/* AUTH */}
      <Route path="/auth">
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="forgot-password"
          element={<ForgotPassword />}
        />
      </Route>

      {/* ADMIN */}
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
          path="customers"
          element={<CustomerManagement />}
        />

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

        <Route
          path="reports"
          element={<ReportManagement />}
        />

      </Route>

    </Routes>
  );
};

export default AppRoutes;