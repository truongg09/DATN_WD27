-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Aug 10, 2026 at 08:13 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `hotelbookingdb`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `accounts`
--

CREATE TABLE `accounts` (
  `id` int(11) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) DEFAULT 'customer',
  `status` varchar(50) DEFAULT 'active',
  `createdAt` datetime DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `accounts`
--

INSERT INTO `accounts` (`id`, `full_name`, `email`, `phone`, `password`, `role`, `status`, `createdAt`, `created_at`, `updated_at`) VALUES
(1, 'admin@gmail.com', 'admin@gmail.com', NULL, '$2b$10$uuX8Mjpl6a2IS..Ige9Jw.9StTcuNDRdCQ9fdqlvPkm7WneueCF22', 'admin', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(2, 'staff1@gmail.com', 'staff1@gmail.com', NULL, '$2b$10$ONOUlNU6CSOUCMbGFZL0muxNp0/57w1xqso7on/8bo0Hbzih4z5nS', 'staff', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(3, 'staff2@gmail.com', 'staff2@gmail.com', NULL, '$2b$10$5Xfa.E5M7luC5WXzC2koIuksSLLSlfVzXC8./xGkuIbch0ixNy9N6', 'staff', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(4, 'customer1@gmail.com', 'customer1@gmail.com', NULL, '$2b$10$FXjdtOIDJF39TZ2tlW0/ceS0lmDT7JYnJRr4wvWtYhe1odDVMFj6K', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(5, 'customer2@gmail.com', 'customer2@gmail.com', NULL, '$2b$10$1dxi6aRvMQrughiqFMZwiOSf7lh8R6nUlSP4nyhCSBoVkOFFmtzEW', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(6, 'customer3@gmail.com', 'customer3@gmail.com', NULL, '$2b$10$B0VatADJs3OUgKQDcwWssO60hiKJFM/6H1u7/qtOBm2qwl/trPY52', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(7, 'customer4@gmail.com', 'customer4@gmail.com', NULL, '$2b$10$824r9bxuIsLnFiy7CmIjxupnpSHMpRW5ddF1FB0EsUAlbA01I/FPC', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(8, 'customer5@gmail.com', 'customer5@gmail.com', NULL, '$2b$10$ybG8Vuj9MDm4E1ZerIGsBeanV2Tm4WadCJZHq5C4gxQurT7gHdHBW', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-02 04:53:14'),
(9, 'Test User', 'test1782044410483@example.com', '0123456789', '$2b$10$DGcENCfuAhZq16hTNUwtAu5U0R/xoQI/VJeJ087ZF3qGXzXjCv8GO', 'customer', 'active', '2026-06-21 19:20:10', '2026-06-21 12:20:10', '2026-06-21 12:20:33'),
(10, 'Test User', 'test1782044433890@example.com', '0123456789', '$2b$10$6HKWHAVun.rlLZ6UZ/L8K.cA92DipGSbAUyrhsZ13qOV1Ctd2nhfy', 'customer', 'active', '2026-06-21 19:20:33', '2026-06-21 12:20:33', '2026-06-21 12:20:33'),
(11, 'API Test User', 'api-test-1782044456618@example.com', '0900000000', '$2b$10$W1b50nB6U8CHegYAPWLgQO5KMxf61.rELk84ktJgz33GlFFrHChk6', 'customer', 'active', '2026-06-21 19:20:57', '2026-06-21 12:20:57', '2026-06-21 12:20:57'),
(12, 'Hương Trần', 'tranphuhuong1802@gmail.com', '0909999999', '$2b$10$mll3uj3dRFr6ohp6/jEOCuy9ZGKWifeve6lqABrYYMrSBXbGIZTna', 'customer', 'active', '2026-06-21 19:22:34', '2026-06-21 12:22:34', '2026-06-21 12:22:34'),
(13, NULL, 'hieumon482@gmail.com', '0349154051', '$2b$10$ZaPxLljMaODCyCBP8B0XuO.F3M6.gdLCLWmWigei8hBJccbAU5n4y', 'customer', 'active', '2026-06-24 15:19:58', '2026-06-24 08:19:58', '2026-06-24 08:19:58'),
(14, NULL, 'minhdz@gmail.com', '01234567890', '$2b$10$mY6O2OZw0KQqp7rDB5VWp.7CilDCZ2Geo30Q6ew8/l9VYXkx0nC3K', 'customer', 'active', '2026-07-25 14:57:17', '2026-07-25 07:57:17', '2026-08-02 03:43:14'),
(15, NULL, 'minhdeptry@gmail.com', '0123456789', '$2b$10$2fumwLRc4fnNXm7qBCMEdeGfc8/FsIjN2HiwiDUpy3vCe9TQKXjEC', 'customer', 'active', '2026-08-02 09:46:11', '2026-08-02 02:46:11', '2026-08-02 02:46:11');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `amenities`
--

CREATE TABLE `amenities` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `amenities`
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
-- Cấu trúc bảng cho bảng `app_settings`
--

CREATE TABLE `app_settings` (
  `settingKey` varchar(100) NOT NULL,
  `settingValue` text NOT NULL,
  `updatedAt` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `app_settings`
--

INSERT INTO `app_settings` (`settingKey`, `settingValue`, `updatedAt`) VALUES
('payment_account', '{\"bankBin\":\"546034\",\"bankCode\":\"CAKE\",\"bankName\":\"CAKE by VPBank - NH số CAKE\",\"accountNumber\":\"0373179525\",\"accountName\":\"NGUYEN VAN MINH\",\"transferPrefix\":\"HB\"}', '2026-07-25 15:01:50');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `room_id` int(11) DEFAULT NULL,
  `check_in` date DEFAULT NULL,
  `check_out` date DEFAULT NULL,
  `actualCheckOutTime` datetime DEFAULT NULL,
  `requestedCheckInTime` time DEFAULT NULL,
  `requestedCheckInDayOffset` int NOT NULL DEFAULT '0',
  `requestedCheckOutTime` time DEFAULT NULL,
  `actualCheckInTime` datetime DEFAULT NULL,
  `total_price` decimal(15,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `notes` text,
  `extraGuestSnapshot` json DEFAULT NULL,
  `cancellation_reason` text,
  `cancelInitiator` enum('customer','hotel','system') DEFAULT NULL,
  `guest_name` varchar(255) DEFAULT NULL,
  `guest_email` varchar(255) DEFAULT NULL,
  `guest_phone` varchar(20) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `voucherId` int(11) DEFAULT NULL,
  `bookingCode` varchar(100) DEFAULT NULL,
  `bookingStatus` varchar(50) DEFAULT NULL,
  `totalAmount` decimal(15,2) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `bookings`
--

INSERT INTO `bookings` (`id`, `user_id`, `room_id`, `check_in`, `check_out`, `actualCheckOutTime`, `requestedCheckInTime`, `requestedCheckInDayOffset`, `requestedCheckOutTime`, `actualCheckInTime`, `total_price`, `status`, `notes`, `extraGuestSnapshot`, `cancellation_reason`, `cancelInitiator`, `guest_name`, `guest_email`, `guest_phone`, `customerId`, `voucherId`, `bookingCode`, `bookingStatus`, `totalAmount`, `createdAt`, `created_at`) VALUES
(1, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 900000.00, 'no_show', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, 'BK001', 'no_show', 900000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(2, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 1350000.00, 'cancelled', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 2, 'BK002', 'cancelled', 1350000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(3, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 2600000.00, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 3, 3, 'BK003', 'checkout', 2600000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(4, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 1200000.00, 'cancelled', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4, NULL, 'BK004', 'cancelled', 1200000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(5, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 1800000.00, 'no_show', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, 1, 'BK005', 'no_show', 1800000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(7, 12, 1, '2026-06-24', '2026-07-25', NULL, NULL, 0, NULL, NULL, 15500000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 15500000.00, '2026-06-24 01:37:20', '2026-06-23 18:37:20'),
(8, 12, 3, '2026-06-24', '2026-07-22', NULL, NULL, 0, NULL, NULL, 14000000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 14000000.00, '2026-06-24 01:47:03', '2026-06-23 18:47:03'),
(9, 12, 2, '2026-06-25', '2026-07-01', NULL, NULL, 0, NULL, NULL, 3000000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3000000.00, '2026-06-24 01:52:06', '2026-06-23 18:52:06'),
(10, 12, 8, '2026-06-25', '2026-07-01', NULL, NULL, 0, NULL, NULL, 4200000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Minh Tài', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 4200000.00, '2026-06-24 02:05:29', '2026-06-23 19:05:29'),
(11, 12, 2, '2026-06-24', '2026-07-01', NULL, NULL, 0, NULL, NULL, 3500000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 02:33:25', '2026-06-23 19:33:25'),
(12, 12, 1, '2026-06-24', '2026-07-01', NULL, NULL, 0, NULL, NULL, 3500000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 07:28:47', '2026-06-24 00:28:47'),
(13, 12, 1, '2026-06-24', '2026-07-01', NULL, NULL, 0, NULL, NULL, 3500000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 14:52:37', '2026-06-24 07:52:37'),
(14, 13, 4, '2026-06-24', '2026-07-31', NULL, NULL, 0, NULL, NULL, 18500000.00, 'cancelled', NULL, NULL, NULL, NULL, 'dsfsdfsdf', 'hieumon482@gmail.com', '0349154051', 8, NULL, NULL, 'cancelled', 18500000.00, '2026-06-24 15:20:24', '2026-06-24 08:20:24'),
(16, 12, 5, '2026-07-11', '2026-08-04', NULL, NULL, 0, NULL, NULL, 16800000.00, 'no_show', NULL, NULL, NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'no_show', 16800000.00, '2026-07-11 10:56:51', '2026-07-11 03:56:51'),
(17, 14, 1, '2026-07-26', '2026-07-28', NULL, NULL, 0, NULL, NULL, 1000000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Nguyễn Văn Minh', 'minhdz@gmail.com', '0123456789', 9, NULL, NULL, 'cancelled', 1000000.00, '2026-07-25 14:57:43', '2026-07-25 07:57:43'),
(18, 14, 1, '2026-07-28', '2026-07-30', NULL, NULL, 0, NULL, NULL, 1000000.00, 'cancelled', NULL, NULL, NULL, NULL, 'Nguyễn Văn Minh', 'minhdz@gmail.com', '0123456789', 9, NULL, NULL, 'cancelled', 1000000.00, '2026-07-25 15:01:53', '2026-07-25 08:01:53'),
(101, 12, 1, '2026-07-05', '2026-07-07', NULL, NULL, 0, NULL, NULL, 1200000.00, 'completed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'checkout', 1200000.00, '2026-07-26 16:42:10', '2026-07-26 09:42:10'),
(102, 12, 2, '2026-07-10', '2026-07-12', NULL, NULL, 0, NULL, NULL, 1800000.00, 'completed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'checkout', 1800000.00, '2026-07-26 16:42:10', '2026-07-26 09:42:10'),
(103, 12, 3, '2026-07-15', '2026-07-18', NULL, NULL, 0, NULL, NULL, 2700000.00, 'completed', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'checkout', 2700000.00, '2026-07-26 16:42:10', '2026-07-26 09:42:10'),
(200, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 5700000.00, 'no_show', 'Booking test 2 phong khac loai - dung de kiem tra fan-out', NULL, NULL, NULL, 'Nguyen Van Test', 'test@example.com', '0900000000', 7, NULL, 'BK-TEST-200', 'no_show', 5700000.00, '2026-07-20 09:00:00', '2026-07-20 02:00:00'),
(201, NULL, 5, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BK201', 'confirmed', NULL, '2026-07-26 16:48:09', '2026-07-15 03:00:00'),
(202, NULL, 6, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BK202', 'confirmed', NULL, '2026-07-26 16:48:09', '2026-07-18 03:00:00'),
(203, NULL, 7, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BK203', 'confirmed', NULL, '2026-07-26 16:48:09', '2026-07-20 03:00:00'),
(204, NULL, 8, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BK204', 'confirmed', NULL, '2026-07-26 16:48:09', '2026-07-22 03:00:00'),
(301, NULL, 9, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BK301', 'confirmed', NULL, '2026-07-26 16:54:29', '2026-07-20 03:00:00'),
(302, NULL, 13, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BK302', 'confirmed', NULL, '2026-07-26 16:54:29', '2026-07-21 03:00:00'),
(303, NULL, 17, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'BK303', 'confirmed', NULL, '2026-07-26 16:54:29', '2026-07-22 03:00:00'),
(304, 14, 1, '2026-07-10', '2026-07-15', NULL, NULL, 0, NULL, NULL, 2500000.00, 'checked_out', NULL, NULL, NULL, NULL, 'Nguyễn Văn Minh', 'minhdz@gmail.com', '0123456789', 9, NULL, NULL, 'checked_out', 2500000.00, '2026-07-27 08:47:00', '2026-07-27 01:47:00'),
(305, 14, 13, '2026-07-30', '2026-08-02', NULL, NULL, 0, NULL, NULL, 4200000.00, 'checked_out', NULL, NULL, NULL, NULL, 'minhdz', 'minhdz@gmail.com', '0123456789', 9, NULL, NULL, 'checked_out', 4700000.00, '2026-07-30 11:07:56', '2026-07-30 04:07:56'),
(306, 14, 1, '2026-08-04', '2026-08-05', NULL, NULL, 0, NULL, NULL, 900000.00, 'cancelled', NULL, NULL, NULL, NULL, 'minhdz', 'minhdz@gmail.com', '0123456789', 9, NULL, NULL, 'cancelled', 900000.00, '2026-08-01 17:19:10', '2026-08-01 10:19:10'),
(307, 14, 17, '2026-08-03', '2026-08-05', NULL, NULL, 0, NULL, NULL, 4000000.00, 'cancelled', NULL, NULL, 'vấn đề về sức khỏe', NULL, 'minhdz', 'minhdz@gmail.com', '01234567890', 9, NULL, NULL, 'cancelled', 4550000.00, '2026-08-02 11:39:31', '2026-08-02 04:39:31'),
(308, 14, 13, '2026-08-02', '2026-08-04', NULL, NULL, 0, NULL, NULL, 2800000.00, 'checked_out', NULL, NULL, NULL, NULL, 'minhdz', 'minhdz@gmail.com', '01234567890', 9, NULL, NULL, 'checked_out', 3700000.00, '2026-08-02 11:40:38', '2026-08-02 04:40:38'),
(309, 14, 9, '2026-08-02', '2026-08-03', NULL, NULL, 0, NULL, NULL, 900000.00, 'checked_out', NULL, NULL, NULL, NULL, 'minhdz', 'minhdz@gmail.com', '01234567890', 9, NULL, NULL, 'checked_out', 900000.00, '2026-08-02 12:33:52', '2026-08-02 05:33:52'),
(310, 14, 1, '2026-08-11', '2026-08-12', NULL, NULL, 0, NULL, NULL, 500000.00, 'cancelled', NULL, NULL, NULL, NULL, 'minhdz', 'minhdz@gmail.com', '01234567890', 9, NULL, NULL, 'cancelled', 500000.00, '2026-08-09 10:05:23', '2026-08-09 03:05:23'),
(311, 14, 5, '2026-08-09', '2026-08-10', NULL, NULL, 0, NULL, NULL, 700000.00, 'checked_in', NULL, NULL, NULL, NULL, 'minhdz', 'minhdz@gmail.com', '01234567890', 9, NULL, NULL, 'checked_in', 700000.00, '2026-08-09 11:21:12', '2026-08-09 04:21:12'),
(312, 15, 5, '2026-08-10', '2026-08-11', NULL, NULL, 0, NULL, NULL, 700000.00, 'confirmed', NULL, NULL, NULL, NULL, 'minhdeptry', 'minhdeptry@gmail.com', '0123456789', 10, NULL, NULL, 'confirmed', 700000.00, '2026-08-09 11:24:50', '2026-08-09 04:24:50'),
(313, 15, 6, '2026-08-10', '2026-08-11', NULL, '17:45:00', 0, '12:00:00', NULL, 700000.00, 'confirmed', NULL, NULL, NULL, NULL, 'minhdeptry', 'minhdeptry@gmail.com', '0123456789', 10, NULL, NULL, 'confirmed', 700000.00, '2026-08-09 13:28:40', '2026-08-09 06:28:40'),
(314, 1, 1, '2026-09-01', '2026-09-03', NULL, NULL, 0, NULL, NULL, 2000000.00, 'confirmed', NULL, '{\"adults\": 3, \"nights\": 2, \"children\": 1, \"extraAdults\": 0, \"childrenAges\": [7], \"maxOccupancy\": 3, \"roomQuantity\": 2, \"adultCapacity\": 2, \"childCapacity\": 1, \"extraAdultFee\": 200000, \"extraChildFee\": 100000, \"extraChildren\": 0, \"effectiveAdults\": 3, \"extraAdultAmount\": 0, \"extraChildAmount\": 0, \"effectiveChildren\": 1, \"totalMaxOccupancy\": 6, \"totalAdultCapacity\": 4, \"totalChildCapacity\": 2, \"totalExtraGuestFee\": 0}', NULL, NULL, NULL, NULL, NULL, 6, NULL, NULL, 'confirmed', 2000000.00, '2026-08-10 14:39:47', '2026-08-10 07:39:47');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_damage_charges`
--

CREATE TABLE `booking_damage_charges` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `roomId` int NOT NULL,
  `chargeType` enum('damage','extra_fee','other') NOT NULL DEFAULT 'damage',
  `itemName` varchar(255) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unitPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `totalPrice` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('unused','used','cancelled') NOT NULL DEFAULT 'used',
  `note` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_details`
--

CREATE TABLE `booking_details` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) DEFAULT NULL,
  `roomId` int(11) DEFAULT NULL,
  `checkInDate` date DEFAULT NULL,
  `checkOutDate` date DEFAULT NULL,
  `requestedCheckInTime` time DEFAULT NULL,
  `requestedCheckOutTime` time DEFAULT NULL,
  `requestedCheckInDayOffset` int NOT NULL DEFAULT '0',
  `adults` int DEFAULT NULL,
  `children` int DEFAULT NULL,
  `roomPrice` decimal(15,2) DEFAULT NULL,
  `occupancySurcharge` decimal(15,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_details`
--

INSERT INTO `booking_details` (`id`, `bookingId`, `roomId`, `checkInDate`, `checkOutDate`, `requestedCheckInTime`, `requestedCheckOutTime`, `requestedCheckInDayOffset`, `adults`, `children`, `roomPrice`, `occupancySurcharge`) VALUES
(1, 1, 1, '2026-06-10', '2026-06-12', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(2, 2, 5, '2026-06-15', '2026-06-17', NULL, NULL, 0, 2, 1, 700000.00, 0.00),
(3, 3, 9, '2026-06-20', '2026-06-23', NULL, NULL, 0, 3, 1, 900000.00, 0.00),
(4, 4, 13, '2026-06-22', '2026-06-24', NULL, NULL, 0, 4, 0, 1200000.00, 0.00),
(5, 5, 17, '2026-06-25', '2026-06-27', NULL, NULL, 0, 2, 0, 2000000.00, 0.00),
(7, 7, 1, '2026-06-24', '2026-07-25', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(8, 8, 3, '2026-06-24', '2026-07-22', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(9, 9, 2, '2026-06-25', '2026-07-01', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(10, 10, 8, '2026-06-25', '2026-07-01', NULL, NULL, 0, 2, 0, 700000.00, 0.00),
(11, 11, 2, '2026-06-24', '2026-07-01', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(12, 12, 1, '2026-06-24', '2026-07-01', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(13, 13, 1, '2026-06-24', '2026-07-01', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(14, 14, 4, '2026-06-24', '2026-07-31', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(16, 16, 5, '2026-07-11', '2026-08-04', NULL, NULL, 0, 2, 0, 700000.00, 0.00),
(17, 17, 1, '2026-07-26', '2026-07-28', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(18, 18, 1, '2026-07-28', '2026-07-30', NULL, NULL, 0, 1, 0, 5000.00, 0.00),
(201, 200, 5, '2026-07-20', '2026-07-23', NULL, NULL, 0, 2, 0, 700000.00, 0.00),
(202, 200, 13, '2026-07-20', '2026-07-23', NULL, NULL, 0, 2, 0, 1200000.00, 0.00),
(203, 305, 13, '2026-07-30', '2026-08-02', NULL, NULL, 0, 2, 2, 1200000.00, 600000.00),
(204, 306, 1, '2026-08-04', '2026-08-05', NULL, NULL, 0, 2, 0, 5000.00, 400000.00),
(205, 307, 17, '2026-08-03', '2026-08-05', NULL, NULL, 0, 2, 0, 2000000.00, 0.00),
(206, 308, 13, '2026-08-02', '2026-08-04', NULL, NULL, 0, 2, 2, 1200000.00, 400000.00),
(207, 309, 9, '2026-08-02', '2026-08-03', NULL, NULL, 0, 2, 0, 900000.00, 0.00),
(208, 310, 1, '2026-08-11', '2026-08-12', NULL, NULL, 0, 2, 0, 5000.00, 0.00),
(209, 311, 5, '2026-08-09', '2026-08-10', NULL, NULL, 0, 2, 0, 700000.00, 0.00),
(210, 312, 5, '2026-08-10', '2026-08-11', NULL, NULL, 0, 2, 0, 700000.00, 0.00),
(211, 313, 6, '2026-08-10', '2026-08-11', '17:45:00', '12:00:00', 0, 2, 0, 700000.00, 0.00),
(212, 314, 1, '2026-09-01', '2026-09-03', NULL, NULL, 0, 2, 0, 500000.00, 0.00),
(213, 314, 2, '2026-09-01', '2026-09-03', NULL, NULL, 0, 1, 1, 500000.00, 0.00);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_guests`
--

CREATE TABLE `booking_guests` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `fullName` varchar(255) NOT NULL,
  `identityNumber` varchar(50) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_guests`
--

INSERT INTO `booking_guests` (`id`, `bookingId`, `fullName`, `identityNumber`, `phone`, `note`, `createdAt`) VALUES
(1, 305, 'minhdz', '1234567890', '0123456789', NULL, '2026-07-30 11:13:32'),
(2, 308, 'minhdz', '1234567890', '01234567890', NULL, '2026-08-02 11:41:19'),
(3, 309, 'minhdz', '1234567890', '01234567890', NULL, '2026-08-02 12:34:50'),
(4, 311, 'minhdz', '123456789012', '01234567890', NULL, '2026-08-09 11:23:20');

-- --------------------------------------------------------

--
-- Table structure for table `booking_history`
--

CREATE TABLE `booking_history` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `action` varchar(50) NOT NULL,
  `description` text,
  `oldValue` text,
  `newValue` text,
  `amount` decimal(15,2) DEFAULT NULL,
  `performedBy` int DEFAULT NULL,
  `performedByName` varchar(255) DEFAULT NULL,
  `performedByRole` varchar(30) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `booking_history`
--

INSERT INTO `booking_history` (`id`, `bookingId`, `action`, `description`, `oldValue`, `newValue`, `amount`, `performedBy`, `performedByName`, `performedByRole`, `createdAt`) VALUES
(1, 307, 'refund', 'Hoàn tiền giao dịch #203: 4.550.000₫', '{\"paymentStatus\":\"paid\",\"paidAmount\":4550000}', '{\"paymentStatus\":\"refunded\"}', 4550000.00, 1, 'admin@gmail.com', 'admin', '2026-08-02 11:54:15'),
(2, 307, 'cancelled', 'Hủy đặt phòng. Lý do: vấn đề về sức khỏe', '{\"status\":\"confirmed\"}', '{\"status\":\"cancelled\",\"reason\":\"vấn đề về sức khỏe\"}', NULL, 14, 'minhdz', 'customer', '2026-08-02 12:20:08'),
(3, 309, 'created', 'Tạo đặt phòng phòng 301 từ 02/08/2026 đến 03/08/2026 (1 đêm), tổng tiền 900.000₫', NULL, '{\"roomId\":9,\"checkIn\":\"2026-08-02\",\"checkOut\":\"2026-08-03\",\"totalPrice\":900000}', 900000.00, 14, 'minhdz', 'customer', '2026-08-02 12:33:52'),
(4, 309, 'payment', 'Xác nhận thanh toán VNPay 900.000₫ — đã thanh toán đủ (mã GD: VNPAY-205-1785648836063)', NULL, '{\"paidAmount\":900000,\"remainingAmount\":0,\"paymentStatus\":\"paid\",\"transactionCode\":\"VNPAY-205-1785648836063\"}', 900000.00, NULL, NULL, 'system', '2026-08-02 12:34:24'),
(5, 309, 'checked_in', 'Khách nhận phòng. Khách lưu trú: minhdz', '{\"status\":\"confirmed\"}', '{\"status\":\"checked_in\",\"lateCheckIn\":false}', NULL, 1, 'admin@gmail.com', 'admin', '2026-08-02 12:34:50'),
(6, 309, 'checked_out', 'Khách trả phòng sớm 1 đêm (dự kiến 03/08/2026). Tạo yêu cầu hoàn 50% = 450.000₫ chờ duyệt', '{\"status\":\"checked_in\",\"checkOut\":\"2026-08-03\"}', '{\"status\":\"checked_out\",\"actualCheckOut\":\"2026-08-02\"}', 450000.00, 1, 'admin@gmail.com', 'admin', '2026-08-02 12:35:06'),
(7, 309, 'refund_approved', 'Duyệt hoàn tiền 450.000₫ vào ví khách', NULL, NULL, 450000.00, 1, 'admin@gmail.com', 'admin', '2026-08-02 12:35:35'),
(8, 309, 'payment', 'Xác nhận thanh toán VNPay 450.000₫ — đã thanh toán đủ (mã GD: VNPAY-205-1785648962706)', NULL, '{\"paidAmount\":900000,\"remainingAmount\":0,\"paymentStatus\":\"paid\",\"transactionCode\":\"VNPAY-205-1785648962706\"}', 450000.00, NULL, NULL, 'system', '2026-08-02 12:36:21'),
(9, 309, 'refund', 'Hoàn tiền giao dịch #205: 900.000₫', '{\"paymentStatus\":\"paid\",\"paidAmount\":900000}', '{\"paymentStatus\":\"refunded\"}', 900000.00, 1, 'admin@gmail.com', 'admin', '2026-08-03 23:02:16'),
(10, 310, 'created', 'Tạo đặt phòng phòng 101 từ 11/08/2026 đến 12/08/2026 (1 đêm), tổng tiền 500.000₫', NULL, '{\"roomId\":1,\"checkIn\":\"2026-08-11\",\"checkOut\":\"2026-08-12\",\"totalPrice\":500000}', 500000.00, 14, 'minhdz@gmail.com', 'customer', '2026-08-09 10:05:23'),
(11, 311, 'created', 'Tạo đặt phòng phòng 201 từ 09/08/2026 đến 10/08/2026 (1 đêm), tổng tiền 700.000₫', NULL, '{\"roomId\":5,\"checkIn\":\"2026-08-09\",\"checkOut\":\"2026-08-10\",\"totalPrice\":700000}', 700000.00, 14, 'minhdz@gmail.com', 'customer', '2026-08-09 11:21:12'),
(12, 311, 'payment', 'Xác nhận thanh toán VNPay 700.000₫ — đã thanh toán đủ (mã GD: VNPAY-207-1786249282023)', NULL, '{\"paidAmount\":700000,\"remainingAmount\":0,\"paymentStatus\":\"paid\",\"transactionCode\":\"VNPAY-207-1786249282023\"}', 700000.00, NULL, NULL, 'system', '2026-08-09 11:21:50'),
(13, 311, 'checked_in', 'Khách nhận phòng. Khách lưu trú: minhdz', '{\"status\":\"confirmed\"}', '{\"status\":\"checked_in\",\"lateCheckIn\":false}', NULL, 1, 'admin@gmail.com', 'admin', '2026-08-09 11:23:20'),
(14, 312, 'created', 'Tạo đặt phòng phòng 201 từ 10/08/2026 đến 11/08/2026 (1 đêm), tổng tiền 700.000₫', NULL, '{\"roomId\":5,\"checkIn\":\"2026-08-10\",\"checkOut\":\"2026-08-11\",\"totalPrice\":700000}', 700000.00, 15, 'minhdeptry@gmail.com', 'customer', '2026-08-09 11:24:50'),
(15, 312, 'payment', 'Xác nhận thanh toán VNPay 700.000₫ — đã thanh toán đủ (mã GD: VNPAY-208-1786249494102)', NULL, '{\"paidAmount\":700000,\"remainingAmount\":0,\"paymentStatus\":\"paid\",\"transactionCode\":\"VNPAY-208-1786249494102\"}', 700000.00, NULL, NULL, 'system', '2026-08-09 11:25:12'),
(16, 313, 'created', 'Tạo đặt phòng phòng 202 từ 10/08/2026 đến 11/08/2026 (1 đêm), tổng tiền 700.000₫', NULL, '{\"roomId\":6,\"checkIn\":\"2026-08-10\",\"checkOut\":\"2026-08-11\",\"totalPrice\":700000}', 700000.00, 15, 'minhdeptry@gmail.com', 'customer', '2026-08-09 13:28:40'),
(17, 313, 'payment', 'Xác nhận thanh toán VNPay 700.000₫ — đã thanh toán đủ (mã GD: VNPAY-209-1786256923492)', NULL, '{\"paidAmount\":700000,\"remainingAmount\":0,\"paymentStatus\":\"paid\",\"transactionCode\":\"VNPAY-209-1786256923492\"}', 700000.00, NULL, NULL, 'system', '2026-08-09 13:29:10'),
(18, 1, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(19, 5, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(20, 200, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(21, 200, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(22, 1, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(23, 5, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(24, 200, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(25, 200, 'no_show', 'Khách đã thanh toán 100% nhưng không đến trong suốt thời gian đặt phòng (đã qua thời gian checkout). Đặt phòng được chuyển sang No-show.', '{\"status\":\"pending\"}', '{\"status\":\"no_show\"}', NULL, NULL, NULL, 'system', '2026-08-10 13:27:04'),
(26, 314, 'created', 'Tạo đặt phòng phòng 101 từ 01/09/2026 đến 03/09/2026 (2 đêm), tổng tiền 2.000.000₫', NULL, '{\"roomId\":1,\"checkIn\":\"2026-09-01\",\"checkOut\":\"2026-09-03\",\"totalPrice\":2000000}', 2000000.00, NULL, NULL, 'system', '2026-08-10 14:39:47');

-- --------------------------------------------------------

--
-- Table structure for table `booking_late_checkout_charges`
--

CREATE TABLE `booking_late_checkout_charges` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `lateMinutes` int NOT NULL,
  `tierPercent` decimal(5,2) NOT NULL,
  `nightlyRate` decimal(15,2) NOT NULL,
  `totalPrice` decimal(15,2) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `booking_nightly_prices`
--

CREATE TABLE `booking_nightly_prices` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `stayDate` date NOT NULL,
  `price` decimal(15,2) NOT NULL DEFAULT '0.00',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `booking_nightly_prices`
--

INSERT INTO `booking_nightly_prices` (`id`, `bookingId`, `stayDate`, `price`, `createdAt`) VALUES
(1, 309, '2026-08-02', 900000.00, '2026-08-02 12:33:52'),
(2, 310, '2026-08-11', 500000.00, '2026-08-09 10:05:23'),
(3, 311, '2026-08-09', 700000.00, '2026-08-09 11:21:12'),
(4, 312, '2026-08-10', 700000.00, '2026-08-09 11:24:50'),
(5, 313, '2026-08-10', 700000.00, '2026-08-09 13:28:40'),
(6, 314, '2026-09-01', 500000.00, '2026-08-10 14:39:47'),
(7, 314, '2026-09-02', 500000.00, '2026-08-10 14:39:47');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_history`
--

CREATE TABLE `booking_history` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `action` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `oldValue` text DEFAULT NULL,
  `newValue` text DEFAULT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `performedBy` int(11) DEFAULT NULL,
  `performedByName` varchar(255) DEFAULT NULL,
  `performedByRole` varchar(30) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_history`
--

INSERT INTO `booking_history` (`id`, `bookingId`, `action`, `description`, `oldValue`, `newValue`, `amount`, `performedBy`, `performedByName`, `performedByRole`, `createdAt`) VALUES
(1, 65, 'created', 'Tạo đặt phòng phòng 101 từ 10/08/2026 đến 12/08/2026 (2 đêm), tổng tiền 1.000.000₫', NULL, '{\"roomId\":1,\"checkIn\":\"2026-08-10\",\"checkOut\":\"2026-08-12\",\"totalPrice\":1000000}', 1000000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 06:05:17'),
(2, 66, 'created', 'Tạo đặt phòng phòng 101 từ 10/08/2026 đến 12/08/2026 (2 đêm), tổng tiền 1.150.000₫', NULL, '{\"roomId\":1,\"checkIn\":\"2026-08-10\",\"checkOut\":\"2026-08-12\",\"totalPrice\":1150000}', 1150000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 06:57:38'),
(3, 66, 'cancelled', 'Hủy đặt phòng. Lý do: aaaaaaaa', '{\"status\":\"confirmed\"}', '{\"status\":\"cancelled\",\"reason\":\"aaaaaaaa\"}', NULL, 7, 'customer4@gmail.com', 'customer', '2026-08-09 07:09:32'),
(4, 67, 'created', 'Tạo đặt phòng phòng 201 từ 11/08/2026 đến 13/08/2026 (2 đêm), tổng tiền 1.700.000₫', NULL, '{\"roomId\":5,\"checkIn\":\"2026-08-11\",\"checkOut\":\"2026-08-13\",\"totalPrice\":1700000}', 1700000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 08:56:28'),
(5, 67, 'cancelled', 'Hủy đặt phòng. Lý do: hhhhhhh', '{\"status\":\"confirmed\"}', '{\"status\":\"cancelled\",\"reason\":\"hhhhhhh\"}', NULL, 1, 'admin@gmail.com', 'admin', '2026-08-09 09:03:38'),
(6, 68, 'created', 'Tạo đặt phòng phòng 201 từ 11/08/2026 đến 13/08/2026 (2 đêm), tổng tiền 1.700.000₫', NULL, '{\"roomId\":5,\"checkIn\":\"2026-08-11\",\"checkOut\":\"2026-08-13\",\"totalPrice\":1700000}', 1700000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 09:04:09'),
(7, 68, 'payment', 'Xác nhận thanh toán ZaloPay 510.000₫ — đã trả 510.000₫, còn lại 1.190.000₫ (mã GD: 260809_68_1786241373421)', NULL, '{\"paidAmount\":510000,\"remainingAmount\":1190000,\"paymentStatus\":\"deposit_paid\",\"transactionCode\":\"260809_68_1786241373421\"}', 510000.00, NULL, NULL, 'system', '2026-08-09 09:10:43'),
(8, 68, 'stay_updated', 'Cập nhật đặt phòng: nhận 11/08/2026 → 12/08/2026, trả 13/08/2026 → 14/08/2026 (tổng tiền phòng tăng 0₫)', '{\"checkIn\":\"2026-08-11\",\"checkOut\":\"2026-08-13\",\"roomId\":5,\"totalPrice\":1400000}', '{\"checkIn\":\"2026-08-12\",\"checkOut\":\"2026-08-14\",\"roomTypeId\":2,\"roomId\":5,\"nights\":2,\"totalPrice\":1400000,\"occupancySurcharge\":0}', 0.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 10:56:14'),
(9, 68, 'stay_updated', 'Cập nhật đặt phòng: trả 14/08/2026 → 15/08/2026 (tổng tiền phòng tăng 700.000₫)', '{\"checkIn\":\"2026-08-12\",\"checkOut\":\"2026-08-14\",\"roomId\":5,\"totalPrice\":1400000}', '{\"checkIn\":\"2026-08-12\",\"checkOut\":\"2026-08-15\",\"roomTypeId\":2,\"roomId\":5,\"nights\":3,\"totalPrice\":2100000,\"occupancySurcharge\":0}', 700000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 10:57:10'),
(10, 68, 'stay_updated', 'Cập nhật đặt phòng: hạng phòng → Standard, phòng 201 → 101 (tổng tiền phòng giảm 600.000₫)', '{\"checkIn\":\"2026-08-12\",\"checkOut\":\"2026-08-15\",\"roomId\":5,\"totalPrice\":2100000}', '{\"checkIn\":\"2026-08-12\",\"checkOut\":\"2026-08-15\",\"roomTypeId\":1,\"roomId\":1,\"nights\":3,\"totalPrice\":1500000,\"occupancySurcharge\":0}', -600000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 10:57:39'),
(11, 68, 'service_added', 'Thêm dịch vụ: Giặt ủi x1 = 100.000₫', NULL, '{\"serviceId\":2,\"serviceName\":\"Giặt ủi\",\"quantity\":1,\"unitPrice\":100000}', 100000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 11:08:47'),
(12, 68, 'service_updated', 'Sửa dịch vụ Spa thư giãn: x1 → x2 (300.000₫ → 600.000₫, tăng 300.000₫)', '{\"quantity\":1,\"totalPrice\":300000,\"serviceName\":\"Spa thư giãn\",\"unitPrice\":300000}', '{\"quantity\":2,\"totalPrice\":600000}', 300000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 11:09:17'),
(13, 68, 'service_added', 'Thêm dịch vụ: Buffet sáng x1 = 150.000₫', NULL, '{\"serviceId\":1,\"serviceName\":\"Buffet sáng\",\"quantity\":1,\"unitPrice\":150000}', 150000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 11:09:32'),
(14, 68, 'stay_updated', 'Cập nhật đặt phòng: nhận 12/08/2026 → 13/08/2026 (tổng tiền phòng giảm 500.000₫)', '{\"checkIn\":\"2026-08-12\",\"checkOut\":\"2026-08-15\",\"roomId\":1,\"totalPrice\":1500000}', '{\"checkIn\":\"2026-08-13\",\"checkOut\":\"2026-08-15\",\"roomTypeId\":1,\"roomId\":1,\"nights\":2,\"totalPrice\":1000000,\"occupancySurcharge\":0}', -500000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 14:20:33'),
(15, 68, 'stay_updated', 'Cập nhật đặt phòng: hạng phòng → Superior, phòng 101 → 201 (tổng tiền phòng tăng 400.000₫)', '{\"checkIn\":\"2026-08-13\",\"checkOut\":\"2026-08-15\",\"roomId\":1,\"totalPrice\":1000000}', '{\"checkIn\":\"2026-08-13\",\"checkOut\":\"2026-08-15\",\"roomTypeId\":2,\"roomId\":5,\"nights\":2,\"totalPrice\":1400000,\"occupancySurcharge\":0}', 400000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 14:20:44'),
(16, 68, 'service_removed', 'Xóa dịch vụ Buffet sáng (x1, được 150.000₫)', '{\"id\":15,\"serviceName\":\"Buffet sáng\",\"quantity\":1,\"unitPrice\":150000,\"totalPrice\":150000}', NULL, -150000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 14:21:10'),
(17, 68, 'service_added', 'Thêm dịch vụ: Buffet tối x1 = 350.000₫', NULL, '{\"serviceId\":6,\"serviceName\":\"Buffet tối\",\"quantity\":1,\"unitPrice\":350000}', 350000.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 14:21:24'),
(18, 68, 'stay_updated', 'Cập nhật đặt phòng: nhận 13/08/2026 → 09/08/2026, trả 15/08/2026 → 11/08/2026 (tổng tiền phòng tăng 0₫)', '{\"checkIn\":\"2026-08-13\",\"checkOut\":\"2026-08-15\",\"roomId\":5,\"totalPrice\":1400000}', '{\"checkIn\":\"2026-08-09\",\"checkOut\":\"2026-08-11\",\"roomTypeId\":2,\"roomId\":5,\"nights\":2,\"totalPrice\":1400000,\"occupancySurcharge\":0}', 0.00, 7, 'customer4@gmail.com', 'customer', '2026-08-09 14:30:45'),
(19, 68, 'checked_in', 'Khách nhận phòng (check-in muộn). Khách lưu trú: Pham Thi D', '{\"status\":\"confirmed\"}', '{\"status\":\"checked_in\",\"lateCheckIn\":true}', NULL, 1, 'admin@gmail.com', 'admin', '2026-08-09 14:35:26'),
(20, 68, 'room_transferred', 'Chuyển phòng từ 201 sang 304 kể từ ngày 09/08/2026. Tổng tiền phòng mới: 1.800.000₫', '{\"roomId\":5,\"roomNumber\":\"201\",\"totalPrice\":1400000}', '{\"roomId\":12,\"roomNumber\":\"304\",\"fromDate\":\"2026-08-09\",\"totalPrice\":1800000}', NULL, 1, 'admin@gmail.com', 'admin', '2026-08-09 14:37:59'),
(21, 68, 'extended', 'Gia hạn ngày ở: trả phòng từ 11/08/2026 chuyển thành 13/08/2026 (+2 đêm, +1.800.000₫)', '{\"checkOut\":\"2026-08-11\",\"totalPrice\":1800000}', '{\"checkOut\":\"2026-08-13\",\"totalPrice\":3600000,\"addedNights\":2,\"addedSurcharge\":0}', 1800000.00, 1, 'admin@gmail.com', 'admin', '2026-08-09 14:38:50');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_nightly_prices`
--

CREATE TABLE `booking_nightly_prices` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `stayDate` date NOT NULL,
  `price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_nightly_prices`
--

INSERT INTO `booking_nightly_prices` (`id`, `bookingId`, `stayDate`, `price`, `createdAt`) VALUES
(1, 65, '2026-08-10', 500000.00, '2026-08-09 06:05:17'),
(2, 65, '2026-08-11', 500000.00, '2026-08-09 06:05:17'),
(3, 66, '2026-08-10', 500000.00, '2026-08-09 06:57:38'),
(4, 66, '2026-08-11', 500000.00, '2026-08-09 06:57:38'),
(5, 67, '2026-08-11', 700000.00, '2026-08-09 08:56:28'),
(6, 67, '2026-08-12', 700000.00, '2026-08-09 08:56:28'),
(21, 68, '2026-08-09', 900000.00, '2026-08-09 14:30:45'),
(22, 68, '2026-08-10', 900000.00, '2026-08-09 14:30:45'),
(25, 68, '2026-08-11', 900000.00, '2026-08-09 14:38:50'),
(26, 68, '2026-08-12', 900000.00, '2026-08-09 14:38:50');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_room_transfers`
--

CREATE TABLE `booking_room_transfers` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `fromRoomId` int(11) NOT NULL,
  `toRoomId` int(11) NOT NULL,
  `fromDate` date NOT NULL,
  `toDate` date NOT NULL,
  `pricePerNight` decimal(15,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_room_transfers`
--

INSERT INTO `booking_room_transfers` (`id`, `bookingId`, `fromRoomId`, `toRoomId`, `fromDate`, `toDate`, `pricePerNight`, `reason`, `createdAt`) VALUES
(1, 68, 5, 12, '2026-08-09', '2026-08-13', 900000.00, NULL, '2026-08-09 14:37:59');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_services`
--

CREATE TABLE `booking_services` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `roomId` int DEFAULT NULL,
  `serviceId` int DEFAULT NULL,
  `unitPrice` decimal(15,2) DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `status` enum('unused','used','cancelled') NOT NULL DEFAULT 'used',
  `usedAt` datetime DEFAULT NULL,
  `totalPrice` decimal(15,2) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_services`
--

INSERT INTO `booking_services` (`id`, `bookingId`, `roomId`, `serviceId`, `unitPrice`, `quantity`, `status`, `usedAt`, `totalPrice`, `createdAt`) VALUES
(1, 1, NULL, 1, 150000.00, 2, 'used', '2026-08-02 11:53:14', 300000.00, '2026-08-02 11:53:14'),
(2, 2, NULL, 2, 100000.00, 1, 'used', '2026-08-02 11:53:14', 100000.00, '2026-08-02 11:53:14'),
(3, 3, NULL, 3, 300000.00, 2, 'used', '2026-08-02 11:53:14', 600000.00, '2026-08-02 11:53:14'),
(4, 4, NULL, 5, 200000.00, 1, 'used', '2026-08-02 11:53:14', 200000.00, '2026-08-02 11:53:14'),
(5, 5, NULL, 7, 400000.00, 1, 'used', '2026-08-02 11:53:14', 400000.00, '2026-08-02 11:53:14'),
(7, 305, NULL, 1, 150000.00, 1, 'used', '2026-08-02 11:53:14', 150000.00, '2026-08-02 11:53:14'),
(8, 305, NULL, 6, 350000.00, 1, 'used', '2026-08-02 11:53:14', 350000.00, '2026-08-02 11:53:14'),
(9, 305, NULL, 2, 100000.00, 1, 'used', '2026-08-02 11:53:14', 100000.00, '2026-08-02 11:53:14'),
(10, 307, NULL, 1, 150000.00, 1, 'used', '2026-08-02 11:53:14', 150000.00, '2026-08-02 11:53:14'),
(11, 307, NULL, 2, 100000.00, 1, 'used', '2026-08-02 11:53:14', 100000.00, '2026-08-02 11:53:14'),
(12, 307, NULL, 3, 300000.00, 1, 'used', '2026-08-02 11:53:14', 300000.00, '2026-08-02 11:53:14'),
(13, 308, NULL, 4, 500000.00, 1, 'used', '2026-08-02 11:53:14', 500000.00, '2026-08-02 11:53:14'),
(14, 308, NULL, 3, 300000.00, 1, 'used', '2026-08-02 11:53:14', 300000.00, '2026-08-02 11:53:14'),
(15, 308, NULL, 2, 100000.00, 1, 'used', '2026-08-02 11:53:14', 100000.00, '2026-08-02 11:53:14');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_service_requests`
--

CREATE TABLE `booking_service_requests` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `bookingDetailId` int DEFAULT NULL,
  `roomId` int DEFAULT NULL,
  `serviceId` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `note` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_service_requests`
--

INSERT INTO `booking_service_requests` (`id`, `bookingId`, `roomId`, `serviceId`, `quantity`, `status`, `note`, `createdAt`) VALUES
(3, 305, NULL, 1, 1, 'confirmed', NULL, '2026-07-30 11:07:56'),
(4, 305, NULL, 6, 1, 'confirmed', NULL, '2026-07-30 11:07:56'),
(5, 307, NULL, 1, 1, 'confirmed', NULL, '2026-08-02 11:39:31'),
(6, 307, NULL, 2, 1, 'confirmed', NULL, '2026-08-02 11:39:31'),
(7, 307, NULL, 3, 1, 'confirmed', NULL, '2026-08-02 11:39:31'),
(8, 308, NULL, 4, 1, 'confirmed', NULL, '2026-08-02 11:40:38'),
(9, 308, NULL, 3, 1, 'confirmed', NULL, '2026-08-02 11:40:38'),
(10, 308, NULL, 2, 1, 'confirmed', NULL, '2026-08-02 11:40:38');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_status_logs`
--

CREATE TABLE `booking_status_logs` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) DEFAULT NULL,
  `changedBy` int(11) DEFAULT NULL,
  `oldStatus` varchar(50) DEFAULT NULL,
  `newStatus` varchar(50) DEFAULT NULL,
  `changedAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_status_logs`
--

INSERT INTO `booking_status_logs` (`id`, `bookingId`, `changedBy`, `oldStatus`, `newStatus`, `changedAt`) VALUES
(1, 1, 1, 'pending', 'confirmed', '2026-06-10 23:26:20'),
(2, 2, 1, 'pending', 'confirmed', '2026-06-10 23:26:20'),
(3, 3, 2, 'checkin', 'checkout', '2026-06-10 23:26:20'),
(4, 4, 2, 'confirmed', 'checkin', '2026-06-10 23:26:20'),
(5, 5, 1, 'pending', 'confirmed', '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Table structure for table `cancellation_policies`
--

CREATE TABLE `cancellation_policies` (
  `id` int NOT NULL,
  `nearTierMaxDays` int NOT NULL DEFAULT '3',
  `nearTierPercent` decimal(5,2) NOT NULL DEFAULT '100.00',
  `midTierMaxDays` int NOT NULL DEFAULT '7',
  `midTierPercent` decimal(5,2) NOT NULL DEFAULT '50.00',
  `farTierPercent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `noShowGraceHours` int NOT NULL DEFAULT '6',
  `noShowVoucherPercent` decimal(5,2) NOT NULL DEFAULT '10.00',
  `hotelCancelRefundPercent` decimal(5,2) NOT NULL DEFAULT '100.00',
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `standardCheckInTime` time NOT NULL DEFAULT '14:00:00',
  `standardCheckOutTime` time NOT NULL DEFAULT '12:00:00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `cancellation_policies`
--

INSERT INTO `cancellation_policies` (`id`, `nearTierMaxDays`, `nearTierPercent`, `midTierMaxDays`, `midTierPercent`, `farTierPercent`, `noShowGraceHours`, `noShowVoucherPercent`, `hotelCancelRefundPercent`, `updatedAt`, `standardCheckInTime`, `standardCheckOutTime`) VALUES
(1, 3, 100.00, 7, 50.00, 0.00, 6, 10.00, 100.00, '2026-08-09 03:15:08', '14:00:00', '12:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `checkout_late_fee_tiers`
--

CREATE TABLE `checkout_late_fee_tiers` (
  `id` int NOT NULL,
  `graceMinutes` int NOT NULL DEFAULT '60',
  `tier1MaxHours` decimal(4,1) NOT NULL DEFAULT '3.0',
  `tier1Percent` decimal(5,2) NOT NULL DEFAULT '30.00',
  `tier2MaxHours` decimal(4,1) NOT NULL DEFAULT '6.0',
  `tier2Percent` decimal(5,2) NOT NULL DEFAULT '50.00',
  `tier3Percent` decimal(5,2) NOT NULL DEFAULT '100.00',
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `standardCheckOutTime` time NOT NULL DEFAULT '12:00:00',
  `standardCheckInTime` time NOT NULL DEFAULT '14:00:00',
  `housekeepingBufferMinutes` int NOT NULL DEFAULT '60',
  `absoluteMaxLateHours` decimal(4,1) NOT NULL DEFAULT '6.0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `checkout_late_fee_tiers`
--

INSERT INTO `checkout_late_fee_tiers` (`id`, `graceMinutes`, `tier1MaxHours`, `tier1Percent`, `tier2MaxHours`, `tier2Percent`, `tier3Percent`, `updatedAt`, `standardCheckOutTime`, `standardCheckInTime`, `housekeepingBufferMinutes`, `absoluteMaxLateHours`) VALUES
(1, 60, 3.0, 30.00, 6.0, 50.00, 100.00, '2026-08-09 04:36:04', '12:00:00', '14:00:00', 60, 6.0);

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL,
  `accountId` int(11) DEFAULT NULL,
  `fullName` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `dateOfBirth` date DEFAULT NULL,
  `citizenId` varchar(50) DEFAULT NULL,
  `nationality` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `customers`
--

INSERT INTO `customers` (`id`, `accountId`, `fullName`, `phone`, `gender`, `dateOfBirth`, `citizenId`, `nationality`, `address`) VALUES
(1, 4, 'Nguyen Van A', '0911111111', 'Male', NULL, NULL, 'Vietnam', 'Ha Noi'),
(2, 5, 'Tran Thi B', '0922222222', 'Female', NULL, NULL, 'Vietnam', 'Hai Phong'),
(3, 6, 'Le Van C', '0933333333', 'Male', NULL, NULL, 'Vietnam', 'Da Nang'),
(4, 7, 'Pham Thi D', '0944444444', 'Female', NULL, NULL, 'Vietnam', 'Hue'),
(5, 8, 'Hoang Van E', '0955555555', 'Male', NULL, NULL, 'Vietnam', 'HCM'),
(6, 1, 'admin@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL),
(7, 12, 'tranphuhuong1802@gmail.com', '0909999999', NULL, NULL, NULL, NULL, NULL),
(8, 13, 'hieumon482@gmail.com', '0349154051', NULL, NULL, NULL, NULL, NULL),
(9, 14, 'minhdz', '01234567890', 'male', '2006-09-30', NULL, 'Việt Nam', 'Ha Noi'),
(10, 15, 'minhdeptry', '0123456789', NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `customer_vouchers`
--

CREATE TABLE `customer_vouchers` (
  `id` int NOT NULL,
  `userId` int NOT NULL,
  `voucherId` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `source` varchar(30) NOT NULL DEFAULT 'no_show',
  `isUsed` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `customer_vouchers`
--

INSERT INTO `customer_vouchers` (`id`, `userId`, `voucherId`, `bookingId`, `source`, `isUsed`, `createdAt`) VALUES
(1, 12, 4, 16, 'no_show', 0, '2026-07-25 14:55:20');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `damage_reports`
--

CREATE TABLE `damage_reports` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) DEFAULT NULL,
  `roomItemId` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `compensationFee` decimal(15,2) DEFAULT NULL,
  `reportDate` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `damage_reports`
--

INSERT INTO `damage_reports` (`id`, `bookingId`, `roomItemId`, `description`, `compensationFee`, `reportDate`) VALUES
(1, 2, 3, 'May say toc bi vo', 300000.00, '2026-06-10 23:26:20'),
(2, 3, 4, 'Mini bar hong', 500000.00, '2026-06-10 23:26:20'),
(3, 5, 10, 'Den ban bi hu', 200000.00, '2026-06-10 23:26:20'),
(5, 2, 4, 'hỏng', 300000.00, '2026-06-26 20:43:24');

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `paymentId` int DEFAULT NULL,
  `invoiceCode` varchar(50) NOT NULL,
  `roomAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `serviceAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `surchargeAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `discountAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `taxAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `totalAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('draft','issued','cancelled') DEFAULT 'issued',
  `invoiceDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `invoices`
--

INSERT INTO `invoices` (`id`, `bookingId`, `paymentId`, `invoiceCode`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `status`, `invoiceDate`, `createdAt`) VALUES
(1, 305, 201, 'HD202607-00001', 3600000.00, 500000.00, 600000.00, 4700000.00, 0.00, 0.00, 4700000.00, 'issued', '2026-07-30 11:12:36', '2026-07-30 11:12:36'),
(2, 307, 203, 'HD202608-00001', 4000000.00, 550000.00, 0.00, 4550000.00, 0.00, 0.00, 4550000.00, 'issued', '2026-08-02 11:40:06', '2026-08-02 11:40:06'),
(3, 308, 204, 'HD202608-00002', 2400000.00, 900000.00, 400000.00, 3700000.00, 0.00, 0.00, 3700000.00, 'issued', '2026-08-02 11:41:02', '2026-08-02 11:41:02'),
(4, 309, 205, 'HD202608-00003', 900000.00, 0.00, 0.00, 900000.00, 0.00, 0.00, 900000.00, 'issued', '2026-08-02 12:34:24', '2026-08-02 12:34:24'),
(5, 311, 207, 'HD202608-00004', 700000.00, 0.00, 0.00, 700000.00, 0.00, 0.00, 700000.00, 'issued', '2026-08-09 11:21:50', '2026-08-09 11:21:50'),
(6, 312, 208, 'HD202608-00005', 700000.00, 0.00, 0.00, 700000.00, 0.00, 0.00, 700000.00, 'issued', '2026-08-09 11:25:12', '2026-08-09 11:25:12'),
(7, 313, 209, 'HD202608-00006', 700000.00, 0.00, 0.00, 700000.00, 0.00, 0.00, 700000.00, 'issued', '2026-08-09 13:29:10', '2026-08-09 13:29:10');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `accountId` int(11) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `isRead` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `notifications`
--

INSERT INTO `notifications` (`id`, `accountId`, `title`, `content`, `isRead`, `createdAt`) VALUES
(1, 1, 'Booking moi', 'Co booking BK001 vua duoc tao', 1, '2026-06-10 23:26:20'),
(2, 2, 'Check-in', 'Khach BK004 da check-in', 0, '2026-06-10 23:26:20'),
(3, 3, 'Thanh toan', 'Don BK003 da thanh toan', 1, '2026-06-10 23:26:20'),
(4, 4, 'Khuyen mai', 'Ban nhan duoc voucher moi', 0, '2026-06-10 23:26:20'),
(5, 5, 'Danh gia', 'Cam on ban da danh gia khach san', 1, '2026-06-10 23:26:20'),
(6, 14, 'Thanh toán dịch vụ phát sinh', 'Dịch vụ Giặt ủi đã được thêm vào đặt phòng #305 với số tiền 100.000 VNĐ. Số tiền còn phải thanh toán là 100.000 VNĐ.', 0, '2026-07-30 11:13:49'),
(7, 14, 'Đánh giá của bạn đã bị ẩn', 'Đánh giá bạn gửi đã bị quản trị viên ẩn khỏi trang công khai. Lý do: Nội dung của khách hàng chứa ngôn từ không phù hợp. Vui lòng đánh giá lại', 0, '2026-07-30 11:30:24'),
(8, 14, 'Đánh giá của bạn đã được hiển thị lại', 'Đánh giá bạn gửi đã được hiển thị công khai trở lại.', 0, '2026-07-30 11:31:32'),
(9, 14, 'Đánh giá của bạn đã bị ẩn', 'Đánh giá bạn gửi đã bị quản trị viên ẩn khỏi trang công khai. Lý do: Nội dung đánh giá của khách hàng chưa ngôn từ không phù hợp. Vui lòng đánh giá lại.', 0, '2026-07-30 11:51:01'),
(10, 14, 'Đánh giá của bạn đã được hiển thị lại', 'Đánh giá bạn gửi đã được hiển thị công khai trở lại.', 0, '2026-07-30 12:02:46'),
(11, 14, 'Đánh giá của bạn đã bị ẩn', 'Đánh giá bạn gửi đã bị quản trị viên ẩn khỏi trang công khai. Lý do: Nội dung vi phạm. Vui lòng đánh giá lại.', 0, '2026-07-30 12:21:01'),
(12, 14, 'Đánh giá của bạn đã được hiển thị lại', 'Đánh giá bạn gửi đã được hiển thị công khai trở lại.', 0, '2026-07-30 12:21:54'),
(13, 14, 'Đánh giá của bạn đã được duyệt', 'Đánh giá bạn gửi đã được duyệt và hiển thị công khai trên trang khách sạn.', 0, '2026-08-02 11:42:38'),
(14, 14, 'Đánh giá của bạn đã được duyệt', 'Đánh giá bạn gửi đã được duyệt và hiển thị công khai trên trang khách sạn.', 0, '2026-08-02 12:36:58');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) DEFAULT NULL,
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
-- Đang đổ dữ liệu cho bảng `payments`
--

INSERT INTO `payments` (`id`, `bookingId`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `discountAmount`, `depositAmount`, `paidAmount`, `remainingAmount`, `totalAmount`, `paymentMethod`, `paymentStatus`, `transactionCode`, `paymentDate`) VALUES
(1, 1, 1000000.00, 0.00, 0.00, 100000.00, 300000.00, 900000.00, 0.00, 900000.00, 'cash', 'paid', 'TXN001', '2026-06-10 10:00:00'),
(2, 2, 1400000.00, 0.00, 0.00, 50000.00, 500000.00, 500000.00, 850000.00, 1350000.00, 'momo', 'deposit_paid', 'TXN002', '2026-06-15 09:00:00'),
(3, 3, 2700000.00, 200000.00, 0.00, 300000.00, 1000000.00, 2600000.00, 0.00, 2600000.00, 'vnpay', 'paid', 'TXN003', '2026-06-20 14:00:00'),
(4, 4, 1200000.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, 700000.00, 1200000.00, 'cash', 'deposit_paid', 'TXN004', '2026-06-22 15:00:00'),
(5, 5, 2000000.00, 0.00, 0.00, 200000.00, 1000000.00, 1800000.00, 0.00, 1800000.00, 'vnpay', 'paid', 'TXN005', '2026-06-25 11:00:00'),
(7, 7, 15500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 15500000.00, 15500000.00, NULL, 'unpaid', NULL, NULL),
(8, 8, 14000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 14000000.00, 14000000.00, NULL, 'unpaid', NULL, NULL),
(9, 9, 3000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3000000.00, 3000000.00, NULL, 'unpaid', NULL, NULL),
(10, 10, 4200000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 4200000.00, 4200000.00, NULL, 'unpaid', NULL, NULL),
(11, 11, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL),
(12, 12, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL),
(13, 13, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL),
(14, 14, 18500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 18500000.00, 18500000.00, NULL, 'unpaid', NULL, NULL),
(16, 16, 16800000.00, 0.00, 0.00, 0.00, 0.00, 5040000.00, 11760000.00, 16800000.00, 'bank_transfer', 'deposit_paid', 'BANK-MRFU2DYU-GY9IXV', '2026-07-11 10:57:06'),
(17, 17, 1000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1000000.00, 1000000.00, 'momo', 'unpaid', 'MOMO-17-1784966282499', NULL),
(18, 18, 1000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1000000.00, 1000000.00, NULL, 'unpaid', NULL, NULL),
(101, 101, 1200000.00, NULL, NULL, NULL, NULL, 1200000.00, 0.00, 1200000.00, 'cash', 'paid', 'TEST101', '2026-07-26 16:42:19'),
(102, 102, 1800000.00, NULL, NULL, NULL, NULL, 1800000.00, 0.00, 1800000.00, 'momo', 'paid', 'TEST102', '2026-07-26 16:42:19'),
(103, 103, 2700000.00, NULL, NULL, NULL, NULL, 2700000.00, 0.00, 2700000.00, 'vnpay', 'paid', 'TEST103', '2026-07-26 16:42:19'),
(104, 201, NULL, NULL, NULL, NULL, NULL, 1500000.00, NULL, NULL, NULL, 'paid', NULL, '2026-07-15 12:00:00'),
(105, 202, NULL, NULL, NULL, NULL, NULL, 2800000.00, NULL, NULL, NULL, 'paid', NULL, '2026-07-18 12:00:00'),
(106, 203, NULL, NULL, NULL, NULL, NULL, 3500000.00, NULL, NULL, NULL, 'paid', NULL, '2026-07-20 12:00:00'),
(107, 204, NULL, NULL, NULL, NULL, NULL, 5000000.00, NULL, NULL, NULL, 'paid', NULL, '2026-07-22 12:00:00'),
(108, 301, NULL, NULL, NULL, NULL, NULL, 3200000.00, NULL, NULL, NULL, 'paid', NULL, '2026-07-20 12:00:00'),
(109, 302, NULL, NULL, NULL, NULL, NULL, 4500000.00, NULL, NULL, NULL, 'paid', NULL, '2026-07-21 12:00:00'),
(110, 303, NULL, NULL, NULL, NULL, NULL, 7000000.00, NULL, NULL, NULL, 'paid', NULL, '2026-07-22 12:00:00'),
(200, 200, 5700000.00, 0.00, 0.00, 0.00, 0.00, 5700000.00, 0.00, 5700000.00, 'cash', 'paid', 'TXN-TEST-200', '2026-07-20 09:05:00'),
(201, 305, 3600000.00, 600000.00, 600000.00, 0.00, 0.00, 4800000.00, 0.00, 4800000.00, 'vnpay', 'refunded', 'VNPAY-201-1785384854621', '2026-07-30 11:14:31'),
(202, 306, 500000.00, 0.00, 400000.00, 0.00, 0.00, 0.00, 900000.00, 900000.00, NULL, 'unpaid', NULL, NULL),
(203, 307, 4000000.00, 550000.00, 0.00, 0.00, 0.00, 0.00, 4550000.00, 4550000.00, 'vnpay', 'refunded', NULL, NULL),
(204, 308, 2400000.00, 900000.00, 400000.00, 0.00, 0.00, 3700000.00, 0.00, 3700000.00, 'vnpay', 'refunded', 'VNPAY-204-1785645641191', '2026-08-02 11:41:03'),
(205, 309, 900000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 900000.00, 'vnpay', 'refunded', NULL, NULL),
(206, 310, 500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, NULL, 'unpaid', NULL, NULL),
(207, 311, 700000.00, 0.00, 0.00, 0.00, 0.00, 700000.00, 0.00, 700000.00, 'vnpay', 'paid', 'VNPAY-207-1786249282023', '2026-08-09 11:21:51'),
(208, 312, 700000.00, 0.00, 0.00, 0.00, 0.00, 700000.00, 0.00, 700000.00, 'vnpay', 'paid', 'VNPAY-208-1786249494102', '2026-08-09 11:25:13'),
(209, 313, 700000.00, 0.00, 0.00, 0.00, 0.00, 700000.00, 0.00, 700000.00, 'vnpay', 'paid', 'VNPAY-209-1786256923492', '2026-08-09 13:29:10');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `payment_confirmation_requests`
--

CREATE TABLE `payment_confirmation_requests` (
  `id` int NOT NULL,
  `paymentId` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `paymentMethod` varchar(50) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `note` text,
  `submittedAt` datetime DEFAULT NULL,
  `confirmedBy` int DEFAULT NULL,
  `confirmedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `payment_confirmation_requests`
--

INSERT INTO `payment_confirmation_requests` (`id`, `paymentId`, `bookingId`, `amount`, `paymentMethod`, `status`, `note`, `submittedAt`, `confirmedBy`, `confirmedAt`) VALUES
(1, 17, 17, 300000.00, 'bank_transfer', 'pending', NULL, '2026-07-25 14:58:53', NULL, NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `payment_refunds`
--

CREATE TABLE `payment_refunds` (
  `id` int(11) NOT NULL,
  `paymentId` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `refundRate` decimal(4,2) NOT NULL DEFAULT 0.00,
  `paidAmount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `refundMethod` enum('cash','bank_transfer') NOT NULL DEFAULT 'bank_transfer',
  `bankBin` varchar(10) DEFAULT NULL,
  `bankName` varchar(100) DEFAULT NULL,
  `accountNumber` varchar(30) DEFAULT NULL,
  `accountName` varchar(100) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `note` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `processedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `payment_refunds`
--

INSERT INTO `payment_refunds` (`id`, `paymentId`, `bookingId`, `amount`, `refundRate`, `paidAmount`, `refundMethod`, `bankBin`, `bankName`, `accountNumber`, `accountName`, `status`, `note`, `createdAt`, `processedAt`) VALUES
(1, 201, 305, 1800000.00, 0.50, 4800000.00, 'cash', NULL, NULL, NULL, NULL, 'approved', NULL, '2026-07-30 11:15:01', '2026-07-30 11:15:13'),
(2, 204, 308, 1200000.00, 0.50, 3700000.00, 'cash', NULL, NULL, NULL, NULL, 'approved', NULL, '2026-08-02 11:41:20', '2026-08-02 11:41:28'),
(3, 205, 309, 450000.00, 0.50, 900000.00, 'cash', NULL, NULL, NULL, NULL, 'approved', NULL, '2026-08-02 12:35:06', '2026-08-02 12:35:35');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `payment_status_logs`
--

CREATE TABLE `payment_status_logs` (
  `id` int(11) NOT NULL,
  `paymentId` int(11) DEFAULT NULL,
  `changedBy` int(11) DEFAULT NULL,
  `oldStatus` varchar(50) DEFAULT NULL,
  `newStatus` varchar(50) DEFAULT NULL,
  `changedAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `payment_status_logs`
--

INSERT INTO `payment_status_logs` (`id`, `paymentId`, `changedBy`, `oldStatus`, `newStatus`, `changedAt`) VALUES
(1, 1, 1, 'unpaid', 'paid', '2026-06-10 23:26:20'),
(2, 2, 1, 'unpaid', 'unpaid', '2026-06-10 23:26:20'),
(3, 3, 2, 'unpaid', 'paid', '2026-06-10 23:26:20'),
(4, 4, 2, 'unpaid', 'unpaid', '2026-06-10 23:26:20'),
(5, 5, 1, 'unpaid', 'paid', '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `reviews`
--

CREATE TABLE `reviews` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `customerId` int DEFAULT NULL,
  `rating` int DEFAULT NULL,
  `comment` text,
  `status` varchar(20) NOT NULL DEFAULT 'approved',
  `images` json DEFAULT NULL,
  `adminReply` text,
  `repliedAt` datetime DEFAULT NULL,
  `hideReason` varchar(500) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `reviews`
--

INSERT INTO `reviews` (`id`, `bookingId`, `customerId`, `rating`, `comment`, `status`, `images`, `adminReply`, `repliedAt`, `hideReason`, `createdAt`) VALUES
(1, 1, 1, 5, 'Phong sach se, nhan vien than thien', 'approved', NULL, NULL, NULL, NULL, '2026-06-10 23:26:20'),
(2, 2, 2, 4, 'Phong dep, do an ngon', 'approved', NULL, NULL, NULL, NULL, '2026-06-10 23:26:20'),
(3, 3, 3, 5, 'Rat hai long voi dich vu', 'approved', NULL, NULL, NULL, NULL, '2026-06-10 23:26:20'),
(4, 4, 4, 4, 'Gia hop ly', 'approved', NULL, NULL, NULL, NULL, '2026-06-10 23:26:20'),
(5, 5, 5, 5, 'Se quay lai lan sau', 'approved', NULL, NULL, NULL, NULL, '2026-06-10 23:26:20'),
(6, 304, 9, 4, 'Phòng khá là sạch sẽ, còn quay lại nếu có dịp.', 'approved', NULL, NULL, NULL, NULL, '2026-07-27 08:47:43'),
(7, 305, 9, 5, 'Phòng khá sạch sẽ, nhân viên nhiệt tình, sẽ còn quay lại sau.', 'approved', '[\"http://localhost:3001/uploads/reviews/review_1785648799477_414689886.webp\"]', NULL, NULL, NULL, '2026-07-30 11:15:57'),
(8, 308, 9, 5, 'Phòng khá đẹp, thoáng mát', 'approved', '[\"http://localhost:3001/uploads/reviews/review_1785648616708_862438236.jpeg\", \"http://localhost:3001/uploads/reviews/review_1785648660271_325599707.jpg\"]', NULL, NULL, NULL, '2026-08-02 11:42:21'),
(9, 309, 9, 5, 'ok', 'approved', '[\"http://localhost:3001/uploads/reviews/review_1785649647008_529158045.jpeg\"]', NULL, NULL, NULL, '2026-08-02 12:36:39');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `rooms`
--

CREATE TABLE `rooms` (
  `id` int(11) NOT NULL,
  `roomTypeId` int(11) DEFAULT NULL,
  `roomNumber` varchar(50) DEFAULT NULL,
  `floor` int(11) DEFAULT NULL,
  `area` decimal(10,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `isDeleted` tinyint(1) NOT NULL DEFAULT '0',
  `maintenanceNote` text,
  `maintenanceExpectedCompletion` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `rooms`
--

INSERT INTO `rooms` (`id`, `roomTypeId`, `roomNumber`, `floor`, `area`, `status`, `isDeleted`, `maintenanceNote`, `maintenanceExpectedCompletion`) VALUES
(1, 1, '101', 1, 25.00, 'available', 0, NULL, NULL),
(2, 1, '102', 1, 25.00, 'available', 0, NULL, NULL),
(3, 1, '103', 1, 25.00, 'available', 0, NULL, NULL),
(4, 1, '104', 1, 25.00, 'available', 0, NULL, NULL),
(5, 2, '201', 2, 30.00, 'available', 0, NULL, NULL),
(6, 2, '202', 2, 30.00, 'available', 0, NULL, NULL),
(7, 2, '203', 2, 30.00, 'available', 0, NULL, NULL),
(8, 2, '204', 2, 30.00, 'available', 0, NULL, NULL),
(9, 3, '301', 3, 35.00, 'available', 0, NULL, NULL),
(10, 3, '302', 3, 35.00, 'available', 0, NULL, NULL),
(11, 3, '303', 3, 35.00, 'available', 0, NULL, NULL),
(12, 3, '304', 3, 35.00, 'available', 0, NULL, NULL),
(13, 4, '401', 4, 45.00, 'available', 0, NULL, NULL),
(14, 4, '402', 4, 45.00, 'available', 0, NULL, NULL),
(15, 4, '403', 4, 45.00, 'available', 0, NULL, NULL),
(16, 4, '404', 4, 45.00, 'available', 0, NULL, NULL),
(17, 5, '501', 5, 60.00, 'available', 0, NULL, NULL),
(18, 5, '502', 5, 60.00, 'available', 0, NULL, NULL),
(19, 5, '503', 5, 60.00, 'available', 0, NULL, NULL),
(20, 5, '504', 5, 60.00, 'available', 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `room_images`
--

CREATE TABLE `room_images` (
  `id` int(11) NOT NULL,
  `roomTypeId` int(11) DEFAULT NULL,
  `imageUrl` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `room_images`
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
-- Cấu trúc bảng cho bảng `room_items`
--

CREATE TABLE `room_items` (
  `id` int(11) NOT NULL,
  `roomId` int(11) DEFAULT NULL,
  `itemName` varchar(255) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `room_items`
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
-- Cấu trúc bảng cho bảng `room_prices`
--

CREATE TABLE `room_prices` (
  `id` int(11) NOT NULL,
  `roomTypeId` int(11) DEFAULT NULL,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `price` decimal(15,2) DEFAULT NULL,
  `priceType` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `room_prices`
--

INSERT INTO `room_prices` (`id`, `roomTypeId`, `startDate`, `endDate`, `price`, `priceType`) VALUES
(1, 1, '2026-01-01', '2026-12-31', 500000.00, 'normal'),
(2, 2, '2026-01-01', '2026-12-31', 700000.00, 'normal'),
(3, 3, '2026-01-01', '2026-12-31', 900000.00, 'normal'),
(4, 4, '2026-01-01', '2026-12-31', 1200000.00, 'normal'),
(5, 5, '2026-01-01', '2026-12-31', 2000000.00, 'normal');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `room_types`
--

CREATE TABLE `room_types` (
  `id` int(11) NOT NULL,
  `typeName` varchar(255) DEFAULT NULL,
  `description` text,
  `capacity` int DEFAULT NULL,
  `adultCapacity` int NOT NULL DEFAULT '2',
  `childCapacity` int NOT NULL DEFAULT '1',
  `maxOccupancy` int NOT NULL DEFAULT '3',
  `extraAdultFee` decimal(15,2) NOT NULL DEFAULT '200000.00',
  `extraChildFee` decimal(15,2) NOT NULL DEFAULT '100000.00',
  `defaultPrice` decimal(15,2) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `isDeleted` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `room_types`
--

INSERT INTO `room_types` (`id`, `typeName`, `description`, `capacity`, `adultCapacity`, `childCapacity`, `maxOccupancy`, `extraAdultFee`, `extraChildFee`, `defaultPrice`, `status`, `isDeleted`) VALUES
(1, 'Standard', 'Phong tieu chuan', 2, 2, 0, 3, 200000.00, 100000.00, 500000.00, 'active', 0),
(2, 'Superior', 'Phong superior', 2, 2, 1, 4, 200000.00, 100000.00, 700000.00, 'active', 0),
(3, 'Deluxe', 'Phong deluxe', 3, 2, 1, 4, 250000.00, 120000.00, 900000.00, 'active', 0),
(4, 'Family', 'Phong gia dinh', 4, 2, 2, 5, 300000.00, 150000.00, 1200000.00, 'active', 0),
(5, 'Suite', 'Phong tong thong', 4, 2, 2, 5, 400000.00, 200000.00, 2000000.00, 'active', 0);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `room_type_amenities`
--

CREATE TABLE `room_type_amenities` (
  `id` int(11) NOT NULL,
  `roomTypeId` int(11) DEFAULT NULL,
  `amenityId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `room_type_amenities`
--

INSERT INTO `room_type_amenities` (`id`, `roomTypeId`, `amenityId`) VALUES
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
(27, 5, 10),
(28, 1, 1),
(29, 1, 2),
(30, 1, 3);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `services`
--

CREATE TABLE `services` (
  `id` int(11) NOT NULL,
  `serviceName` varchar(255) DEFAULT NULL,
  `price` decimal(15,2) DEFAULT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `services`
--

INSERT INTO `services` (`id`, `serviceName`, `price`, `description`) VALUES
(1, 'Buffet sáng', 150000.00, 'Buffet sáng phục vụ từ 06:30 đến 10:00.'),
(2, 'Giặt ủi', 100000.00, 'Dịch vụ giặt và ủi quần áo.'),
(3, 'Spa thư giãn', 300000.00, 'Dịch vụ chăm sóc và thư giãn tại spa.'),
(4, 'Đưa đón sân bay', 500000.00, 'Xe đưa đón giữa khách sạn và sân bay.'),
(5, 'Phục vụ tại phòng', 200000.00, 'Phục vụ đồ ăn và thức uống tại phòng.'),
(6, 'Buffet tối', 350000.00, 'Buffet tối phục vụ từ 18:00 đến 21:30.'),
(7, 'Massage', 400000.00, 'Dịch vụ massage thư giãn.'),
(8, 'Thuê xe đạp', 100000.00, 'Thuê xe đạp sử dụng trong ngày.'),
(9, 'Đồ uống minibar', 120000.00, 'Đồ ăn nhẹ và nước uống trong minibar.'),
(10, 'Kê thêm giường', 250000.00, 'Tối đa 1 giường phụ mỗi phòng; đăng ký trước 18:00 ngày nhận phòng.'),
(13, 'sấy quần áo', 500000.00, 'Sấy nhanh trong 24H'),
(14, 'giặt quần áo nhanh', 300000.00, NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `vouchers`
--

CREATE TABLE `vouchers` (
  `id` int(11) NOT NULL,
  `code` varchar(100) DEFAULT NULL,
  `discountType` varchar(50) DEFAULT NULL,
  `discountValue` decimal(15,2) DEFAULT NULL,
  `maxDiscount` decimal(15,2) DEFAULT NULL,
  `minBookingAmount` decimal(15,2) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `vouchers`
--

INSERT INTO `vouchers` (`id`, `code`, `discountType`, `discountValue`, `maxDiscount`, `minBookingAmount`, `quantity`, `startDate`, `endDate`, `status`) VALUES
(1, 'SUMMER10', 'percentage', 10.00, 300000.00, 500000.00, 100, '2026-01-01', '2026-12-31', 'active'),
(2, 'WELCOME50', 'fixed', 50000.00, 50000.00, 300000.00, 200, '2026-01-01', '2026-12-31', 'active'),
(3, 'VIP20', 'percentage', 20.00, 500000.00, 1000000.00, 50, '2026-01-01', '2026-12-31', 'active'),
(4, 'NOSHOW16FKQO16', 'percentage', 10.00, NULL, NULL, 1, '2026-07-25', '2026-10-23', 'active');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `wallet_transactions`
--

CREATE TABLE `wallet_transactions` (
  `id` int(11) NOT NULL,
  `customerId` int(11) NOT NULL,
  `refundId` int(11) DEFAULT NULL,
  `bookingId` int(11) DEFAULT NULL,
  `type` enum('refund_credit','withdrawal') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  `refundMethod` enum('cash','bank_transfer') DEFAULT NULL,
  `bankBin` varchar(10) DEFAULT NULL,
  `bankName` varchar(100) DEFAULT NULL,
  `accountNumber` varchar(30) DEFAULT NULL,
  `accountName` varchar(100) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `processedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `wallet_transactions`
--

INSERT INTO `wallet_transactions` (`id`, `customerId`, `refundId`, `bookingId`, `type`, `amount`, `status`, `refundMethod`, `bankBin`, `bankName`, `accountNumber`, `accountName`, `note`, `createdAt`, `processedAt`) VALUES
(1, 8, 2, 27, 'refund_credit', 24000000.00, 'approved', NULL, NULL, NULL, NULL, NULL, 'Hoàn tiền hủy đặt phòng #27', '2026-07-11 14:44:54', '2026-07-11 14:44:54'),
(2, 8, 4, 59, 'refund_credit', 450000.00, 'approved', NULL, NULL, NULL, NULL, NULL, 'Hoàn tiền hủy đặt phòng #59', '2026-07-29 20:38:56', '2026-07-29 20:38:56'),
(3, 8, NULL, NULL, 'withdrawal', 24450000.00, 'approved', 'bank_transfer', '970422', 'MB Bank', '0393166495', 'ĐỖ HỮU HOAN', NULL, '2026-07-29 20:40:20', '2026-07-29 20:40:33');

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Chỉ mục cho bảng `amenities`
--
ALTER TABLE `amenities`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `app_settings`
--
ALTER TABLE `app_settings`
  ADD PRIMARY KEY (`settingKey`);

--
-- Chỉ mục cho bảng `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `bookingCode` (`bookingCode`),
  ADD KEY `customerId` (`customerId`),
  ADD KEY `voucherId` (`voucherId`),
  ADD KEY `idx_bookings_created_at` (`created_at`),
  ADD KEY `idx_bookings_status` (`status`),
  ADD KEY `idx_bookings_booking_status` (`bookingStatus`),
  ADD KEY `idx_bookings_room_id` (`room_id`);

--
-- Chỉ mục cho bảng `booking_damage_charges`
--
ALTER TABLE `booking_damage_charges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomId` (`roomId`);

--
-- Chỉ mục cho bảng `booking_details`
--
ALTER TABLE `booking_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomId` (`roomId`),
  ADD KEY `idx_booking_details_booking_id` (`bookingId`),
  ADD KEY `idx_booking_details_room_id` (`roomId`),
  ADD KEY `idx_booking_details_checkin` (`checkInDate`),
  ADD KEY `idx_booking_details_checkout` (`checkOutDate`);

--
-- Chỉ mục cho bảng `booking_guests`
--
ALTER TABLE `booking_guests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`);

--
-- Chỉ mục cho bảng `booking_history`
--
ALTER TABLE `booking_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_booking_history_booking` (`bookingId`);

--
-- Chỉ mục cho bảng `booking_nightly_prices`
--
ALTER TABLE `booking_nightly_prices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_booking_night` (`bookingId`,`stayDate`);

--
-- Chỉ mục cho bảng `booking_room_transfers`
--
ALTER TABLE `booking_room_transfers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `fromRoomId` (`fromRoomId`),
  ADD KEY `toRoomId` (`toRoomId`);

--
-- Chỉ mục cho bảng `booking_services`
--
ALTER TABLE `booking_services`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `serviceId` (`serviceId`);

--
-- Chỉ mục cho bảng `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `serviceId` (`serviceId`);

--
-- Chỉ mục cho bảng `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `changedBy` (`changedBy`);

--
-- Chỉ mục cho bảng `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `accountId` (`accountId`);

--
-- Chỉ mục cho bảng `customer_vouchers`
--
ALTER TABLE `customer_vouchers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `voucherId` (`voucherId`),
  ADD KEY `bookingId` (`bookingId`);

--
-- Chỉ mục cho bảng `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomItemId` (`roomItemId`);

--
-- Chỉ mục cho bảng `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoiceCode` (`invoiceCode`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `paymentId` (`paymentId`);

--
-- Chỉ mục cho bảng `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `accountId` (`accountId`);

--
-- Chỉ mục cho bảng `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `idx_payments_booking_id` (`bookingId`),
  ADD KEY `idx_payments_status` (`paymentStatus`),
  ADD KEY `idx_payments_payment_date` (`paymentDate`);

--
-- Chỉ mục cho bảng `payment_confirmation_requests`
--
ALTER TABLE `payment_confirmation_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `paymentId` (`paymentId`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `confirmedBy` (`confirmedBy`);

--
-- Chỉ mục cho bảng `payment_refunds`
--
ALTER TABLE `payment_refunds`
  ADD PRIMARY KEY (`id`),
  ADD KEY `paymentId` (`paymentId`),
  ADD KEY `bookingId` (`bookingId`);

--
-- Chỉ mục cho bảng `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `paymentId` (`paymentId`),
  ADD KEY `changedBy` (`changedBy`);

--
-- Chỉ mục cho bảng `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `customerId` (`customerId`),
  ADD KEY `idx_reviews_status` (`status`),
  ADD KEY `idx_reviews_rating` (`rating`);

--
-- Chỉ mục cho bảng `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`),
  ADD KEY `idx_rooms_room_type_id` (`roomTypeId`),
  ADD KEY `idx_rooms_is_deleted_status` (`isDeleted`,`status`);

--
-- Chỉ mục cho bảng `room_images`
--
ALTER TABLE `room_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`);

--
-- Chỉ mục cho bảng `room_items`
--
ALTER TABLE `room_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomId` (`roomId`);

--
-- Chỉ mục cho bảng `room_prices`
--
ALTER TABLE `room_prices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`);

--
-- Chỉ mục cho bảng `room_types`
--
ALTER TABLE `room_types`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`),
  ADD KEY `amenityId` (`amenityId`);

--
-- Chỉ mục cho bảng `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `vouchers`
--
ALTER TABLE `vouchers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Chỉ mục cho bảng `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customerId` (`customerId`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT cho bảng `amenities`
--
ALTER TABLE `amenities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT cho bảng `booking_damage_charges`
--
ALTER TABLE `booking_damage_charges`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT cho bảng `booking_details`
--
ALTER TABLE `booking_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT cho bảng `booking_guests`
--
ALTER TABLE `booking_guests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `booking_history`
--
ALTER TABLE `booking_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT cho bảng `booking_nightly_prices`
--
ALTER TABLE `booking_nightly_prices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT cho bảng `booking_room_transfers`
--
ALTER TABLE `booking_room_transfers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT cho bảng `booking_services`
--
ALTER TABLE `booking_services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT cho bảng `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT cho bảng `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT cho bảng `customer_vouchers`
--
ALTER TABLE `customer_vouchers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT cho bảng `damage_reports`
--
ALTER TABLE `damage_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT cho bảng `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT cho bảng `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT cho bảng `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT cho bảng `payment_confirmation_requests`
--
ALTER TABLE `payment_confirmation_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT cho bảng `payment_refunds`
--
ALTER TABLE `payment_refunds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT cho bảng `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT cho bảng `room_images`
--
ALTER TABLE `room_images`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `room_items`
--
ALTER TABLE `room_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `room_prices`
--
ALTER TABLE `room_prices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `room_types`
--
ALTER TABLE `room_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT cho bảng `services`
--
ALTER TABLE `services`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `vouchers`
--
ALTER TABLE `vouchers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT cho bảng `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Các ràng buộc cho các bảng đã đổ
--

--
-- Các ràng buộc cho bảng `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`voucherId`) REFERENCES `vouchers` (`id`);

--
-- Các ràng buộc cho bảng `booking_damage_charges`
--
ALTER TABLE `booking_damage_charges`
  ADD CONSTRAINT `booking_damage_charges_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_damage_charges_ibfk_2` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `booking_details`
--
ALTER TABLE `booking_details`
  ADD CONSTRAINT `booking_details_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_details_ibfk_2` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`);

--
-- Các ràng buộc cho bảng `booking_guests`
--
ALTER TABLE `booking_guests`
  ADD CONSTRAINT `booking_guests_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `booking_history`
--
ALTER TABLE `booking_history`
  ADD CONSTRAINT `booking_history_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `booking_nightly_prices`
--
ALTER TABLE `booking_nightly_prices`
  ADD CONSTRAINT `booking_nightly_prices_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `booking_room_transfers`
--
ALTER TABLE `booking_room_transfers`
  ADD CONSTRAINT `booking_room_transfers_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_room_transfers_ibfk_2` FOREIGN KEY (`fromRoomId`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_room_transfers_ibfk_3` FOREIGN KEY (`toRoomId`) REFERENCES `rooms` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `booking_services`
--
ALTER TABLE `booking_services`
  ADD CONSTRAINT `booking_services_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_services_ibfk_2` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`),
  ADD CONSTRAINT `booking_services_ibfk_3` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`) ON DELETE SET NULL;

--
-- Các ràng buộc cho bảng `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  ADD CONSTRAINT `booking_service_requests_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_service_requests_ibfk_2` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_service_requests_ibfk_3` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_booking_service_requests_detail` FOREIGN KEY (`bookingDetailId`) REFERENCES `booking_details` (`id`) ON DELETE SET NULL;

--
-- Các ràng buộc cho bảng `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  ADD CONSTRAINT `booking_status_logs_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_status_logs_ibfk_2` FOREIGN KEY (`changedBy`) REFERENCES `accounts` (`id`);

--
-- Các ràng buộc cho bảng `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Các ràng buộc cho bảng `customer_vouchers`
--
ALTER TABLE `customer_vouchers`
  ADD CONSTRAINT `customer_vouchers_ibfk_1` FOREIGN KEY (`voucherId`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `customer_vouchers_ibfk_2` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE SET NULL;

--
-- Các ràng buộc cho bảng `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD CONSTRAINT `damage_reports_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `damage_reports_ibfk_2` FOREIGN KEY (`roomItemId`) REFERENCES `room_items` (`id`);

--
-- Các ràng buộc cho bảng `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE SET NULL;

--
-- Các ràng buộc cho bảng `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Các ràng buộc cho bảng `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`);

--
-- Các ràng buộc cho bảng `payment_confirmation_requests`
--
ALTER TABLE `payment_confirmation_requests`
  ADD CONSTRAINT `payment_confirmation_requests_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_confirmation_requests_ibfk_2` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_confirmation_requests_ibfk_3` FOREIGN KEY (`confirmedBy`) REFERENCES `accounts` (`id`);

--
-- Các ràng buộc cho bảng `payment_refunds`
--
ALTER TABLE `payment_refunds`
  ADD CONSTRAINT `payment_refunds_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_refunds_ibfk_2` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;

--
-- Các ràng buộc cho bảng `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  ADD CONSTRAINT `payment_status_logs_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`),
  ADD CONSTRAINT `payment_status_logs_ibfk_2` FOREIGN KEY (`changedBy`) REFERENCES `accounts` (`id`);

--
-- Các ràng buộc cho bảng `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`);

--
-- Các ràng buộc cho bảng `rooms`
--
ALTER TABLE `rooms`
  ADD CONSTRAINT `rooms_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Các ràng buộc cho bảng `room_images`
--
ALTER TABLE `room_images`
  ADD CONSTRAINT `room_images_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Các ràng buộc cho bảng `room_items`
--
ALTER TABLE `room_items`
  ADD CONSTRAINT `room_items_ibfk_1` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`);

--
-- Các ràng buộc cho bảng `room_prices`
--
ALTER TABLE `room_prices`
  ADD CONSTRAINT `room_prices_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Các ràng buộc cho bảng `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  ADD CONSTRAINT `room_type_amenities_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`),
  ADD CONSTRAINT `room_type_amenities_ibfk_2` FOREIGN KEY (`amenityId`) REFERENCES `amenities` (`id`);

--
-- Các ràng buộc cho bảng `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD CONSTRAINT `wallet_transactions_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
