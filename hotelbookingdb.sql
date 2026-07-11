-- phpMyAdmin SQL Dump
-- version 6.0.0-dev+20260101.5c8325853b
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jun 24, 2026 at 09:24 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hotelbookingdb`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `id` int NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) DEFAULT 'customer',
  `status` varchar(50) DEFAULT 'active',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `accounts`
--

INSERT INTO `accounts` (`id`, `full_name`, `email`, `phone`, `password`, `role`, `status`, `createdAt`, `created_at`, `updated_at`) VALUES
(1, 'admin@gmail.com', 'admin@gmail.com', NULL, '123456', 'admin', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(2, 'staff1@gmail.com', 'staff1@gmail.com', NULL, '123456', 'staff', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(3, 'staff2@gmail.com', 'staff2@gmail.com', NULL, '123456', 'staff', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(4, 'customer1@gmail.com', 'customer1@gmail.com', NULL, '123456', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(5, 'customer2@gmail.com', 'customer2@gmail.com', NULL, '123456', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(6, 'customer3@gmail.com', 'customer3@gmail.com', NULL, '123456', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(7, 'customer4@gmail.com', 'customer4@gmail.com', NULL, '123456', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(8, 'customer5@gmail.com', 'customer5@gmail.com', NULL, '123456', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-06-21 12:20:02'),
(9, 'Test User', 'test1782044410483@example.com', '0123456789', '$2b$10$DGcENCfuAhZq16hTNUwtAu5U0R/xoQI/VJeJ087ZF3qGXzXjCv8GO', 'customer', 'active', '2026-06-21 19:20:10', '2026-06-21 12:20:10', '2026-06-21 12:20:33'),
(10, 'Test User', 'test1782044433890@example.com', '0123456789', '$2b$10$6HKWHAVun.rlLZ6UZ/L8K.cA92DipGSbAUyrhsZ13qOV1Ctd2nhfy', 'customer', 'active', '2026-06-21 19:20:33', '2026-06-21 12:20:33', '2026-06-21 12:20:33'),
(11, 'API Test User', 'api-test-1782044456618@example.com', '0900000000', '$2b$10$W1b50nB6U8CHegYAPWLgQO5KMxf61.rELk84ktJgz33GlFFrHChk6', 'customer', 'active', '2026-06-21 19:20:57', '2026-06-21 12:20:57', '2026-06-21 12:20:57'),
(12, 'Hương Trần', 'tranphuhuong1802@gmail.com', '0909999999', '$2b$10$mll3uj3dRFr6ohp6/jEOCuy9ZGKWifeve6lqABrYYMrSBXbGIZTna', 'customer', 'active', '2026-06-21 19:22:34', '2026-06-21 12:22:34', '2026-06-21 12:22:34'),
(13, NULL, 'hieumon482@gmail.com', '0349154051', '$2b$10$ZaPxLljMaODCyCBP8B0XuO.F3M6.gdLCLWmWigei8hBJccbAU5n4y', 'customer', 'active', '2026-06-24 15:19:58', '2026-06-24 08:19:58', '2026-06-24 08:19:58');

-- --------------------------------------------------------

--
-- Table structure for table `amenities`
--

CREATE TABLE `amenities` (
  `id` int NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `amenities`
--

INSERT INTO `amenities` (`id`, `name`, `icon`) VALUES
(1, 'Wifi', 'wifi'),
(2, 'TV', 'tv'),
(3, 'Air Conditioner', 'ac'),
(4, 'Mini Bar', 'bar'),
(5, 'Swimming Pool', 'pool'),
(6, 'Gym', 'gym'),
(7, 'Parking', 'parking'),
(8, 'Breakfast', 'food'),
(9, 'Bathtub', 'bath'),
(10, 'Balcony', 'balcony');

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `room_id` int DEFAULT NULL,
  `check_in` date DEFAULT NULL,
  `check_out` date DEFAULT NULL,
  `total_price` decimal(15,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `notes` text,
  `guest_name` varchar(255) DEFAULT NULL,
  `guest_email` varchar(255) DEFAULT NULL,
  `guest_phone` varchar(20) DEFAULT NULL,
  `customerId` int DEFAULT NULL,
  `voucherId` int DEFAULT NULL,
  `bookingCode` varchar(100) DEFAULT NULL,
  `bookingStatus` varchar(50) DEFAULT NULL,
  `totalAmount` decimal(15,2) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `user_id`, `room_id`, `check_in`, `check_out`, `total_price`, `status`, `notes`, `guest_name`, `guest_email`, `guest_phone`, `customerId`, `voucherId`, `bookingCode`, `bookingStatus`, `totalAmount`, `createdAt`, `created_at`) VALUES
(1, NULL, NULL, NULL, NULL, 900000.00, 'pending', NULL, NULL, NULL, NULL, 1, 1, 'BK001', 'confirmed', 900000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(2, NULL, NULL, NULL, NULL, 1350000.00, 'cancelled', NULL, NULL, NULL, NULL, 2, 2, 'BK002', 'cancelled', 1350000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(3, NULL, NULL, NULL, NULL, 2600000.00, 'pending', NULL, NULL, NULL, NULL, 3, 3, 'BK003', 'checkout', 2600000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(4, NULL, NULL, NULL, NULL, 1200000.00, 'cancelled', NULL, NULL, NULL, NULL, 4, NULL, 'BK004', 'cancelled', 1200000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(5, NULL, NULL, NULL, NULL, 1800000.00, 'pending', NULL, NULL, NULL, NULL, 5, 1, 'BK005', 'confirmed', 1800000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(7, 12, 1, '2026-06-24', '2026-07-25', 15500000.00, 'cancelled', NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'confirmed', 15500000.00, '2026-06-24 01:37:20', '2026-06-23 18:37:20'),
(8, 12, 3, '2026-06-24', '2026-07-22', 14000000.00, 'cancelled', NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'confirmed', 14000000.00, '2026-06-24 01:47:03', '2026-06-23 18:47:03'),
(9, 12, 2, '2026-06-25', '2026-07-01', 3000000.00, 'cancelled', NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3000000.00, '2026-06-24 01:52:06', '2026-06-23 18:52:06'),
(10, 12, 8, '2026-06-25', '2026-07-01', 4200000.00, 'cancelled', NULL, 'Minh Tài', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 4200000.00, '2026-06-24 02:05:29', '2026-06-23 19:05:29'),
(11, 12, 2, '2026-06-24', '2026-07-01', 3500000.00, 'cancelled', NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 02:33:25', '2026-06-23 19:33:25'),
(12, 12, 1, '2026-06-24', '2026-07-01', 3500000.00, 'cancelled', NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 07:28:47', '2026-06-24 00:28:47'),
(13, 12, 1, '2026-06-24', '2026-07-01', 3500000.00, 'cancelled', NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 14:52:37', '2026-06-24 07:52:37'),
(14, 13, 4, '2026-06-24', '2026-07-31', 18500000.00, 'cancelled', NULL, 'dsfsdfsdf', 'hieumon482@gmail.com', '0349154051', 8, NULL, NULL, 'cancelled', 18500000.00, '2026-06-24 15:20:24', '2026-06-24 08:20:24');

-- --------------------------------------------------------

--
-- Table structure for table `booking_damage_charges`
--

CREATE TABLE `booking_damage_charges` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `roomId` int NOT NULL,
  `itemName` varchar(255) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unitPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `totalPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `note` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `booking_details`
