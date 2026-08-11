-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Máy chủ: localhost
-- Thời gian đã tạo: Th8 09, 2026 lúc 09:41 AM
-- Phiên bản máy phục vụ: 10.4.28-MariaDB
-- Phiên bản PHP: 8.0.28

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
(1, 'admin@gmail.com', 'admin@gmail.com', NULL, '$2b$10$1jfGOmV9ikAYp6vVL7uCoefl9Urs.DhlIYICVJtp/hHa0YeqO93Ze', 'admin', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:01'),
(2, 'staff1@gmail.com', 'staff1@gmail.com', NULL, '$2b$10$iXB6ZTCzJ3.k5IiE3OxNiuOWmW9c4alZ/nDCEaOAXatZPUi6HOK86', 'staff', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:01'),
(3, 'staff2@gmail.com', 'staff2@gmail.com', NULL, '$2b$10$0ij3KuGi14Lmh700cYM8H.Jn0hBFHXwvfX/PwWu.B4Xj4zOTNLWjG', 'staff', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:01'),
(4, 'customer1@gmail.com', 'customer1@gmail.com', NULL, '$2b$10$OBaY79tMTBFolw6XxdE2nOWivoz7hJFTxO.ZkIQEjCVPu5j88dK7y', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:02'),
(5, 'customer2@gmail.com', 'customer2@gmail.com', NULL, '$2b$10$QxKOk3xYjA8QX3gSQ/oP2.kV5Gh.mJrvRXx6moxgMj8zOOY/819R2', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:02'),
(6, 'customer3@gmail.com', 'customer3@gmail.com', NULL, '$2b$10$C8TX8487/N1USICDtChAi.yWQKXSMZcfW0jWBSd/q.gTaJFlmi17e', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:02'),
(7, 'customer4@gmail.com', 'customer4@gmail.com', NULL, '$2b$10$zkjm19K6LZav2t6lE1BrJu/FBPsGNo0W/fi4kX2wu6o9IF6srQdaO', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:02'),
(8, 'customer5@gmail.com', 'customer5@gmail.com', NULL, '$2b$10$dNvFk4.Denkyc6X6Yn32keTv11aYxZZkgTT4TENwEYBeXTGQuF/Pe', 'customer', 'active', '2026-06-10 23:22:28', '2026-06-21 12:20:02', '2026-08-08 20:23:02'),
(9, 'Test User', 'test1782044410483@example.com', '0123456789', '$2b$10$DGcENCfuAhZq16hTNUwtAu5U0R/xoQI/VJeJ087ZF3qGXzXjCv8GO', 'customer', 'active', '2026-06-21 19:20:10', '2026-06-21 12:20:10', '2026-06-21 12:20:33'),
(10, 'Test User', 'test1782044433890@example.com', '0123456789', '$2b$10$6HKWHAVun.rlLZ6UZ/L8K.cA92DipGSbAUyrhsZ13qOV1Ctd2nhfy', 'customer', 'active', '2026-06-21 19:20:33', '2026-06-21 12:20:33', '2026-06-21 12:20:33'),
(11, 'API Test User', 'api-test-1782044456618@example.com', '0900000000', '$2b$10$W1b50nB6U8CHegYAPWLgQO5KMxf61.rELk84ktJgz33GlFFrHChk6', 'customer', 'active', '2026-06-21 19:20:57', '2026-06-21 12:20:57', '2026-06-21 12:20:57'),
(12, 'Hương Trần', 'tranphuhuong1802@gmail.com', '0909999999', '$2b$10$mll3uj3dRFr6ohp6/jEOCuy9ZGKWifeve6lqABrYYMrSBXbGIZTna', 'customer', 'active', '2026-06-21 19:22:34', '2026-06-21 12:22:34', '2026-06-21 12:22:34'),
(13, NULL, 'quyhoanfk123@gmail.com', '0393166495', '$2b$10$aX3i4EsWE/HiNNhuc9HusuBqZuPfEHQA0w4D7RKRcIicchpf1gyxa', 'customer', 'active', '2026-06-24 20:54:22', '2026-06-24 13:54:22', '2026-06-24 13:54:22'),
(14, NULL, 'dohoan170706@gmail.com', '0393166495', '$2b$10$0c7aSk9mwPXr.VSw1W9niezVqOxedQpSA5HndYJ.2ULtf3k9XVpce', 'customer', 'active', '2026-07-02 22:47:28', '2026-07-02 15:47:28', '2026-07-02 15:47:28');

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
  `total_price` decimal(15,2) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `cancellation_reason` text DEFAULT NULL,
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

INSERT INTO `bookings` (`id`, `user_id`, `room_id`, `check_in`, `check_out`, `total_price`, `status`, `notes`, `cancellation_reason`, `guest_name`, `guest_email`, `guest_phone`, `customerId`, `voucherId`, `bookingCode`, `bookingStatus`, `totalAmount`, `createdAt`, `created_at`) VALUES
(1, NULL, NULL, NULL, NULL, 900000.00, 'pending', NULL, NULL, NULL, NULL, NULL, 1, 1, 'BK001', 'confirmed', 900000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(2, NULL, NULL, NULL, NULL, 1350000.00, 'cancelled', NULL, NULL, NULL, NULL, NULL, 2, 2, 'BK002', 'cancelled', 1350000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(3, NULL, NULL, NULL, NULL, 2600000.00, 'pending', NULL, NULL, NULL, NULL, NULL, 3, 3, 'BK003', 'checkout', 2600000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(4, NULL, NULL, NULL, NULL, 1200000.00, 'cancelled', NULL, NULL, NULL, NULL, NULL, 4, NULL, 'BK004', 'cancelled', 1200000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(5, NULL, NULL, NULL, NULL, 1800000.00, 'pending', NULL, NULL, NULL, NULL, NULL, 5, 1, 'BK005', 'confirmed', 1800000.00, '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(7, 12, 1, '2026-06-24', '2026-07-25', 15500000.00, 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'confirmed', 15500000.00, '2026-06-24 01:37:20', '2026-06-23 18:37:20'),
(8, 12, 3, '2026-06-24', '2026-07-22', 14000000.00, 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'confirmed', 14000000.00, '2026-06-24 01:47:03', '2026-06-23 18:47:03'),
(9, 12, 2, '2026-06-25', '2026-07-01', 3000000.00, 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3000000.00, '2026-06-24 01:52:06', '2026-06-23 18:52:06'),
(10, 12, 8, '2026-06-25', '2026-07-01', 4200000.00, 'cancelled', NULL, NULL, 'Minh Tài', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 4200000.00, '2026-06-24 02:05:29', '2026-06-23 19:05:29'),
(11, 12, 2, '2026-06-24', '2026-07-01', 3500000.00, 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 02:33:25', '2026-06-23 19:33:25'),
(12, 12, 1, '2026-06-24', '2026-07-01', 3500000.00, 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 07:28:47', '2026-06-24 00:28:47'),
(13, 12, 1, '2026-06-24', '2026-07-01', 3500000.00, 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', 3500000.00, '2026-06-24 14:52:37', '2026-06-24 07:52:37'),
(14, 13, 1, '2026-06-26', '2026-07-24', 14000000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'confirmed', 14000000.00, '2026-06-24 20:57:08', '2026-06-24 13:57:08'),
(15, 13, 1, '2026-06-24', '2026-07-24', 15000000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 15000000.00, '2026-06-24 21:07:36', '2026-06-24 14:07:36'),
(16, 13, 4, '2026-06-26', '2026-07-24', 14000000.00, 'cancelled', NULL, NULL, 'ok', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 14000000.00, '2026-06-24 21:38:57', '2026-06-24 14:38:57'),
(17, 13, 5, '2026-06-25', '2026-07-22', 18900000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 18900000.00, '2026-06-24 22:17:09', '2026-06-24 15:17:09'),
(18, 13, 1, '2026-06-27', '2026-07-30', 16500000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 16500000.00, '2026-06-25 20:34:12', '2026-06-25 13:34:12'),
(19, 13, 2, '2026-07-30', '2026-07-31', 500000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 500000.00, '2026-06-25 20:55:04', '2026-06-25 13:55:04'),
(20, 13, 7, '2026-06-29', '2026-07-23', 16800000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 16800000.00, '2026-06-25 21:16:38', '2026-06-25 14:16:38'),
(21, 13, 6, '2026-07-29', '2026-08-28', 21000000.00, 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 21000000.00, '2026-07-02 19:28:35', '2026-07-02 12:28:35'),
(22, 13, 1, '2026-07-16', '2026-08-13', 14000000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 14000000.00, '2026-07-02 19:50:12', '2026-07-02 12:50:12'),
(23, 13, 1, '2026-07-17', '2026-08-13', 13500000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 13500000.00, '2026-07-02 22:13:59', '2026-07-02 15:13:59'),
(24, 13, 1, '2026-07-02', '2026-07-03', 500000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 500000.00, '2026-07-02 22:17:02', '2026-07-02 15:17:02'),
(25, 13, 9, '2026-07-23', '2026-08-20', 25200000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 25200000.00, '2026-07-11 13:40:46', '2026-07-11 06:40:46'),
(26, 13, 13, '2026-07-23', '2026-08-20', 33600000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 33600000.00, '2026-07-11 13:50:24', '2026-07-11 06:50:24'),
(27, 13, 13, '2026-07-30', '2026-08-19', 24000000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 24000000.00, '2026-07-11 13:54:45', '2026-07-11 06:54:45'),
(28, 13, 17, '2026-07-17', '2026-08-11', 50000000.00, 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 50000000.00, '2026-07-11 14:16:38', '2026-07-11 07:16:38'),
(29, 13, 5, '2026-07-29', '2026-08-26', 19600000.00, 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 19600000.00, '2026-07-14 13:55:14', '2026-07-14 06:55:14'),
(30, 13, 13, '2026-07-21', '2026-08-18', 33600000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 33600000.00, '2026-07-14 14:59:48', '2026-07-14 07:59:48'),
(31, 13, 1, '2026-07-16', '2026-07-17', 500000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 500000.00, '2026-07-15 23:34:45', '2026-07-15 16:34:45'),
(32, 1, 10, '2026-07-17', '2026-08-20', 30600000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 6, NULL, NULL, 'no_show', 30600000.00, '2026-07-15 23:57:26', '2026-07-15 16:57:26'),
(33, 13, 9, '2026-07-16', '2026-07-17', 900000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 900000.00, '2026-07-16 11:15:58', '2026-07-16 04:15:58'),
(34, 13, 9, '2026-07-17', '2026-07-18', 900000.00, 'no_show', NULL, NULL, 'hon', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 900000.00, '2026-07-16 12:24:52', '2026-07-16 05:24:52'),
(35, 13, 1, '2026-07-29', '2026-07-30', 500000.00, 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 500000.00, '2026-07-16 13:08:35', '2026-07-16 06:08:35'),
(36, 13, 1, '2026-07-17', '2026-08-09', 11500000.00, 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 11500000.00, '2026-07-16 13:24:16', '2026-07-16 06:24:16'),
(37, 13, 2, '2026-07-16', '2026-08-07', 11000000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 11000000.00, '2026-07-16 13:25:26', '2026-07-16 06:25:26'),
(38, 13, 1, '2026-07-16', '2026-08-10', 12500000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 12500000.00, '2026-07-16 21:46:17', '2026-07-16 14:46:17'),
(39, 13, 5, '2026-07-18', '2026-07-19', 700000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 700000.00, '2026-07-18 22:22:36', '2026-07-18 15:22:36'),
(40, 13, 17, '2026-07-29', '2026-07-30', 2000000.00, 'cancelled', NULL, NULL, 'hon', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 2000000.00, '2026-07-19 00:02:28', '2026-07-18 17:02:28'),
(41, 13, 9, '2026-07-24', '2026-08-17', 21600000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 21600000.00, '2026-07-24 14:15:34', '2026-07-24 07:15:34'),
(42, 13, 10, '2026-07-30', '2026-08-24', 22500000.00, 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 22500000.00, '2026-07-24 19:56:26', '2026-07-24 12:56:26'),
(43, 13, 5, '2026-07-24', '2026-07-25', 900000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 900000.00, '2026-07-24 20:05:55', '2026-07-24 13:05:55'),
(44, 13, 17, '2026-07-24', '2026-07-25', 2000000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 2000000.00, '2026-07-24 20:52:32', '2026-07-24 13:52:32'),
(45, 13, 10, '2026-07-25', '2026-07-26', 900000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 900000.00, '2026-07-24 20:54:31', '2026-07-24 13:54:31'),
(46, 13, 10, '2026-07-24', '2026-07-25', 1100000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 1100000.00, '2026-07-24 21:19:11', '2026-07-24 14:19:11'),
(47, 13, 11, '2026-07-24', '2026-07-25', 1100000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 1100000.00, '2026-07-24 21:31:52', '2026-07-24 14:31:52'),
(48, 13, 13, '2026-07-25', '2026-07-26', 1400000.00, 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 1400000.00, '2026-07-25 15:40:17', '2026-07-25 08:40:17'),
(49, 13, 9, '2026-07-25', '2026-07-26', 900000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 900000.00, '2026-07-25 16:10:19', '2026-07-25 09:10:19'),
(50, 13, 13, '2026-07-25', '2026-07-26', 1200000.00, 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 1200000.00, '2026-07-25 22:16:53', '2026-07-25 15:16:53'),
(51, 13, 1, '2026-07-25', '2026-07-31', 3000000.00, 'no_show', NULL, NULL, 'hon', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 3000000.00, '2026-07-25 22:22:20', '2026-07-25 15:22:20'),
(52, 13, 9, '2026-07-29', '2026-07-30', 900000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 900000.00, '2026-07-29 19:30:37', '2026-07-29 12:30:37'),
(53, 13, 10, '2026-07-29', '2026-07-30', 900000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 900000.00, '2026-07-29 19:33:15', '2026-07-29 12:33:15'),
(54, 13, 5, '2026-07-30', '2026-07-31', 700000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 700000.00, '2026-07-29 19:36:24', '2026-07-29 12:36:24'),
(55, 13, 6, '2026-07-29', '2026-08-01', 2100000.00, 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 2100000.00, '2026-07-29 19:38:34', '2026-07-29 12:38:34'),
(56, 13, 9, '2026-07-30', '2026-08-04', 4500000.00, 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 4500000.00, '2026-07-29 20:09:39', '2026-07-29 13:09:39'),
(57, 13, 13, '2026-07-30', '2026-08-02', 3600000.00, 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 3600000.00, '2026-07-29 20:11:07', '2026-07-29 13:11:07'),
(58, 13, 14, '2026-07-29', '2026-08-01', 3600000.00, 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 3600000.00, '2026-07-29 20:19:32', '2026-07-29 13:19:32'),
(59, 13, 11, '2026-07-29', '2026-07-30', 900000.00, 'checked_out', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'checked_out', 900000.00, '2026-07-29 20:23:02', '2026-07-29 13:23:02'),
(60, 13, 10, '2026-07-30', '2026-08-14', 13500000.00, 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 13500000.00, '2026-07-29 20:24:36', '2026-07-29 13:24:36'),
(61, 13, 11, '2026-07-29', '2026-07-30', 900000.00, 'cancelled', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', 900000.00, '2026-07-29 20:50:57', '2026-07-29 13:50:57'),
(62, 13, 13, '2026-07-29', '2026-07-30', 1200000.00, 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 1200000.00, '2026-07-29 21:11:47', '2026-07-29 14:11:47'),
(63, 13, 11, '2026-07-29', '2026-08-02', 3600000.00, 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', 3600000.00, '2026-07-29 21:17:45', '2026-07-29 14:17:45'),
(64, 13, 5, '2026-07-29', '2026-07-30', 700000.00, 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, 17, NULL, 'no_show', 700000.00, '2026-07-29 21:21:22', '2026-07-29 14:21:22'),
(65, 7, 1, '2026-08-10', '2026-08-12', 1000000.00, 'cancelled', NULL, NULL, 'Pham Thi D', 'customer4@gmail.com', '0999999999', 4, NULL, NULL, 'cancelled', 1000000.00, '2026-08-09 06:05:17', '2026-08-08 23:05:17'),
(66, 7, 1, '2026-08-10', '2026-08-12', 1000000.00, 'cancelled', NULL, 'aaaaaaaa', 'Pham Thi D', 'customer4@gmail.com', '0999999999', 4, NULL, NULL, 'cancelled', 1150000.00, '2026-08-09 06:57:38', '2026-08-08 23:57:38'),
(67, 7, 5, '2026-08-11', '2026-08-13', 1400000.00, 'cancelled', NULL, 'hhhhhhh', 'Pham Thi D', 'customer4@gmail.com', '0999999999', 4, NULL, NULL, 'cancelled', 1700000.00, '2026-08-09 08:56:28', '2026-08-09 01:56:28'),
(68, 7, 12, '2026-08-09', '2026-08-13', 3600000.00, 'checked_in', NULL, NULL, 'Pham Thi D', 'customer4@gmail.com', '0999999999', 4, NULL, NULL, 'checked_in', 4650000.00, '2026-08-09 09:04:09', '2026-08-09 02:04:09');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_damage_charges`
--

CREATE TABLE `booking_damage_charges` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `roomId` int(11) NOT NULL,
  `itemName` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unitPrice` decimal(15,2) NOT NULL DEFAULT 0.00,
  `totalPrice` decimal(15,2) NOT NULL DEFAULT 0.00,
  `note` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
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
  `adults` int(11) DEFAULT NULL,
  `children` int(11) DEFAULT NULL,
  `roomPrice` decimal(15,2) DEFAULT NULL,
  `occupancySurcharge` decimal(15,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_details`
--

INSERT INTO `booking_details` (`id`, `bookingId`, `roomId`, `checkInDate`, `checkOutDate`, `adults`, `children`, `roomPrice`, `occupancySurcharge`) VALUES
(1, 1, 1, '2026-06-10', '2026-06-12', 2, 0, 500000.00, 0.00),
(2, 2, 5, '2026-06-15', '2026-06-17', 2, 1, 700000.00, 0.00),
(3, 3, 9, '2026-06-20', '2026-06-23', 3, 1, 900000.00, 0.00),
(4, 4, 13, '2026-06-22', '2026-06-24', 4, 0, 1200000.00, 0.00),
(5, 5, 17, '2026-06-25', '2026-06-27', 2, 0, 2000000.00, 0.00),
(7, 7, 1, '2026-06-24', '2026-07-25', 2, 0, 500000.00, 0.00),
(8, 8, 3, '2026-06-24', '2026-07-22', 2, 0, 500000.00, 0.00),
(9, 9, 2, '2026-06-25', '2026-07-01', 2, 0, 500000.00, 0.00),
(10, 10, 8, '2026-06-25', '2026-07-01', 2, 0, 700000.00, 0.00),
(11, 11, 2, '2026-06-24', '2026-07-01', 2, 0, 500000.00, 0.00),
(12, 12, 1, '2026-06-24', '2026-07-01', 2, 0, 500000.00, 0.00),
(13, 13, 1, '2026-06-24', '2026-07-01', 2, 0, 500000.00, 0.00),
(14, 14, 1, '2026-06-26', '2026-07-24', 2, 0, 500000.00, 0.00),
(15, 15, 1, '2026-06-24', '2026-07-24', 2, 0, 500000.00, 0.00),
(16, 16, 4, '2026-06-26', '2026-07-24', 2, 0, 500000.00, 0.00),
(17, 17, 5, '2026-06-25', '2026-07-22', 2, 0, 700000.00, 0.00),
(18, 18, 1, '2026-06-27', '2026-07-30', 2, 0, 500000.00, 0.00),
(19, 19, 2, '2026-07-30', '2026-07-31', 2, 0, 500000.00, 0.00),
(20, 20, 7, '2026-06-29', '2026-07-23', 2, 0, 700000.00, 0.00),
(21, 21, 6, '2026-07-29', '2026-08-28', 2, 0, 700000.00, 0.00),
(22, 22, 1, '2026-07-16', '2026-08-13', 2, 0, 500000.00, 0.00),
(23, 23, 1, '2026-07-17', '2026-08-13', 2, 0, 500000.00, 0.00),
(24, 24, 1, '2026-07-02', '2026-07-03', 2, 0, 500000.00, 0.00),
(25, 25, 9, '2026-07-23', '2026-08-20', 2, 1, 900000.00, 0.00),
(26, 26, 13, '2026-07-23', '2026-08-20', 2, 2, 1200000.00, 0.00),
(27, 27, 13, '2026-07-30', '2026-08-19', 2, 0, 1200000.00, 0.00),
(28, 28, 17, '2026-07-17', '2026-08-11', 2, 0, 2000000.00, 0.00),
(29, 29, 5, '2026-07-29', '2026-08-26', 2, 0, 700000.00, 0.00),
(30, 30, 13, '2026-07-21', '2026-08-18', 2, 0, 1200000.00, 0.00),
(31, 31, 1, '2026-07-16', '2026-07-17', 2, 0, 500000.00, 0.00),
(32, 32, 10, '2026-07-17', '2026-08-20', 2, 0, 900000.00, 0.00),
(33, 33, 9, '2026-07-16', '2026-07-17', 2, 0, 900000.00, 0.00),
(34, 34, 9, '2026-07-17', '2026-07-18', 2, 0, 900000.00, 0.00),
(35, 35, 1, '2026-07-29', '2026-07-30', 2, 0, 500000.00, 0.00),
(36, 36, 1, '2026-07-17', '2026-08-09', 2, 0, 500000.00, 0.00),
(37, 37, 2, '2026-07-16', '2026-08-07', 2, 0, 500000.00, 0.00),
(38, 38, 1, '2026-07-16', '2026-08-10', 2, 0, 500000.00, 0.00),
(39, 39, 5, '2026-07-18', '2026-07-19', 2, 0, 700000.00, 0.00),
(40, 40, 17, '2026-07-29', '2026-07-30', 2, 0, 2000000.00, 0.00),
(41, 41, 9, '2026-07-24', '2026-08-17', 2, 0, 900000.00, 0.00),
(42, 42, 10, '2026-07-30', '2026-08-24', 2, 1, 900000.00, 0.00),
(43, 43, 5, '2026-07-24', '2026-07-25', 1, 1, 700000.00, 200000.00),
(44, 44, 17, '2026-07-24', '2026-07-25', 2, 0, 2000000.00, 0.00),
(45, 45, 10, '2026-07-25', '2026-07-26', 2, 0, 900000.00, 0.00),
(46, 46, 10, '2026-07-24', '2026-07-25', 1, 1, 900000.00, 200000.00),
(47, 47, 11, '2026-07-24', '2026-07-25', 1, 1, 900000.00, 200000.00),
(48, 48, 13, '2026-07-25', '2026-07-26', 1, 1, 1200000.00, 200000.00),
(49, 49, 9, '2026-07-25', '2026-07-26', 2, 0, 900000.00, 0.00),
(50, 50, 13, '2026-07-25', '2026-07-26', 2, 0, 1200000.00, 0.00),
(51, 51, 1, '2026-07-25', '2026-07-31', 2, 0, 500000.00, 0.00),
(52, 52, 9, '2026-07-29', '2026-07-30', 2, 0, 900000.00, 0.00),
(53, 53, 10, '2026-07-29', '2026-07-30', 2, 0, 900000.00, 0.00),
(54, 54, 5, '2026-07-30', '2026-07-31', 2, 0, 700000.00, 0.00),
(55, 55, 6, '2026-07-29', '2026-08-01', 2, 0, 700000.00, 0.00),
(56, 56, 9, '2026-07-30', '2026-08-04', 2, 0, 900000.00, 0.00),
(57, 57, 13, '2026-07-30', '2026-08-02', 2, 0, 1200000.00, 0.00),
(58, 58, 14, '2026-07-29', '2026-08-01', 2, 0, 1200000.00, 0.00),
(59, 59, 11, '2026-07-29', '2026-07-30', 2, 0, 900000.00, 0.00),
(60, 60, 10, '2026-07-30', '2026-08-14', 2, 0, 900000.00, 0.00),
(61, 61, 11, '2026-07-29', '2026-07-30', 2, 0, 900000.00, 0.00),
(62, 62, 13, '2026-07-29', '2026-07-30', 2, 0, 1200000.00, 0.00),
(63, 63, 11, '2026-07-29', '2026-08-02', 2, 0, 900000.00, 0.00),
(64, 64, 5, '2026-07-29', '2026-07-30', 2, 0, 700000.00, 0.00),
(65, 65, 1, '2026-08-10', '2026-08-12', 2, 0, 500000.00, 0.00),
(66, 66, 1, '2026-08-10', '2026-08-12', 2, 0, 500000.00, 0.00),
(67, 67, 5, '2026-08-11', '2026-08-13', 2, 0, 700000.00, 0.00),
(68, 68, 12, '2026-08-09', '2026-08-13', 2, 0, 900000.00, 0.00);

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
(1, 59, 'quyhoanfk123', '11111111111', '0393166495', NULL, '2026-07-29 20:36:54'),
(2, 68, 'Pham Thi D', '123456788765', '0999999999', NULL, '2026-08-09 14:35:26');

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
  `id` int(11) NOT NULL,
  `bookingId` int(11) DEFAULT NULL,
  `serviceId` int(11) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `totalPrice` decimal(15,2) DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_services`
--

INSERT INTO `booking_services` (`id`, `bookingId`, `serviceId`, `quantity`, `totalPrice`, `createdAt`) VALUES
(1, 1, 1, 2, 300000.00, '2026-08-08 20:22:19'),
(2, 2, 2, 1, 100000.00, '2026-08-08 20:22:19'),
(3, 3, 3, 2, 600000.00, '2026-08-08 20:22:19'),
(4, 4, 5, 1, 200000.00, '2026-08-08 20:22:19'),
(5, 5, 7, 1, 400000.00, '2026-08-08 20:22:19'),
(6, 40, 4, 1, 500000.00, '2026-08-08 20:22:19'),
(7, 43, 7, 2, 800000.00, '2026-08-08 20:22:19'),
(8, 40, 6, 1, 350000.00, '2026-08-08 20:22:19'),
(9, 44, 6, 1, 350000.00, '2026-08-08 20:22:19'),
(10, 45, 7, 2, 800000.00, '2026-08-08 20:22:19'),
(11, 66, 1, 1, 150000.00, '2026-08-09 06:57:38'),
(12, 67, 3, 1, 300000.00, '2026-08-09 08:56:28'),
(13, 68, 3, 2, 600000.00, '2026-08-09 09:04:09'),
(14, 68, 2, 1, 100000.00, '2026-08-09 11:08:47'),
(16, 68, 6, 1, 350000.00, '2026-08-09 14:21:24');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_service_requests`
--

CREATE TABLE `booking_service_requests` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `serviceId` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `note` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_service_requests`
--

INSERT INTO `booking_service_requests` (`id`, `bookingId`, `serviceId`, `quantity`, `status`, `note`, `createdAt`) VALUES
(1, 23, 4, 1, 'rejected', NULL, '2026-07-02 22:13:59'),
(2, 25, 6, 1, 'rejected', NULL, '2026-07-11 13:40:46'),
(3, 40, 4, 1, 'confirmed', NULL, '2026-07-19 00:02:28'),
(4, 40, 6, 1, 'confirmed', NULL, '2026-07-19 00:02:28'),
(5, 42, 4, 2, 'rejected', NULL, '2026-07-24 19:56:26'),
(6, 43, 7, 2, 'confirmed', NULL, '2026-07-24 20:05:55'),
(7, 44, 6, 1, 'confirmed', NULL, '2026-07-24 20:52:32'),
(8, 45, 7, 2, 'confirmed', NULL, '2026-07-24 20:54:31'),
(9, 47, 2, 1, 'rejected', NULL, '2026-07-24 21:31:52'),
(10, 52, 5, 1, 'rejected', NULL, '2026-07-29 19:30:37'),
(11, 66, 1, 1, 'confirmed', NULL, '2026-08-09 06:57:38'),
(12, 67, 3, 1, 'confirmed', NULL, '2026-08-09 08:56:28'),
(13, 68, 3, 1, 'confirmed', NULL, '2026-08-09 09:04:09');

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
-- Cấu trúc bảng cho bảng `customers`
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
(8, 13, 'quyhoanfk123@gmail.com', '0393166495', NULL, NULL, NULL, NULL, NULL),
(9, 14, 'dohoan170706', '0393166495', NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `customer_vouchers`
--

CREATE TABLE `customer_vouchers` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `voucherId` int(11) NOT NULL,
  `bookingId` int(11) DEFAULT NULL,
  `source` varchar(50) DEFAULT 'no_show',
  `isUsed` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `customer_vouchers`
--

INSERT INTO `customer_vouchers` (`id`, `userId`, `voucherId`, `bookingId`, `source`, `isUsed`, `createdAt`) VALUES
(1, 13, 8, 24, 'no_show', 0, '2026-07-11 13:20:53'),
(2, 13, 9, 33, 'no_show', 0, '2026-07-17 15:01:37'),
(3, 13, 10, 37, 'no_show', 0, '2026-07-17 15:01:37'),
(4, 13, 11, 38, 'no_show', 0, '2026-07-17 15:01:37'),
(5, 1, 12, 32, 'no_show', 0, '2026-07-18 22:17:28'),
(6, 13, 13, 34, 'no_show', 0, '2026-07-18 22:17:28'),
(7, 13, 14, 39, 'no_show', 0, '2026-07-19 07:22:33'),
(8, 13, 15, 25, 'no_show', 0, '2026-07-24 14:14:08'),
(9, 13, 16, 30, 'no_show', 0, '2026-07-24 14:14:08'),
(10, 13, 17, 41, 'no_show', 1, '2026-07-25 15:36:24'),
(11, 13, 18, 43, 'no_show', 0, '2026-07-25 15:36:24'),
(12, 13, 19, 47, 'no_show', 0, '2026-07-25 15:36:24'),
(13, 13, 20, 45, 'no_show', 0, '2026-07-28 21:45:50'),
(14, 13, 21, 49, 'no_show', 0, '2026-07-28 21:45:50'),
(15, 13, 22, 50, 'no_show', 0, '2026-07-28 21:45:50'),
(16, 13, 23, 51, 'no_show', 0, '2026-07-28 21:45:50'),
(17, 13, 24, 52, 'no_show', 0, '2026-08-01 21:26:31'),
(18, 13, 25, 53, 'no_show', 0, '2026-08-01 21:26:31'),
(19, 13, 26, 54, 'no_show', 0, '2026-08-01 21:26:31'),
(20, 13, 27, 55, 'no_show', 0, '2026-08-01 21:26:31'),
(21, 13, 28, 56, 'no_show', 0, '2026-08-01 21:26:31'),
(22, 13, 29, 57, 'no_show', 0, '2026-08-01 21:26:31'),
(23, 13, 30, 58, 'no_show', 0, '2026-08-01 21:26:31'),
(24, 13, 31, 60, 'no_show', 0, '2026-08-01 21:26:31'),
(25, 13, 32, 62, 'no_show', 0, '2026-08-01 21:26:31'),
(26, 13, 33, 63, 'no_show', 0, '2026-08-01 21:26:31'),
(27, 13, 34, 64, 'no_show', 0, '2026-08-01 21:26:31');

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
(3, 5, 10, 'Den ban bi hu', 200000.00, '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `invoices`
--

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `paymentId` int(11) DEFAULT NULL,
  `invoiceCode` varchar(100) DEFAULT NULL,
  `roomAmount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `serviceAmount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `surchargeAmount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `invoiceDate` datetime DEFAULT current_timestamp(),
  `subtotal` decimal(15,2) DEFAULT NULL,
  `discountAmount` decimal(15,2) DEFAULT NULL,
  `taxAmount` decimal(15,2) DEFAULT NULL,
  `totalAmount` decimal(15,2) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `invoices`
--

INSERT INTO `invoices` (`id`, `bookingId`, `paymentId`, `invoiceCode`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `invoiceDate`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `note`, `status`) VALUES
(1, 14, 14, 'HD202606-00001', 0.00, 0.00, 0.00, '2026-06-24 20:58:17', 14000000.00, 0.00, 0.00, 14000000.00, NULL, 'issued'),
(2, 15, 15, 'HD202606-00002', 0.00, 0.00, 0.00, '2026-06-24 21:07:54', 15000000.00, 0.00, 0.00, 15000000.00, NULL, 'issued'),
(3, 16, 16, 'HD202606-00003', 0.00, 0.00, 0.00, '2026-06-24 21:44:14', 14000000.00, 0.00, 0.00, 14000000.00, NULL, 'issued'),
(4, 17, 17, 'HD202606-00004', 0.00, 0.00, 0.00, '2026-06-25 20:52:01', 18900000.00, 0.00, 0.00, 18900000.00, NULL, 'issued'),
(5, 18, 18, 'HD202606-00005', 0.00, 0.00, 0.00, '2026-06-25 20:53:19', 16500000.00, 0.00, 0.00, 16500000.00, NULL, 'issued'),
(6, 20, 20, 'HD202607-00001', 0.00, 0.00, 0.00, '2026-07-02 19:48:07', 16800000.00, 0.00, 0.00, 16800000.00, NULL, 'issued'),
(7, 23, 23, 'HD202607-00002', 0.00, 0.00, 0.00, '2026-07-02 22:14:44', 13500000.00, 0.00, 0.00, 13500000.00, NULL, 'issued'),
(8, 26, 26, 'HD202607-00003', 0.00, 0.00, 0.00, '2026-07-11 13:50:55', 33600000.00, 0.00, 0.00, 33600000.00, NULL, 'issued'),
(9, 27, 27, 'HD202607-00004', 0.00, 0.00, 0.00, '2026-07-11 14:05:24', 24000000.00, 0.00, 0.00, 24000000.00, NULL, 'issued'),
(10, 25, 25, 'HD202607-00005', 0.00, 0.00, 0.00, '2026-07-11 14:14:27', 25200000.00, 0.00, 0.00, 25200000.00, NULL, 'issued'),
(11, 33, 33, 'HD202607-00006', 0.00, 0.00, 0.00, '2026-07-16 12:05:26', 900000.00, 0.00, 0.00, 900000.00, NULL, 'issued'),
(12, 32, 32, 'HD202607-00007', 0.00, 0.00, 0.00, '2026-07-16 12:22:06', 30600000.00, 0.00, 0.00, 30600000.00, NULL, 'issued'),
(13, 34, 34, 'HD202607-00008', 0.00, 0.00, 0.00, '2026-07-16 12:49:23', 900000.00, 0.00, 0.00, 900000.00, NULL, 'issued'),
(14, 30, 30, 'HD202607-00009', 0.00, 0.00, 0.00, '2026-07-16 12:59:41', 33600000.00, 0.00, 0.00, 33600000.00, NULL, 'issued'),
(15, 24, 24, 'HD202607-00010', 0.00, 0.00, 0.00, '2026-07-16 13:03:30', 500000.00, 0.00, 0.00, 500000.00, NULL, 'issued'),
(16, 37, 37, 'HD202607-00011', 0.00, 0.00, 0.00, '2026-07-16 13:30:01', 11000000.00, 0.00, 0.00, 11000000.00, NULL, 'issued'),
(17, 38, 38, 'HD202607-00012', 0.00, 0.00, 0.00, '2026-07-16 21:49:07', 12500000.00, 0.00, 0.00, 12500000.00, NULL, 'issued'),
(18, 39, 39, 'HD202607-00013', 700000.00, 0.00, 0.00, '2026-07-18 22:23:27', 700000.00, 0.00, 0.00, 700000.00, NULL, 'issued'),
(19, 41, 41, 'HD202607-00014', 21600000.00, 0.00, 0.00, '2026-07-24 14:17:03', 21600000.00, 0.00, 0.00, 21600000.00, NULL, 'issued'),
(20, 40, 40, 'HD202607-00015', 2000000.00, 500000.00, 0.00, '2026-07-24 19:35:49', 2500000.00, 0.00, 0.00, 2500000.00, NULL, 'issued'),
(21, 45, 45, 'HD202607-00016', 900000.00, 800000.00, 0.00, '2026-07-24 20:57:25', 1700000.00, 0.00, 0.00, 1700000.00, NULL, 'issued'),
(22, 47, 47, 'HD202607-00017', 900000.00, 0.00, 200000.00, '2026-07-25 16:01:00', 1100000.00, 0.00, 0.00, 1100000.00, NULL, 'issued'),
(23, 49, 49, 'HD202607-00018', 900000.00, 0.00, 0.00, '2026-07-25 16:45:51', 900000.00, 0.00, 0.00, 900000.00, NULL, 'issued'),
(24, 50, 50, 'HD202607-00019', 1200000.00, 0.00, 0.00, '2026-07-25 22:17:42', 1200000.00, 0.00, 0.00, 1200000.00, NULL, 'issued'),
(25, 51, 51, 'HD202607-00020', 3000000.00, 0.00, 0.00, '2026-07-25 22:22:41', 3000000.00, 0.00, 0.00, 3000000.00, NULL, 'issued'),
(26, 52, 52, 'HD202607-00021', 900000.00, 0.00, 0.00, '2026-07-29 19:31:25', 900000.00, 0.00, 0.00, 900000.00, NULL, 'issued'),
(27, 43, 43, 'HD202607-00022', 700000.00, 800000.00, 200000.00, '2026-07-29 19:32:39', 1700000.00, 0.00, 0.00, 1700000.00, NULL, 'issued'),
(28, 53, 53, 'HD202607-00023', 900000.00, 0.00, 0.00, '2026-07-29 19:35:51', 900000.00, 0.00, 0.00, 900000.00, NULL, 'issued'),
(29, 54, 54, 'HD202607-00024', 700000.00, 0.00, 0.00, '2026-07-29 19:38:14', 700000.00, 0.00, 0.00, 700000.00, NULL, 'issued'),
(30, 55, 55, 'HD202607-00025', 2100000.00, 0.00, 0.00, '2026-07-29 20:01:02', 2100000.00, 0.00, 0.00, 2100000.00, NULL, 'issued'),
(31, 56, 56, 'HD202607-00026', 4500000.00, 0.00, 0.00, '2026-07-29 20:10:42', 4500000.00, 0.00, 0.00, 4500000.00, NULL, 'issued'),
(32, 57, 57, 'HD202607-00027', 3600000.00, 0.00, 0.00, '2026-07-29 20:11:46', 3600000.00, 0.00, 0.00, 3600000.00, NULL, 'issued'),
(33, 58, 58, 'HD202607-00028', 3600000.00, 0.00, 0.00, '2026-07-29 20:22:40', 3600000.00, 0.00, 0.00, 3600000.00, NULL, 'issued'),
(34, 60, 60, 'HD202607-00029', 13500000.00, 0.00, 0.00, '2026-07-29 20:34:38', 13500000.00, 0.00, 0.00, 13500000.00, NULL, 'issued'),
(35, 59, 59, 'HD202607-00030', 900000.00, 0.00, 0.00, '2026-07-29 20:36:43', 900000.00, 0.00, 0.00, 900000.00, NULL, 'issued'),
(36, 62, 62, 'HD202607-00031', 1200000.00, 0.00, 0.00, '2026-07-29 21:12:01', 1200000.00, 0.00, 0.00, 1200000.00, NULL, 'issued'),
(37, 63, 63, 'HD202607-00032', 3600000.00, 0.00, 0.00, '2026-07-29 21:18:14', 3600000.00, 0.00, 0.00, 3600000.00, NULL, 'issued'),
(38, 68, 68, 'HD202608-00001', 1400000.00, 1050000.00, 0.00, '2026-08-09 14:35:03', 2450000.00, 0.00, 0.00, 2450000.00, NULL, 'issued');

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
(6, 7, 'Thanh toán dịch vụ phát sinh', 'Dịch vụ Giặt ủi đã được thêm vào đặt phòng #68 với số tiền 100.000 VNĐ. Số tiền còn phải thanh toán là 1.390.000 VNĐ.', 0, '2026-08-09 11:08:47'),
(7, 7, 'Thanh toán dịch vụ phát sinh', 'Dịch vụ Buffet sáng đã được thêm vào đặt phòng #68 với số tiền 150.000 VNĐ. Số tiền còn phải thanh toán là 1.840.000 VNĐ.', 0, '2026-08-09 11:09:32'),
(8, 7, 'Thanh toán dịch vụ phát sinh', 'Dịch vụ Buffet tối đã được thêm vào đặt phòng #68 với số tiền 350.000 VNĐ. Số tiền còn phải thanh toán là 1.940.000 VNĐ.', 0, '2026-08-09 14:21:24');

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
  `paymentDate` datetime DEFAULT NULL,
  `voucherCode` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `payments`
--

INSERT INTO `payments` (`id`, `bookingId`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `discountAmount`, `depositAmount`, `paidAmount`, `remainingAmount`, `totalAmount`, `paymentMethod`, `paymentStatus`, `transactionCode`, `paymentDate`, `voucherCode`) VALUES
(1, 1, 1000000.00, 0.00, 0.00, 100000.00, 300000.00, 900000.00, 0.00, 900000.00, 'cash', 'paid', 'TXN001', '2026-06-10 10:00:00', NULL),
(2, 2, 1400000.00, 0.00, 0.00, 50000.00, 500000.00, 500000.00, 850000.00, 1350000.00, 'momo', 'deposit_paid', 'TXN002', '2026-06-15 09:00:00', NULL),
(3, 3, 2700000.00, 200000.00, 0.00, 300000.00, 1000000.00, 2600000.00, 0.00, 2600000.00, 'vnpay', 'paid', 'TXN003', '2026-06-20 14:00:00', NULL),
(4, 4, 1200000.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, 700000.00, 1200000.00, 'cash', 'deposit_paid', 'TXN004', '2026-06-22 15:00:00', NULL),
(5, 5, 2000000.00, 0.00, 0.00, 200000.00, 1000000.00, 1800000.00, 0.00, 1800000.00, 'vnpay', 'paid', 'TXN005', '2026-06-25 11:00:00', NULL),
(7, 7, 15500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 15500000.00, 15500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(8, 8, 14000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 14000000.00, 14000000.00, NULL, 'unpaid', NULL, NULL, NULL),
(9, 9, 3000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3000000.00, 3000000.00, NULL, 'unpaid', NULL, NULL, NULL),
(10, 10, 4200000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 4200000.00, 4200000.00, NULL, 'unpaid', NULL, NULL, NULL),
(11, 11, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(12, 12, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(13, 13, 3500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500000.00, 3500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(14, 14, 14000000.00, 0.00, 0.00, 0.00, 0.00, 14000000.00, 0.00, 14000000.00, 'cash', 'paid', 'CASH-MQS521R4-1B8YT0', '2026-06-24 20:58:17', NULL),
(15, 15, 15000000.00, 0.00, 0.00, 0.00, 0.00, 15000000.00, 0.00, 15000000.00, 'cash', 'paid', 'CASH-MQS5EEWF-9HIIM3', '2026-06-24 21:07:54', NULL),
(16, 16, 14000000.00, 0.00, 0.00, 0.00, 0.00, 14000000.00, 0.00, 14000000.00, 'vnpay', 'paid', 'VNPAY-MQS6P5AN-FYXJU4', '2026-06-24 21:44:15', NULL),
(17, 17, 18900000.00, 0.00, 0.00, 0.00, 0.00, 18900000.00, 0.00, 18900000.00, 'cash', 'paid', 'CASH-MQTK9U0B-9MJRPI', '2026-06-25 20:52:01', NULL),
(18, 18, 16500000.00, 0.00, 0.00, 0.00, 0.00, 16500000.00, 0.00, 16500000.00, 'cash', 'paid', 'CASH-MQTKBIHL-K17WPA', '2026-06-25 20:53:19', NULL),
(19, 19, 500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(20, 20, 16800000.00, 0.00, 0.00, 0.00, 0.00, 16800000.00, 0.00, 16800000.00, 'cash', 'paid', 'CASH-MR3I2MY7-X59R6G', '2026-07-02 19:48:08', NULL),
(21, 21, 21000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 21000000.00, 21000000.00, NULL, 'unpaid', NULL, NULL, NULL),
(22, 22, 14000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 14000000.00, 14000000.00, NULL, 'unpaid', NULL, NULL, NULL),
(23, 23, 13500000.00, 0.00, 0.00, 0.00, 0.00, 13500000.00, 0.00, 13500000.00, 'cash', 'paid', 'CASH-MR3NB65Z-VW1C2R', '2026-07-02 22:14:44', NULL),
(24, 24, 500000.00, 0.00, 0.00, 0.00, 0.00, 500000.00, 0.00, 500000.00, 'bank_transfer', 'paid', 'BANK-MRN3S83A-WFKMQV', '2026-07-16 13:03:31', NULL),
(25, 25, 25200000.00, 0.00, 0.00, 0.00, 0.00, 25200000.00, 0.00, 25200000.00, 'vnpay', 'paid', 'VNPAY-MRG14748-VVXTUI', '2026-07-11 14:14:27', NULL),
(26, 26, 33600000.00, 0.00, 0.00, 0.00, 0.00, 33600000.00, 0.00, 33600000.00, 'cash', 'paid', 'CASH-MRG09XOC-XR9JIB', '2026-07-11 13:50:56', NULL),
(27, 27, 24000000.00, 0.00, 0.00, 0.00, 0.00, 24000000.00, 0.00, 24000000.00, 'cash', 'refunded', 'CASH-MRG0SK7G-6EGVC8', '2026-07-11 14:05:25', NULL),
(28, 28, 50000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 50000000.00, 50000000.00, NULL, 'unpaid', NULL, NULL, NULL),
(29, 29, 19600000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 19600000.00, 19600000.00, 'momo', 'unpaid', 'MOMO-29-1784012667992', NULL, NULL),
(30, 30, 33600000.00, 0.00, 0.00, 0.00, 0.00, 33600000.00, 0.00, 33600000.00, 'vnpay', 'paid', 'VNPAY-MRN3NAY0-JPIRH9', '2026-07-16 12:59:41', NULL),
(31, 31, 500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, 'vnpay', 'unpaid', 'VNPAY-31-1784133671241', NULL, NULL),
(32, 32, 30600000.00, 0.00, 0.00, 0.00, 0.00, 30600000.00, 0.00, 30600000.00, 'bank_transfer', 'paid', 'BANK-MRN2AYXM-LD47BY', '2026-07-16 12:22:06', NULL),
(33, 33, 900000.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 0.00, 900000.00, 'bank_transfer', 'paid', 'BANK-MRN1PJ7X-FKTXM7', '2026-07-16 12:05:26', NULL),
(34, 34, 900000.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 0.00, 900000.00, 'vnpay', 'paid', 'VNPAY-MRN3A2A9-6XZWSP', '2026-07-16 12:49:24', NULL),
(35, 35, 500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(36, 36, 11500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 11500000.00, 11500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(37, 37, 11000000.00, 0.00, 0.00, 0.00, 0.00, 11000000.00, 0.00, 11000000.00, 'bank_transfer', 'paid', 'BANK-MRN4QB5I-48K17M', '2026-07-16 13:30:01', NULL),
(38, 38, 12500000.00, 0.00, 0.00, 0.00, 0.00, 12500000.00, 0.00, 12500000.00, 'vnpay', 'paid', 'VNPAY-MRNMK5W9-1NLS21', '2026-07-16 21:49:08', NULL),
(39, 39, 700000.00, 0.00, 0.00, 0.00, 0.00, 700000.00, 0.00, 700000.00, 'bank_transfer', 'paid', 'BANK-MRQIO0JL-Y5W36G', '2026-07-18 22:23:27', NULL),
(40, 40, 2000000.00, 850000.00, 0.00, 0.00, 0.00, 0.00, 2850000.00, 2850000.00, 'cash', 'unpaid', NULL, NULL, NULL),
(41, 41, 21600000.00, 0.00, 0.00, 0.00, 0.00, 21600000.00, 0.00, 21600000.00, 'vnpay', 'paid', 'VNPAY-MRYLXLWJ-B2ST9K', '2026-07-24 14:17:03', NULL),
(42, 42, 22500000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 22500000.00, 22500000.00, NULL, 'unpaid', NULL, NULL, NULL),
(43, 43, 700000.00, 800000.00, 200000.00, 0.00, 510000.00, 1700000.00, 0.00, 1700000.00, 'vnpay', 'paid', 'VNPAY-43-1785328300427', '2026-07-29 19:32:39', NULL),
(44, 44, 2000000.00, 350000.00, 0.00, 0.00, 0.00, 0.00, 2350000.00, 2350000.00, 'vnpay', 'unpaid', 'VNPAY-44-1784901916455', NULL, NULL),
(45, 45, 900000.00, 800000.00, 0.00, 0.00, 0.00, 1700000.00, 0.00, 1700000.00, 'bank_transfer', 'paid', 'BANK-MRZ08HHT-5W031G', '2026-07-24 20:57:25', NULL),
(46, 46, 900000.00, 0.00, 200000.00, 0.00, 0.00, 0.00, 1100000.00, 1100000.00, 'vnpay', 'unpaid', 'VNPAY-46-1784903470991', NULL, NULL),
(47, 47, 900000.00, 0.00, 200000.00, 0.00, 0.00, 1100000.00, 0.00, 1100000.00, 'bank_transfer', 'paid', 'BANK-MS0535F6-72EPA2', '2026-07-25 16:01:01', NULL),
(48, 48, 1200000.00, 0.00, 200000.00, 0.00, 0.00, 0.00, 1400000.00, 1400000.00, 'vnpay', 'unpaid', 'VNPAY-48-1784969017812', NULL, NULL),
(49, 49, 900000.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 0.00, 900000.00, 'vnpay', 'paid', 'VNPAY-49-1784972719422', '2026-07-25 16:45:51', NULL),
(50, 50, 1200000.00, 0.00, 0.00, 0.00, 0.00, 1200000.00, 0.00, 1200000.00, 'vnpay', 'paid', 'VNPAY-50-1784992617701', '2026-07-25 22:17:42', NULL),
(51, 51, 3000000.00, 0.00, 0.00, 0.00, 0.00, 3000000.00, 0.00, 3000000.00, 'bank_transfer', 'paid', 'BANK-MS0IPZUK-F2V2T2', '2026-07-25 22:22:41', NULL),
(52, 52, 900000.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 0.00, 900000.00, 'vnpay', 'paid', 'VNPAY-52-1785328248478', '2026-07-29 19:31:26', NULL),
(53, 53, 900000.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 0.00, 900000.00, 'zalopay', 'paid', '260729_53_1785328530634', '2026-07-29 19:35:51', NULL),
(54, 54, 700000.00, 0.00, 0.00, 0.00, 0.00, 700000.00, 0.00, 700000.00, 'zalopay', 'paid', '260729_54_1785328678162', '2026-07-29 19:38:15', NULL),
(55, 55, 2100000.00, 0.00, 0.00, 0.00, 0.00, 2100000.00, 0.00, 2100000.00, 'bank_transfer', 'paid', 'BANK-MS63F8J2-DQ55WI', '2026-07-29 20:01:02', NULL),
(56, 56, 4500000.00, 0.00, 0.00, 0.00, 0.00, 4500000.00, 0.00, 4500000.00, 'bank_transfer', 'paid', 'BANK-MS63RO6P-3KL8X4', '2026-07-29 20:10:42', NULL),
(57, 57, 3600000.00, 0.00, 0.00, 0.00, 0.00, 3600000.00, 0.00, 3600000.00, 'zalopay', 'paid', '260729_57_1785330673108', '2026-07-29 20:11:46', NULL),
(58, 58, 3600000.00, 0.00, 0.00, 0.00, 0.00, 3600000.00, 0.00, 3600000.00, 'vnpay', 'paid', 'VNPAY-58-1785331317440', '2026-07-29 20:22:41', NULL),
(59, 59, 900000.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 0.00, 900000.00, 'bank_transfer', 'refunded', 'BANK-MS64P4VV-FAEEA6', '2026-07-29 20:36:44', NULL),
(60, 60, 13500000.00, 0.00, 0.00, 0.00, 0.00, 13500000.00, 0.00, 13500000.00, 'bank_transfer', 'paid', 'BANK-MS64MG7S-6PEWGZ', '2026-07-29 20:34:38', NULL),
(61, 61, 900000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 900000.00, 900000.00, NULL, 'unpaid', NULL, NULL, NULL),
(62, 62, 1200000.00, 0.00, 0.00, 0.00, 0.00, 1200000.00, 0.00, 1200000.00, 'bank_transfer', 'paid', 'BANK-MS65YIWX-Q6KJQ8', '2026-07-29 21:12:01', NULL),
(63, 63, 3600000.00, 0.00, 0.00, 0.00, 0.00, 3600000.00, 0.00, 3600000.00, 'bank_transfer', 'paid', 'BANK-MS666IED-LPVFB2', '2026-07-29 21:18:14', NULL),
(64, 64, 700000.00, 0.00, 0.00, 70000.00, 189000.00, 189000.00, 441000.00, 630000.00, 'bank_transfer', 'deposit_paid', 'BANK-MS66MF5U-9JVSM1', '2026-07-29 21:30:36', NULL),
(65, 65, 1000000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1000000.00, 1000000.00, 'zalopay', 'unpaid', '260809_65_1786230448001', NULL, NULL),
(66, 66, 1000000.00, 150000.00, 0.00, 0.00, 0.00, 0.00, 1150000.00, 1150000.00, NULL, 'unpaid', NULL, NULL, NULL),
(67, 67, 1400000.00, 300000.00, 0.00, 0.00, 0.00, 0.00, 1700000.00, 1700000.00, NULL, 'unpaid', NULL, NULL, NULL),
(68, 68, 3600000.00, 1050000.00, 0.00, 0.00, 510000.00, 2450000.00, 2200000.00, 4650000.00, 'bank_transfer', 'deposit_paid', 'BANK-MSLHMDZI-KPTAJ5', '2026-08-09 14:35:03', NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `payment_confirmation_requests`
--

CREATE TABLE `payment_confirmation_requests` (
  `id` int(11) NOT NULL,
  `paymentId` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `paymentMethod` varchar(30) NOT NULL DEFAULT 'bank_transfer',
  `status` enum('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
  `note` varchar(500) DEFAULT NULL,
  `submittedAt` datetime DEFAULT current_timestamp(),
  `confirmedBy` int(11) DEFAULT NULL,
  `confirmedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `payment_confirmation_requests`
--

INSERT INTO `payment_confirmation_requests` (`id`, `paymentId`, `bookingId`, `amount`, `paymentMethod`, `status`, `note`, `submittedAt`, `confirmedBy`, `confirmedAt`) VALUES
(1, 33, 33, 630000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-16 11:57:33', 1, '2026-07-16 12:05:26'),
(2, 32, 32, 21420000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-16 12:14:49', 1, '2026-07-16 12:22:06'),
(3, 34, 34, 270000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-16 12:24:59', 1, '2026-07-16 12:25:21'),
(4, 24, 24, 350000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-16 13:02:48', 1, '2026-07-16 13:03:30'),
(6, 35, 35, 150000.00, 'bank_transfer', 'pending', NULL, '2026-07-16 13:08:40', NULL, NULL),
(7, 37, 37, 7700000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-16 13:29:30', 1, '2026-07-16 13:30:01'),
(8, 39, 39, 700000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-18 22:23:01', 1, '2026-07-18 22:23:27'),
(9, 40, 40, 1900000.00, 'bank_transfer', 'pending', NULL, '2026-07-24 19:35:35', NULL, NULL),
(10, 43, 43, 1190000.00, 'bank_transfer', 'pending', NULL, '2026-07-29 19:18:58', NULL, NULL),
(11, 45, 45, 1700000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-24 20:57:09', 1, '2026-07-24 20:57:25'),
(12, 46, 46, 330000.00, 'bank_transfer', 'pending', NULL, '2026-07-24 21:26:05', NULL, NULL),
(13, 47, 47, 770000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-25 15:59:45', 1, '2026-07-25 16:01:00'),
(15, 49, 49, 270000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-25 16:22:16', 1, '2026-07-25 16:22:39'),
(16, 51, 51, 3000000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-25 22:22:33', 1, '2026-07-25 22:22:41'),
(18, 55, 55, 1470000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:00:13', 1, '2026-07-29 20:01:02'),
(19, 56, 56, 4500000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:09:46', 1, '2026-07-29 20:10:42'),
(20, 60, 60, 13500000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:34:28', 1, '2026-07-29 20:34:38'),
(21, 59, 59, 900000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:36:33', 1, '2026-07-29 20:36:43'),
(22, 62, 62, 1200000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-29 21:11:53', 1, '2026-07-29 21:12:01'),
(23, 63, 63, 3600000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-29 21:17:53', 1, '2026-07-29 21:18:14'),
(24, 64, 64, 189000.00, 'bank_transfer', 'confirmed', NULL, '2026-07-29 21:30:28', 1, '2026-07-29 21:30:36'),
(25, 65, 65, 300000.00, 'bank_transfer', 'pending', NULL, '2026-08-09 06:05:33', NULL, NULL),
(26, 66, 66, 345000.00, 'bank_transfer', 'pending', NULL, '2026-08-09 06:57:45', NULL, NULL),
(27, 67, 67, 510000.00, 'bank_transfer', 'pending', NULL, '2026-08-09 09:00:18', NULL, NULL),
(28, 68, 68, 1940000.00, 'bank_transfer', 'confirmed', NULL, '2026-08-09 14:34:51', 1, '2026-08-09 14:35:03');

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
(1, 26, 26, 33600000.00, 1.00, 33600000.00, 'cash', NULL, NULL, NULL, NULL, 'rejected', NULL, '2026-07-11 13:51:16', '2026-07-16 11:13:30'),
(2, 27, 27, 24000000.00, 1.00, 24000000.00, 'cash', NULL, NULL, NULL, NULL, 'approved', NULL, '2026-07-11 14:05:41', '2026-07-11 14:44:54'),
(3, 23, 23, 6750000.00, 0.50, 13500000.00, 'cash', NULL, NULL, NULL, NULL, 'rejected', NULL, '2026-07-11 14:05:51', '2026-07-24 19:43:24'),
(4, 59, 59, 450000.00, 0.50, 900000.00, 'cash', NULL, NULL, NULL, NULL, 'approved', NULL, '2026-07-29 20:37:09', '2026-07-29 20:38:56');

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
  `id` int(11) NOT NULL,
  `bookingId` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `rating` int(11) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `createdAt` datetime DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL DEFAULT 'approved',
  `images` text DEFAULT NULL,
  `adminReply` text DEFAULT NULL,
  `repliedAt` datetime DEFAULT NULL,
  `hideReason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `reviews`
--

INSERT INTO `reviews` (`id`, `bookingId`, `customerId`, `rating`, `comment`, `createdAt`, `status`, `images`, `adminReply`, `repliedAt`, `hideReason`) VALUES
(1, 1, 1, 5, 'Phong sach se, nhan vien than thien', '2026-06-10 23:26:20', 'approved', NULL, NULL, NULL, NULL),
(2, 2, 2, 4, 'Phong dep, do an ngon', '2026-06-10 23:26:20', 'approved', NULL, NULL, NULL, NULL),
(3, 3, 3, 5, 'Rat hai long voi dich vu', '2026-06-10 23:26:20', 'approved', NULL, NULL, NULL, NULL),
(4, 4, 4, 4, 'Gia hop ly', '2026-06-10 23:26:20', 'approved', NULL, NULL, NULL, NULL),
(5, 5, 5, 5, 'Se quay lai lan sau', '2026-06-10 23:26:20', 'approved', NULL, NULL, NULL, NULL);

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
  `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
  `maintenanceNote` varchar(255) DEFAULT NULL,
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
(12, 3, '304', 3, 35.00, 'occupied', 0, NULL, NULL),
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
  `description` text DEFAULT NULL,
  `capacity` int(11) DEFAULT NULL,
  `defaultPrice` decimal(15,2) DEFAULT NULL,
  `isDeleted` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(50) NOT NULL DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `room_types`
--

INSERT INTO `room_types` (`id`, `typeName`, `description`, `capacity`, `defaultPrice`, `isDeleted`, `status`) VALUES
(1, 'Standard', 'Phong tieu chuan', 2, 500000.00, 0, 'active'),
(2, 'Superior', 'Phong superior', 2, 700000.00, 0, 'active'),
(3, 'Deluxe', 'Phong deluxe', 3, 900000.00, 0, 'active'),
(4, 'Family', 'Phong gia dinh', 4, 1200000.00, 0, 'active'),
(5, 'Suite', 'Phong tong thong', 4, 2000000.00, 0, 'active');

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
(10, 'Kê thêm giường', 250000.00, 'Tối đa 1 giường phụ mỗi phòng; đăng ký trước 18:00 ngày nhận phòng.');

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
(7, 'SIUU', 'percentage', 2.00, 500000.00, 12.00, 1, '2026-06-25', '2026-06-30', 'active'),
(8, 'NOSHOW24501VPG', 'percentage', 10.00, NULL, NULL, 1, '2026-07-11', '2026-10-09', 'active'),
(9, 'NOSHOW33XCNVU9', 'percentage', 10.00, NULL, NULL, 1, '2026-07-17', '2026-10-15', 'active'),
(10, 'NOSHOW377KQJTI', 'percentage', 10.00, NULL, NULL, 1, '2026-07-17', '2026-10-15', 'active'),
(11, 'NOSHOW38A234SP', 'percentage', 10.00, NULL, NULL, 1, '2026-07-17', '2026-10-15', 'active'),
(12, 'NOSHOW32QVDF5X', 'percentage', 10.00, NULL, NULL, 1, '2026-07-18', '2026-10-16', 'active'),
(13, 'NOSHOW34IWX169', 'percentage', 10.00, NULL, NULL, 1, '2026-07-18', '2026-10-16', 'active'),
(14, 'NOSHOW39TX9VNF', 'percentage', 10.00, NULL, NULL, 1, '2026-07-19', '2026-10-17', 'active'),
(15, 'NOSHOW25N5TA0A', 'percentage', 10.00, NULL, NULL, 1, '2026-07-24', '2026-10-22', 'active'),
(16, 'NOSHOW30VRGEI2', 'percentage', 10.00, NULL, NULL, 1, '2026-07-24', '2026-10-22', 'active'),
(17, 'NOSHOW414ZNKKX', 'percentage', 10.00, NULL, NULL, 0, '2026-07-25', '2026-10-23', 'active'),
(18, 'NOSHOW43JKX0J8', 'percentage', 10.00, NULL, NULL, 1, '2026-07-25', '2026-10-23', 'active'),
(19, 'NOSHOW47TED3XO', 'percentage', 10.00, NULL, NULL, 1, '2026-07-25', '2026-10-23', 'active'),
(20, 'NOSHOW45YYHMEN', 'percentage', 10.00, NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(21, 'NOSHOW49W8QGN5', 'percentage', 10.00, NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(22, 'NOSHOW50EOCPLM', 'percentage', 10.00, NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(23, 'NOSHOW51VILXRX', 'percentage', 10.00, NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(24, 'NOSHOW52BC1499', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(25, 'NOSHOW533VUW3B', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(26, 'NOSHOW540F9DK9', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(27, 'NOSHOW55IIV1W5', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(28, 'NOSHOW567GDM8K', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(29, 'NOSHOW57992L1X', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(30, 'NOSHOW58UPHPNY', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(31, 'NOSHOW60X9HBA9', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(32, 'NOSHOW62K3ZNME', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(33, 'NOSHOW63TRUAVN', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(34, 'NOSHOW64Y3ZXC2', 'percentage', 10.00, NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active');

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
  ADD KEY `voucherId` (`voucherId`);

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
  ADD KEY `roomId` (`roomId`);

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
  ADD KEY `userId` (`userId`),
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
  ADD KEY `bookingId` (`bookingId`);

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
  ADD KEY `customerId` (`customerId`);

--
-- Chỉ mục cho bảng `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `roomTypeId` (`roomTypeId`);

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
  ADD CONSTRAINT `booking_services_ibfk_2` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`);

--
-- Các ràng buộc cho bảng `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  ADD CONSTRAINT `booking_service_requests_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `booking_service_requests_ibfk_2` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`) ON DELETE CASCADE;

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
  ADD CONSTRAINT `customer_vouchers_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `customer_vouchers_ibfk_2` FOREIGN KEY (`voucherId`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `customer_vouchers_ibfk_3` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE SET NULL;

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
  ADD CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`);

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
  ADD CONSTRAINT `payment_confirmation_requests_ibfk_3` FOREIGN KEY (`confirmedBy`) REFERENCES `accounts` (`id`) ON DELETE SET NULL;

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