--

CREATE TABLE `booking_details` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `roomId` int DEFAULT NULL,
  `checkInDate` date DEFAULT NULL,
  `checkOutDate` date DEFAULT NULL,
  `adults` int DEFAULT NULL,
  `children` int DEFAULT NULL,
  `roomPrice` decimal(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `booking_details`
--

INSERT INTO `booking_details` (`id`, `bookingId`, `roomId`, `checkInDate`, `checkOutDate`, `adults`, `children`, `roomPrice`) VALUES
(1, 1, 1, '2026-06-10', '2026-06-12', 2, 0, 500000.00),
(2, 2, 5, '2026-06-15', '2026-06-17', 2, 1, 700000.00),
(3, 3, 9, '2026-06-20', '2026-06-23', 3, 1, 900000.00),
(4, 4, 13, '2026-06-22', '2026-06-24', 4, 0, 1200000.00),
(5, 5, 17, '2026-06-25', '2026-06-27', 2, 0, 2000000.00),
(7, 7, 1, '2026-06-24', '2026-07-25', 2, 0, 500000.00),
(8, 8, 3, '2026-06-24', '2026-07-22', 2, 0, 500000.00),
(9, 9, 2, '2026-06-25', '2026-07-01', 2, 0, 500000.00),
(10, 10, 8, '2026-06-25', '2026-07-01', 2, 0, 700000.00),
(11, 11, 2, '2026-06-24', '2026-07-01', 2, 0, 500000.00),
(12, 12, 1, '2026-06-24', '2026-07-01', 2, 0, 500000.00),
(13, 13, 1, '2026-06-24', '2026-07-01', 2, 0, 500000.00),
(14, 14, 4, '2026-06-24', '2026-07-31', 2, 0, 500000.00);

-- --------------------------------------------------------

--
-- Table structure for table `booking_guests`
--

CREATE TABLE `booking_guests` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `fullName` varchar(255) NOT NULL,
  `identityNumber` varchar(50) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `note` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `booking_room_transfers`
--

CREATE TABLE `booking_room_transfers` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `fromRoomId` int NOT NULL,
  `toRoomId` int NOT NULL,
  `fromDate` date NOT NULL,
  `toDate` date NOT NULL,
  `pricePerNight` decimal(15,2) NOT NULL DEFAULT '0.00',
  `reason` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `booking_services`
--

CREATE TABLE `booking_services` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `serviceId` int DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `totalPrice` decimal(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `booking_services`
--

INSERT INTO `booking_services` (`id`, `bookingId`, `serviceId`, `quantity`, `totalPrice`) VALUES
(1, 1, 1, 2, 300000.00),
(2, 2, 2, 1, 100000.00),
(3, 3, 3, 2, 600000.00),
(4, 4, 5, 1, 200000.00),
(5, 5, 7, 1, 400000.00);

-- --------------------------------------------------------

--
-- Table structure for table `booking_service_requests`
--

CREATE TABLE `booking_service_requests` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `serviceId` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `note` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `booking_status_logs`
--

CREATE TABLE `booking_status_logs` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `changedBy` int DEFAULT NULL,
  `oldStatus` varchar(50) DEFAULT NULL,
  `newStatus` varchar(50) DEFAULT NULL,
  `changedAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `booking_status_logs`
--

INSERT INTO `booking_status_logs` (`id`, `bookingId`, `changedBy`, `oldStatus`, `newStatus`, `changedAt`) VALUES
(1, 1, 1, 'pending', 'confirmed', '2026-06-10 23:26:20'),
(2, 2, 1, 'pending', 'confirmed', '2026-06-10 23:26:20'),
(3, 3, 2, 'checkin', 'checkout', '2026-06-10 23:26:20'),
(4, 4, 2, 'confirmed', 'checkin', '2026-06-10 23:26:20'),
(5, 5, 1, 'pending', 'confirmed', '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int NOT NULL,
  `accountId` int DEFAULT NULL,
  `fullName` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `dateOfBirth` date DEFAULT NULL,
  `citizenId` varchar(50) DEFAULT NULL,
  `nationality` varchar(100) DEFAULT NULL,
  `address` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `accountId`, `fullName`, `phone`, `gender`, `dateOfBirth`, `citizenId`, `nationality`, `address`) VALUES
(1, 4, 'Nguyen Van A', '0911111111', 'Male', NULL, NULL, 'Vietnam', 'Ha Noi'),
(2, 5, 'Tran Thi B', '0922222222', 'Female', NULL, NULL, 'Vietnam', 'Hai Phong'),
(3, 6, 'Le Van C', '0933333333', 'Male', NULL, NULL, 'Vietnam', 'Da Nang'),
(4, 7, 'Pham Thi D', '0944444444', 'Female', NULL, NULL, 'Vietnam', 'Hue'),
(5, 8, 'Hoang Van E', '0955555555', 'Male', NULL, NULL, 'Vietnam', 'HCM'),
(6, 1, 'admin@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(7, 12, 'tranphuhuong1802@gmail.com', '0909999999', NULL, NULL, NULL, NULL, NULL),
(8, 13, 'hieumon482@gmail.com', '0349154051', NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `damage_reports`
--

CREATE TABLE `damage_reports` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `roomItemId` int DEFAULT NULL,
  `description` text,
  `compensationFee` decimal(15,2) DEFAULT NULL,
  `reportDate` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `damage_reports`
--

INSERT INTO `damage_reports` (`id`, `bookingId`, `roomItemId`, `description`, `compensationFee`, `reportDate`) VALUES
(1, 2, 3, 'May say toc bi vo', 300000.00, '2026-06-10 23:26:20'),
(2, 3, 4, 'Mini bar hong', 500000.00, '2026-06-10 23:26:20'),
(3, 5, 10, 'Den ban bi hu', 200000.00, '2026-06-10 23:26:20'),
(5, 2, 4, 'hỏng', 300000.00, '2026-06-26 20:43:24');

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `id` int NOT NULL,
  `accountId` int DEFAULT NULL,
  `fullName` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `position` varchar(100) DEFAULT NULL,
  `salary` decimal(15,2) DEFAULT NULL,
  `hireDate` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`id`, `accountId`, `fullName`, `phone`, `position`, `salary`, `hireDate`) VALUES
(1, 2, 'Nguyen Le Staff', '0901234567', 'Receptionist', 12000000.00, '2025-01-01'),
(2, 3, 'Tran Staff', '0908888888', 'Manager', 18000000.00, '2025-01-01');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int NOT NULL,
  `accountId` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text,
  `isRead` tinyint(1) DEFAULT '0',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `accountId`, `title`, `content`, `isRead`, `createdAt`) VALUES
(1, 1, 'Booking moi', 'Co booking BK001 vua duoc tao', 1, '2026-06-10 23:26:20'),
(2, 2, 'Check-in', 'Khach BK004 da check-in', 0, '2026-06-10 23:26:20'),
(3, 3, 'Thanh toan', 'Don BK003 da thanh toan', 1, '2026-06-10 23:26:20'),
(4, 4, 'Khuyen mai', 'Ban nhan duoc voucher moi', 0, '2026-06-10 23:26:20'),
(5, 5, 'Danh gia', 'Cam on ban da danh gia khach san', 1, '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `roomAmount` decimal(15,2) DEFAULT NULL,
  `serviceAmount` decimal(15,2) DEFAULT NULL,
  `surchargeAmount` decimal(15,2) DEFAULT NULL,
  `discountAmount` decimal(15,2) DEFAULT NULL,
  `depositAmount` decimal(15,2) DEFAULT NULL,
  `paidAmount` decimal(15,2) DEFAULT NULL,
  `remainingAmount` decimal(15,2) DEFAULT NULL,
  `totalAmount` decimal(15,2) DEFAULT NULL,
  `paymentMethod` varchar(50) DEFAULT NULL,
  `paymentStatus` varchar(50) DEFAULT NULL,
  `transactionCode` varchar(255) DEFAULT NULL,
  `paymentDate` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`id`, `bookingId`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `discountAmount`, `depositAmount`, `paidAmount`, `remainingAmount`, `totalAmount`, `paymentMethod`, `paymentStatus`, `transactionCode`, `paymentDate`) VALUES
(1, 1, 1000000.00, 0.00, 0.00, 100000.00, 300000.00, 900000.00, 0.00, 900000.00, 'cash', 'paid', 'TXN001', '2026-06-10 10:00:00'),
(2, 2, 1400000.00, 0.00, 0.00, 50000.00, 500000.00, 500000.00, 850000.00, 1350000.00, 'momo', 'unpaid', 'TXN002', '2026-06-15 09:00:00'),
(3, 3, 2700000.00, 200000.00, 0.00, 300000.00, 1000000.00, 2600000.00, 0.00, 2600000.00, 'vnpay', 'paid', 'TXN003', '2026-06-20 14:00:00'),
(4, 4, 1200000.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, 700000.00, 1200000.00, 'cash', 'unpaid', 'TXN004', '2026-06-22 15:00:00'),
(5, 5, 2000000.00, 0.00, 0.00, 200000.00, 1000000.00, 1800000.00, 0.00, 1800000.00, 'vnpay', 'paid', 'TXN005', '2026-06-25 11:00:00'),
(7, 7, 15500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 15500000.00, 15500000.00, NULL, 'unpaid', NULL, NULL),
(8, 8, 14000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 14000000.00, 14000000.00, NULL, 'unpaid', NULL, NULL),
(9, 9, 3000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3000000.00, 3000000.00, NULL, 'unpaid', NULL, NULL),
(10, 10, 4200000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 4200000.00, 4200000.00, NULL, 'unpaid', NULL, NULL),
(11, 11, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL),
(12, 12, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL),
(13, 13, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL),
(14, 14, 18500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 18500000.00, 18500000.00, NULL, 'unpaid', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `payment_status_logs`
--

CREATE TABLE `payment_status_logs` (
  `id` int NOT NULL,
  `paymentId` int DEFAULT NULL,
  `changedBy` int DEFAULT NULL,
  `oldStatus` varchar(50) DEFAULT NULL,
  `newStatus` varchar(50) DEFAULT NULL,
  `changedAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `payment_status_logs`
--

INSERT INTO `payment_status_logs` (`id`, `paymentId`, `changedBy`, `oldStatus`, `newStatus`, `changedAt`) VALUES
(1, 1, 1, 'unpaid', 'paid', '2026-06-10 23:26:20'),
(2, 2, 1, 'unpaid', 'unpaid', '2026-06-10 23:26:20'),
(3, 3, 2, 'unpaid', 'paid', '2026-06-10 23:26:20'),
(4, 4, 2, 'unpaid', 'unpaid', '2026-06-10 23:26:20'),
(5, 5, 1, 'unpaid', 'paid', '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Table structure for table `reviews`
--

CREATE TABLE `reviews` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `customerId` int DEFAULT NULL,
  `rating` int DEFAULT NULL,
  `comment` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `reviews`
--

INSERT INTO `reviews` (`id`, `bookingId`, `customerId`, `rating`, `comment`, `createdAt`) VALUES
(1, 1, 1, 5, 'Phong sach se, nhan vien than thien', '2026-06-10 23:26:20'),
(2, 2, 2, 4, 'Phong dep, do an ngon', '2026-06-10 23:26:20'),
(3, 3, 3, 5, 'Rat hai long voi dich vu', '2026-06-10 23:26:20'),
(4, 4, 4, 4, 'Gia hop ly', '2026-06-10 23:26:20'),
(5, 5, 5, 5, 'Se quay lai lan sau', '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Table structure for table `rooms`
--

CREATE TABLE `rooms` (
  `id` int NOT NULL,
  `roomTypeId` int DEFAULT NULL,
  `roomNumber` varchar(50) DEFAULT NULL,
  `floor` int DEFAULT NULL,
  `area` decimal(10,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `rooms`
--

INSERT INTO `rooms` (`id`, `roomTypeId`, `roomNumber`, `floor`, `area`, `status`) VALUES
(1, 1, '101', 1, 25.00, 'available'),
(2, 1, '102', 1, 25.00, 'available'),
(3, 1, '103', 1, 25.00, 'available'),
(4, 1, '104', 1, 25.00, 'available'),
(5, 2, '201', 2, 30.00, 'available'),
(6, 2, '202', 2, 30.00, 'available'),
(7, 2, '203', 2, 30.00, 'available'),
(8, 2, '204', 2, 30.00, 'available'),
(9, 3, '301', 3, 35.00, 'available'),
(10, 3, '302', 3, 35.00, 'available'),
(11, 3, '303', 3, 35.00, 'available'),
(12, 3, '304', 3, 35.00, 'available'),
(13, 4, '401', 4, 45.00, 'available'),
(14, 4, '402', 4, 45.00, 'available'),
(15, 4, '403', 4, 45.00, 'available'),
(16, 4, '404', 4, 45.00, 'available'),
(17, 5, '501', 5, 60.00, 'available'),
(18, 5, '502', 5, 60.00, 'available'),
(19, 5, '503', 5, 60.00, 'available'),
(20, 5, '504', 5, 60.00, 'available');

-- --------------------------------------------------------

--
-- Table structure for table `room_images`
--

CREATE TABLE `room_images` (
  `id` int NOT NULL,
  `roomTypeId` int DEFAULT NULL,
  `imageUrl` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `room_images`
--

INSERT INTO `room_images` (`id`, `roomTypeId`, `imageUrl`) VALUES
(1, 1, 'standard1.jpg'),
(2, 1, 'standard2.jpg'),
(3, 2, 'superior1.jpg'),
(4, 2, 'superior2.jpg'),
(5, 3, 'deluxe1.jpg'),
(6, 3, 'deluxe2.jpg'),
(7, 4, 'family1.jpg'),
(8, 4, 'family2.jpg'),
(9, 5, 'suite1.jpg'),
(10, 5, 'suite2.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `room_items`
--

CREATE TABLE `room_items` (
  `id` int NOT NULL,
  `roomId` int DEFAULT NULL,
  `itemName` varchar(255) DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `room_items`
--

INSERT INTO `room_items` (`id`, `roomId`, `itemName`, `quantity`, `status`) VALUES
(1, 1, 'TV', 1, 'normal'),
(2, 1, 'Remote', 1, 'normal'),
(3, 2, 'Hair Dryer', 1, 'normal'),
(4, 3, 'Mini Bar', 1, 'normal'),
(5, 4, 'Kettle', 1, 'normal'),
(6, 5, 'TV', 1, 'normal'),
(7, 6, 'Wardrobe', 1, 'normal'),
(8, 7, 'Air Conditioner', 1, 'normal'),
(9, 8, 'Mirror', 1, 'normal'),
(10, 9, 'Desk Lamp', 1, 'normal');

-- --------------------------------------------------------

--
-- Table structure for table `room_prices`
--

CREATE TABLE `room_prices` (
  `id` int NOT NULL,
  `roomTypeId` int DEFAULT NULL,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `price` decimal(15,2) DEFAULT NULL,
  `priceType` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `room_prices`
--

INSERT INTO `room_prices` (`id`, `roomTypeId`, `startDate`, `endDate`, `price`, `priceType`) VALUES
(1, 1, '2026-01-01', '2026-12-31', 500000.00, 'normal'),
(2, 2, '2026-01-01', '2026-12-31', 700000.00, 'normal'),
(3, 3, '2026-01-01', '2026-12-31', 900000.00, 'normal'),
(4, 4, '2026-01-01', '2026-12-31', 1200000.00, 'normal'),
(5, 5, '2026-01-01', '2026-12-31', 2000000.00, 'normal');

-- --------------------------------------------------------

--
-- Table structure for table `room_types`
--

CREATE TABLE `room_types` (
  `id` int NOT NULL,
  `typeName` varchar(255) DEFAULT NULL,
  `description` text,
  `capacity` int DEFAULT NULL,
  `defaultPrice` decimal(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `room_types`
--

INSERT INTO `room_types` (`id`, `typeName`, `description`, `capacity`, `defaultPrice`) VALUES
(1, 'Standard', 'Phong tieu chuan', 2, 500000.00),
(2, 'Superior', 'Phong superior', 2, 700000.00),
(3, 'Deluxe', 'Phong deluxe', 3, 900000.00),
(4, 'Family', 'Phong gia dinh', 4, 1200000.00),
(5, 'Suite', 'Phong tong thong', 4, 2000000.00);

-- --------------------------------------------------------

--
-- Table structure for table `room_type_amenities`
--

CREATE TABLE `room_type_amenities` (
  `id` int NOT NULL,
  `roomTypeId` int DEFAULT NULL,
  `amenityId` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `room_type_amenities`
--

INSERT INTO `room_type_amenities` (`id`, `roomTypeId`, `amenityId`) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 1, 3),
(4, 2, 1),
(5, 2, 2),
(6, 2, 3),
(7, 2, 8),
(8, 3, 1),
(9, 3, 2),
(10, 3, 3),
(11, 3, 4),
(12, 3, 8),
(13, 4, 1),
(14, 4, 2),
(15, 4, 3),
(16, 4, 4),
(17, 4, 8),
(18, 4, 9),
(19, 5, 1),
(20, 5, 2),
(21, 5, 3),
(22, 5, 4),
(23, 5, 5),
(24, 5, 6),
(25, 5, 8),
(26, 5, 9),
(27, 5, 10);

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` int NOT NULL,
  `serviceName` varchar(255) DEFAULT NULL,
  `price` decimal(15,2) DEFAULT NULL,
  `description` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `serviceName`, `price`, `description`) VALUES
(1, 'Breakfast', 150000.00, 'Buffet'),
(2, 'Laundry', 100000.00, 'Laundry Service'),
(3, 'Spa', 300000.00, 'Spa Service'),
(4, 'Airport Pickup', 500000.00, 'Airport Transfer'),
(5, 'Room Service', 200000.00, 'Room Service'),
(6, 'Dinner Buffet', 350000.00, 'Dinner'),
(7, 'Massage', 400000.00, 'Massage'),
(8, 'Bicycle Rental', 100000.00, 'Bike'),
(9, 'Mini Bar', 120000.00, 'Mini Bar'),
(10, 'Extra Bed', 250000.00, 'Extra Bed'),
(13, 'sấy quần áo', 500000.00, 'Sấy nhanh trong 24H'),
(14, 'giặt quần áo nhanh', 300000.00, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `vouchers`
--

CREATE TABLE `vouchers` (
  `id` int NOT NULL,
  `code` varchar(100) DEFAULT NULL,
  `discountType` varchar(50) DEFAULT NULL,
  `discountValue` decimal(15,2) DEFAULT NULL,
  `maxDiscount` decimal(15,2) DEFAULT NULL,
  `minBookingAmount` decimal(15,2) DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `vouchers`
--

INSERT INTO `vouchers` (`id`, `code`, `discountType`, `discountValue`, `maxDiscount`, `minBookingAmount`, `quantity`, `startDate`, `endDate`, `status`) VALUES
(1, 'SUMMER10', 'percent', 10.00, 300000.00, 500000.00, 100, '2026-01-01', '2026-12-31', 'active'),
(2, 'WELCOME50', 'fixed', 50000.00, 50000.00, 300000.00, 200, '2026-01-01', '2026-12-31', 'active'),
(3, 'VIP20', 'percent', 20.00, 500000.00, 1000000.00, 50, '2026-01-01', '2026-12-31', 'active');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `amenities`
--
ALTER TABLE `amenities`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `bookingCode` (`bookingCode`),
  ADD KEY `customerId` (`customerId`),
  ADD KEY `voucherId` (`voucherId`);

--
-- Indexes for table `booking_damage_charges`
--
ALTER TABLE `booking_damage_charges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomId` (`roomId`);

--
-- Indexes for table `booking_details`
--
ALTER TABLE `booking_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomId` (`roomId`);

--
-- Indexes for table `booking_guests`
--
ALTER TABLE `booking_guests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`);

--
-- Indexes for table `booking_room_transfers`
--
ALTER TABLE `booking_room_transfers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `fromRoomId` (`fromRoomId`),
  ADD KEY `toRoomId` (`toRoomId`);

--
-- Indexes for table `booking_services`
--
ALTER TABLE `booking_services`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `serviceId` (`serviceId`);

--
-- Indexes for table `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `serviceId` (`serviceId`);

--
-- Indexes for table `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `changedBy` (`changedBy`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `accountId` (`accountId`);

--
-- Indexes for table `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomItemId` (`roomItemId`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD KEY `accountId` (`accountId`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `accountId` (`accountId`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`);

--
-- Indexes for table `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `paymentId` (`paymentId`),
  ADD KEY `changedBy` (`changedBy`);

--
-- Indexes for table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `customerId` (`customerId`);

--
-- Indexes for table `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`);

--
-- Indexes for table `room_images`
--
ALTER TABLE `room_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`);

--
-- Indexes for table `room_items`
--
ALTER TABLE `room_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomId` (`roomId`);

--
-- Indexes for table `room_prices`
--
ALTER TABLE `room_prices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`);

--
-- Indexes for table `room_types`
--
ALTER TABLE `room_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`),
  ADD KEY `amenityId` (`amenityId`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `vouchers`
--
ALTER TABLE `vouchers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `amenities`
--
ALTER TABLE `amenities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `booking_damage_charges`
--
ALTER TABLE `booking_damage_charges`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `booking_details`
--
ALTER TABLE `booking_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `booking_guests`
--
ALTER TABLE `booking_guests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `booking_room_transfers`
--
ALTER TABLE `booking_room_transfers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `booking_services`
--
ALTER TABLE `booking_services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `damage_reports`
--
ALTER TABLE `damage_reports`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `room_images`
--
ALTER TABLE `room_images`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `room_items`
--
ALTER TABLE `room_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `room_prices`
--
ALTER TABLE `room_prices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `room_types`
--
ALTER TABLE `room_types`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `vouchers`
--
ALTER TABLE `vouchers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`voucherId`) REFERENCES `vouchers` (`id`);

--
-- Constraints for table `booking_damage_charges`
--
ALTER TABLE `booking_damage_charges`
  ADD CONSTRAINT `booking_damage_charges_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_damage_charges_ibfk_2` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `booking_details`
--
ALTER TABLE `booking_details`
  ADD CONSTRAINT `booking_details_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_details_ibfk_2` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`);

--
-- Constraints for table `booking_guests`
--
ALTER TABLE `booking_guests`
  ADD CONSTRAINT `booking_guests_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `booking_room_transfers`
--
ALTER TABLE `booking_room_transfers`
  ADD CONSTRAINT `booking_room_transfers_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_room_transfers_ibfk_2` FOREIGN KEY (`fromRoomId`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_room_transfers_ibfk_3` FOREIGN KEY (`toRoomId`) REFERENCES `rooms` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `booking_services`
--
ALTER TABLE `booking_services`
  ADD CONSTRAINT `booking_services_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_services_ibfk_2` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`);

--
-- Constraints for table `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  ADD CONSTRAINT `booking_service_requests_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_service_requests_ibfk_2` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  ADD CONSTRAINT `booking_status_logs_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_status_logs_ibfk_2` FOREIGN KEY (`changedBy`) REFERENCES `accounts` (`id`);

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Constraints for table `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD CONSTRAINT `damage_reports_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `damage_reports_ibfk_2` FOREIGN KEY (`roomItemId`) REFERENCES `room_items` (`id`);

--
-- Constraints for table `employees`
--
ALTER TABLE `employees`
  ADD CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`);

--
-- Constraints for table `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  ADD CONSTRAINT `payment_status_logs_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`),
  ADD CONSTRAINT `payment_status_logs_ibfk_2` FOREIGN KEY (`changedBy`) REFERENCES `accounts` (`id`);

--
-- Constraints for table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`);

--
-- Constraints for table `rooms`
--
ALTER TABLE `rooms`
  ADD CONSTRAINT `rooms_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Constraints for table `room_images`
--
ALTER TABLE `room_images`
  ADD CONSTRAINT `room_images_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Constraints for table `room_items`
--
ALTER TABLE `room_items`
  ADD CONSTRAINT `room_items_ibfk_1` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`);

--
-- Constraints for table `room_prices`
--
ALTER TABLE `room_prices`
  ADD CONSTRAINT `room_prices_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Constraints for table `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  ADD CONSTRAINT `room_type_amenities_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`),
  ADD CONSTRAINT `room_type_amenities_ibfk_2` FOREIGN KEY (`amenityId`) REFERENCES `amenities` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
