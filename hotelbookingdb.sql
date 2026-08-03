-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Aug 01, 2026 at 02:58 PM
-- Server version: 8.0.30
-- PHP Version: 8.1.10

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
(13, NULL, 'quyhoanfk123@gmail.com', '0393166495', '$2b$10$aX3i4EsWE/HiNNhuc9HusuBqZuPfEHQA0w4D7RKRcIicchpf1gyxa', 'customer', 'active', '2026-06-24 20:54:22', '2026-06-24 13:54:22', '2026-06-24 13:54:22'),
(14, NULL, 'dohoan170706@gmail.com', '0393166495', '$2b$10$0c7aSk9mwPXr.VSw1W9niezVqOxedQpSA5HndYJ.2ULtf3k9XVpce', 'customer', 'active', '2026-07-02 22:47:28', '2026-07-02 15:47:28', '2026-07-02 15:47:28');

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
-- Table structure for table `app_settings`
--

CREATE TABLE `app_settings` (
  `settingKey` varchar(100) NOT NULL,
  `settingValue` text NOT NULL,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `cancellation_reason` text,
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

INSERT INTO `bookings` (`id`, `user_id`, `room_id`, `check_in`, `check_out`, `total_price`, `status`, `notes`, `cancellation_reason`, `guest_name`, `guest_email`, `guest_phone`, `customerId`, `voucherId`, `bookingCode`, `bookingStatus`, `totalAmount`, `createdAt`, `created_at`) VALUES
(1, NULL, NULL, NULL, NULL, '900000.00', 'pending', NULL, NULL, NULL, NULL, NULL, 1, 1, 'BK001', 'confirmed', '900000.00', '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(2, NULL, NULL, NULL, NULL, '1350000.00', 'cancelled', NULL, NULL, NULL, NULL, NULL, 2, 2, 'BK002', 'cancelled', '1350000.00', '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(3, NULL, NULL, NULL, NULL, '2600000.00', 'pending', NULL, NULL, NULL, NULL, NULL, 3, 3, 'BK003', 'checkout', '2600000.00', '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(4, NULL, NULL, NULL, NULL, '1200000.00', 'cancelled', NULL, NULL, NULL, NULL, NULL, 4, NULL, 'BK004', 'cancelled', '1200000.00', '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(5, NULL, NULL, NULL, NULL, '1800000.00', 'pending', NULL, NULL, NULL, NULL, NULL, 5, 1, 'BK005', 'confirmed', '1800000.00', '2026-06-10 23:26:20', '2026-06-23 18:33:42'),
(7, 12, 1, '2026-06-24', '2026-07-25', '15500000.00', 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'confirmed', '15500000.00', '2026-06-24 01:37:20', '2026-06-23 18:37:20'),
(8, 12, 3, '2026-06-24', '2026-07-22', '14000000.00', 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'confirmed', '14000000.00', '2026-06-24 01:47:03', '2026-06-23 18:47:03'),
(9, 12, 2, '2026-06-25', '2026-07-01', '3000000.00', 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', '3000000.00', '2026-06-24 01:52:06', '2026-06-23 18:52:06'),
(10, 12, 8, '2026-06-25', '2026-07-01', '4200000.00', 'cancelled', NULL, NULL, 'Minh Tài', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', '4200000.00', '2026-06-24 02:05:29', '2026-06-23 19:05:29'),
(11, 12, 2, '2026-06-24', '2026-07-01', '3500000.00', 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', '3500000.00', '2026-06-24 02:33:25', '2026-06-23 19:33:25'),
(12, 12, 1, '2026-06-24', '2026-07-01', '3500000.00', 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', '3500000.00', '2026-06-24 07:28:47', '2026-06-24 00:28:47'),
(13, 12, 1, '2026-06-24', '2026-07-01', '3500000.00', 'cancelled', NULL, NULL, 'Hà Phương Thúy', 'tranphuhuong1802@gmail.com', '0909999999', 7, NULL, NULL, 'cancelled', '3500000.00', '2026-06-24 14:52:37', '2026-06-24 07:52:37'),
(14, 13, 1, '2026-06-26', '2026-07-24', '14000000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'confirmed', '14000000.00', '2026-06-24 20:57:08', '2026-06-24 13:57:08'),
(15, 13, 1, '2026-06-24', '2026-07-24', '15000000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '15000000.00', '2026-06-24 21:07:36', '2026-06-24 14:07:36'),
(16, 13, 4, '2026-06-26', '2026-07-24', '14000000.00', 'cancelled', NULL, NULL, 'ok', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '14000000.00', '2026-06-24 21:38:57', '2026-06-24 14:38:57'),
(17, 13, 5, '2026-06-25', '2026-07-22', '18900000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '18900000.00', '2026-06-24 22:17:09', '2026-06-24 15:17:09'),
(18, 13, 1, '2026-06-27', '2026-07-30', '16500000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '16500000.00', '2026-06-25 20:34:12', '2026-06-25 13:34:12'),
(19, 13, 2, '2026-07-30', '2026-07-31', '500000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '500000.00', '2026-06-25 20:55:04', '2026-06-25 13:55:04'),
(20, 13, 7, '2026-06-29', '2026-07-23', '16800000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '16800000.00', '2026-06-25 21:16:38', '2026-06-25 14:16:38'),
(21, 13, 6, '2026-07-29', '2026-08-28', '21000000.00', 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '21000000.00', '2026-07-02 19:28:35', '2026-07-02 12:28:35'),
(22, 13, 1, '2026-07-16', '2026-08-13', '14000000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '14000000.00', '2026-07-02 19:50:12', '2026-07-02 12:50:12'),
(23, 13, 1, '2026-07-17', '2026-08-13', '13500000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '13500000.00', '2026-07-02 22:13:59', '2026-07-02 15:13:59'),
(24, 13, 1, '2026-07-02', '2026-07-03', '500000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '500000.00', '2026-07-02 22:17:02', '2026-07-02 15:17:02'),
(25, 13, 9, '2026-07-23', '2026-08-20', '25200000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '25200000.00', '2026-07-11 13:40:46', '2026-07-11 06:40:46'),
(26, 13, 13, '2026-07-23', '2026-08-20', '33600000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '33600000.00', '2026-07-11 13:50:24', '2026-07-11 06:50:24'),
(27, 13, 13, '2026-07-30', '2026-08-19', '24000000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '24000000.00', '2026-07-11 13:54:45', '2026-07-11 06:54:45'),
(28, 13, 17, '2026-07-17', '2026-08-11', '50000000.00', 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '50000000.00', '2026-07-11 14:16:38', '2026-07-11 07:16:38'),
(29, 13, 5, '2026-07-29', '2026-08-26', '19600000.00', 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '19600000.00', '2026-07-14 13:55:14', '2026-07-14 06:55:14'),
(30, 13, 13, '2026-07-21', '2026-08-18', '33600000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '33600000.00', '2026-07-14 14:59:48', '2026-07-14 07:59:48'),
(31, 13, 1, '2026-07-16', '2026-07-17', '500000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '500000.00', '2026-07-15 23:34:45', '2026-07-15 16:34:45'),
(32, 1, 10, '2026-07-17', '2026-08-20', '30600000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 6, NULL, NULL, 'no_show', '30600000.00', '2026-07-15 23:57:26', '2026-07-15 16:57:26'),
(33, 13, 9, '2026-07-16', '2026-07-17', '900000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '900000.00', '2026-07-16 11:15:58', '2026-07-16 04:15:58'),
(34, 13, 9, '2026-07-17', '2026-07-18', '900000.00', 'no_show', NULL, NULL, 'hon', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '900000.00', '2026-07-16 12:24:52', '2026-07-16 05:24:52'),
(35, 13, 1, '2026-07-29', '2026-07-30', '500000.00', 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '500000.00', '2026-07-16 13:08:35', '2026-07-16 06:08:35'),
(36, 13, 1, '2026-07-17', '2026-08-09', '11500000.00', 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '11500000.00', '2026-07-16 13:24:16', '2026-07-16 06:24:16'),
(37, 13, 2, '2026-07-16', '2026-08-07', '11000000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '11000000.00', '2026-07-16 13:25:26', '2026-07-16 06:25:26'),
(38, 13, 1, '2026-07-16', '2026-08-10', '12500000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '12500000.00', '2026-07-16 21:46:17', '2026-07-16 14:46:17'),
(39, 13, 5, '2026-07-18', '2026-07-19', '700000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '700000.00', '2026-07-18 22:22:36', '2026-07-18 15:22:36'),
(40, 13, 17, '2026-07-29', '2026-07-30', '2000000.00', 'cancelled', NULL, NULL, 'hon', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '2000000.00', '2026-07-19 00:02:28', '2026-07-18 17:02:28'),
(41, 13, 9, '2026-07-24', '2026-08-17', '21600000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '21600000.00', '2026-07-24 14:15:34', '2026-07-24 07:15:34'),
(42, 13, 10, '2026-07-30', '2026-08-24', '22500000.00', 'cancelled', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '22500000.00', '2026-07-24 19:56:26', '2026-07-24 12:56:26'),
(43, 13, 5, '2026-07-24', '2026-07-25', '900000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '900000.00', '2026-07-24 20:05:55', '2026-07-24 13:05:55'),
(44, 13, 17, '2026-07-24', '2026-07-25', '2000000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '2000000.00', '2026-07-24 20:52:32', '2026-07-24 13:52:32'),
(45, 13, 10, '2026-07-25', '2026-07-26', '900000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '900000.00', '2026-07-24 20:54:31', '2026-07-24 13:54:31'),
(46, 13, 10, '2026-07-24', '2026-07-25', '1100000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '1100000.00', '2026-07-24 21:19:11', '2026-07-24 14:19:11'),
(47, 13, 11, '2026-07-24', '2026-07-25', '1100000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '1100000.00', '2026-07-24 21:31:52', '2026-07-24 14:31:52'),
(48, 13, 13, '2026-07-25', '2026-07-26', '1400000.00', 'cancelled', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '1400000.00', '2026-07-25 15:40:17', '2026-07-25 08:40:17'),
(49, 13, 9, '2026-07-25', '2026-07-26', '900000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '900000.00', '2026-07-25 16:10:19', '2026-07-25 09:10:19'),
(50, 13, 13, '2026-07-25', '2026-07-26', '1200000.00', 'no_show', NULL, NULL, 'hoan', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '1200000.00', '2026-07-25 22:16:53', '2026-07-25 15:16:53'),
(51, 13, 1, '2026-07-25', '2026-07-31', '3000000.00', 'no_show', NULL, NULL, 'hon', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '3000000.00', '2026-07-25 22:22:20', '2026-07-25 15:22:20'),
(52, 13, 9, '2026-07-29', '2026-07-30', '900000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '900000.00', '2026-07-29 19:30:37', '2026-07-29 12:30:37'),
(53, 13, 10, '2026-07-29', '2026-07-30', '900000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '900000.00', '2026-07-29 19:33:15', '2026-07-29 12:33:15'),
(54, 13, 5, '2026-07-30', '2026-07-31', '700000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '700000.00', '2026-07-29 19:36:24', '2026-07-29 12:36:24'),
(55, 13, 6, '2026-07-29', '2026-08-01', '2100000.00', 'no_show', NULL, NULL, 'HOAN', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '2100000.00', '2026-07-29 19:38:34', '2026-07-29 12:38:34'),
(56, 13, 9, '2026-07-30', '2026-08-04', '4500000.00', 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '4500000.00', '2026-07-29 20:09:39', '2026-07-29 13:09:39'),
(57, 13, 13, '2026-07-30', '2026-08-02', '3600000.00', 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '3600000.00', '2026-07-29 20:11:07', '2026-07-29 13:11:07'),
(58, 13, 14, '2026-07-29', '2026-08-01', '3600000.00', 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '3600000.00', '2026-07-29 20:19:32', '2026-07-29 13:19:32'),
(59, 13, 11, '2026-07-29', '2026-07-30', '900000.00', 'checked_out', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'checked_out', '900000.00', '2026-07-29 20:23:02', '2026-07-29 13:23:02'),
(60, 13, 10, '2026-07-30', '2026-08-14', '13500000.00', 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '13500000.00', '2026-07-29 20:24:36', '2026-07-29 13:24:36'),
(61, 13, 11, '2026-07-29', '2026-07-30', '900000.00', 'cancelled', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'cancelled', '900000.00', '2026-07-29 20:50:57', '2026-07-29 13:50:57'),
(62, 13, 13, '2026-07-29', '2026-07-30', '1200000.00', 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '1200000.00', '2026-07-29 21:11:47', '2026-07-29 14:11:47'),
(63, 13, 11, '2026-07-29', '2026-08-02', '3600000.00', 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, NULL, NULL, 'no_show', '3600000.00', '2026-07-29 21:17:45', '2026-07-29 14:17:45'),
(64, 13, 5, '2026-07-29', '2026-07-30', '700000.00', 'no_show', NULL, NULL, 'quyhoanfk123', 'quyhoanfk123@gmail.com', '0393166495', 8, 17, NULL, 'no_show', '700000.00', '2026-07-29 21:21:22', '2026-07-29 14:21:22');

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
  `roomPrice` decimal(15,2) DEFAULT NULL,
  `occupancySurcharge` decimal(15,2) NOT NULL DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `booking_details`
--

INSERT INTO `booking_details` (`id`, `bookingId`, `roomId`, `checkInDate`, `checkOutDate`, `adults`, `children`, `roomPrice`, `occupancySurcharge`) VALUES
(1, 1, 1, '2026-06-10', '2026-06-12', 2, 0, '500000.00', '0.00'),
(2, 2, 5, '2026-06-15', '2026-06-17', 2, 1, '700000.00', '0.00'),
(3, 3, 9, '2026-06-20', '2026-06-23', 3, 1, '900000.00', '0.00'),
(4, 4, 13, '2026-06-22', '2026-06-24', 4, 0, '1200000.00', '0.00'),
(5, 5, 17, '2026-06-25', '2026-06-27', 2, 0, '2000000.00', '0.00'),
(7, 7, 1, '2026-06-24', '2026-07-25', 2, 0, '500000.00', '0.00'),
(8, 8, 3, '2026-06-24', '2026-07-22', 2, 0, '500000.00', '0.00'),
(9, 9, 2, '2026-06-25', '2026-07-01', 2, 0, '500000.00', '0.00'),
(10, 10, 8, '2026-06-25', '2026-07-01', 2, 0, '700000.00', '0.00'),
(11, 11, 2, '2026-06-24', '2026-07-01', 2, 0, '500000.00', '0.00'),
(12, 12, 1, '2026-06-24', '2026-07-01', 2, 0, '500000.00', '0.00'),
(13, 13, 1, '2026-06-24', '2026-07-01', 2, 0, '500000.00', '0.00'),
(14, 14, 1, '2026-06-26', '2026-07-24', 2, 0, '500000.00', '0.00'),
(15, 15, 1, '2026-06-24', '2026-07-24', 2, 0, '500000.00', '0.00'),
(16, 16, 4, '2026-06-26', '2026-07-24', 2, 0, '500000.00', '0.00'),
(17, 17, 5, '2026-06-25', '2026-07-22', 2, 0, '700000.00', '0.00'),
(18, 18, 1, '2026-06-27', '2026-07-30', 2, 0, '500000.00', '0.00'),
(19, 19, 2, '2026-07-30', '2026-07-31', 2, 0, '500000.00', '0.00'),
(20, 20, 7, '2026-06-29', '2026-07-23', 2, 0, '700000.00', '0.00'),
(21, 21, 6, '2026-07-29', '2026-08-28', 2, 0, '700000.00', '0.00'),
(22, 22, 1, '2026-07-16', '2026-08-13', 2, 0, '500000.00', '0.00'),
(23, 23, 1, '2026-07-17', '2026-08-13', 2, 0, '500000.00', '0.00'),
(24, 24, 1, '2026-07-02', '2026-07-03', 2, 0, '500000.00', '0.00'),
(25, 25, 9, '2026-07-23', '2026-08-20', 2, 1, '900000.00', '0.00'),
(26, 26, 13, '2026-07-23', '2026-08-20', 2, 2, '1200000.00', '0.00'),
(27, 27, 13, '2026-07-30', '2026-08-19', 2, 0, '1200000.00', '0.00'),
(28, 28, 17, '2026-07-17', '2026-08-11', 2, 0, '2000000.00', '0.00'),
(29, 29, 5, '2026-07-29', '2026-08-26', 2, 0, '700000.00', '0.00'),
(30, 30, 13, '2026-07-21', '2026-08-18', 2, 0, '1200000.00', '0.00'),
(31, 31, 1, '2026-07-16', '2026-07-17', 2, 0, '500000.00', '0.00'),
(32, 32, 10, '2026-07-17', '2026-08-20', 2, 0, '900000.00', '0.00'),
(33, 33, 9, '2026-07-16', '2026-07-17', 2, 0, '900000.00', '0.00'),
(34, 34, 9, '2026-07-17', '2026-07-18', 2, 0, '900000.00', '0.00'),
(35, 35, 1, '2026-07-29', '2026-07-30', 2, 0, '500000.00', '0.00'),
(36, 36, 1, '2026-07-17', '2026-08-09', 2, 0, '500000.00', '0.00'),
(37, 37, 2, '2026-07-16', '2026-08-07', 2, 0, '500000.00', '0.00'),
(38, 38, 1, '2026-07-16', '2026-08-10', 2, 0, '500000.00', '0.00'),
(39, 39, 5, '2026-07-18', '2026-07-19', 2, 0, '700000.00', '0.00'),
(40, 40, 17, '2026-07-29', '2026-07-30', 2, 0, '2000000.00', '0.00'),
(41, 41, 9, '2026-07-24', '2026-08-17', 2, 0, '900000.00', '0.00'),
(42, 42, 10, '2026-07-30', '2026-08-24', 2, 1, '900000.00', '0.00'),
(43, 43, 5, '2026-07-24', '2026-07-25', 1, 1, '700000.00', '200000.00'),
(44, 44, 17, '2026-07-24', '2026-07-25', 2, 0, '2000000.00', '0.00'),
(45, 45, 10, '2026-07-25', '2026-07-26', 2, 0, '900000.00', '0.00'),
(46, 46, 10, '2026-07-24', '2026-07-25', 1, 1, '900000.00', '200000.00'),
(47, 47, 11, '2026-07-24', '2026-07-25', 1, 1, '900000.00', '200000.00'),
(48, 48, 13, '2026-07-25', '2026-07-26', 1, 1, '1200000.00', '200000.00'),
(49, 49, 9, '2026-07-25', '2026-07-26', 2, 0, '900000.00', '0.00'),
(50, 50, 13, '2026-07-25', '2026-07-26', 2, 0, '1200000.00', '0.00'),
(51, 51, 1, '2026-07-25', '2026-07-31', 2, 0, '500000.00', '0.00'),
(52, 52, 9, '2026-07-29', '2026-07-30', 2, 0, '900000.00', '0.00'),
(53, 53, 10, '2026-07-29', '2026-07-30', 2, 0, '900000.00', '0.00'),
(54, 54, 5, '2026-07-30', '2026-07-31', 2, 0, '700000.00', '0.00'),
(55, 55, 6, '2026-07-29', '2026-08-01', 2, 0, '700000.00', '0.00'),
(56, 56, 9, '2026-07-30', '2026-08-04', 2, 0, '900000.00', '0.00'),
(57, 57, 13, '2026-07-30', '2026-08-02', 2, 0, '1200000.00', '0.00'),
(58, 58, 14, '2026-07-29', '2026-08-01', 2, 0, '1200000.00', '0.00'),
(59, 59, 11, '2026-07-29', '2026-07-30', 2, 0, '900000.00', '0.00'),
(60, 60, 10, '2026-07-30', '2026-08-14', 2, 0, '900000.00', '0.00'),
(61, 61, 11, '2026-07-29', '2026-07-30', 2, 0, '900000.00', '0.00'),
(62, 62, 13, '2026-07-29', '2026-07-30', 2, 0, '1200000.00', '0.00'),
(63, 63, 11, '2026-07-29', '2026-08-02', 2, 0, '900000.00', '0.00'),
(64, 64, 5, '2026-07-29', '2026-07-30', 2, 0, '700000.00', '0.00');

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

--
-- Dumping data for table `booking_guests`
--

INSERT INTO `booking_guests` (`id`, `bookingId`, `fullName`, `identityNumber`, `phone`, `note`, `createdAt`) VALUES
(1, 59, 'quyhoanfk123', '11111111111', '0393166495', NULL, '2026-07-29 20:36:54');

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
(1, 1, 1, 2, '300000.00'),
(2, 2, 2, 1, '100000.00'),
(3, 3, 3, 2, '600000.00'),
(4, 4, 5, 1, '200000.00'),
(5, 5, 7, 1, '400000.00'),
(6, 40, 4, 1, '500000.00'),
(7, 43, 7, 2, '800000.00'),
(8, 40, 6, 1, '350000.00'),
(9, 44, 6, 1, '350000.00'),
(10, 45, 7, 2, '800000.00');

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

--
-- Dumping data for table `booking_service_requests`
--

INSERT INTO `booking_service_requests` (`id`, `bookingId`, `serviceId`, `quantity`, `status`, `note`, `createdAt`) VALUES
(1, 23, 4, 1, 'pending', NULL, '2026-07-02 22:13:59'),
(2, 25, 6, 1, 'pending', NULL, '2026-07-11 13:40:46'),
(3, 40, 4, 1, 'confirmed', NULL, '2026-07-19 00:02:28'),
(4, 40, 6, 1, 'confirmed', NULL, '2026-07-19 00:02:28'),
(5, 42, 4, 2, 'rejected', NULL, '2026-07-24 19:56:26'),
(6, 43, 7, 2, 'confirmed', NULL, '2026-07-24 20:05:55'),
(7, 44, 6, 1, 'confirmed', NULL, '2026-07-24 20:52:32'),
(8, 45, 7, 2, 'confirmed', NULL, '2026-07-24 20:54:31'),
(9, 47, 2, 1, 'pending', NULL, '2026-07-24 21:31:52'),
(10, 52, 5, 1, 'pending', NULL, '2026-07-29 19:30:37');

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
(8, 13, 'quyhoanfk123@gmail.com', '0393166495', NULL, NULL, NULL, NULL, NULL),
(9, 14, 'dohoan170706', '0393166495', NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `customer_vouchers`
--

CREATE TABLE `customer_vouchers` (
  `id` int NOT NULL,
  `userId` int NOT NULL,
  `voucherId` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `source` varchar(50) DEFAULT 'no_show',
  `isUsed` tinyint(1) DEFAULT '0',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customer_vouchers`
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
(1, 2, 3, 'May say toc bi vo', '300000.00', '2026-06-10 23:26:20'),
(2, 3, 4, 'Mini bar hong', '500000.00', '2026-06-10 23:26:20'),
(3, 5, 10, 'Den ban bi hu', '200000.00', '2026-06-10 23:26:20');

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
(1, 2, 'Nguyen Le Staff', '0901234567', 'Receptionist', '12000000.00', '2025-01-01'),
(2, 3, 'Tran Staff', '0908888888', 'Manager', '18000000.00', '2025-01-01');

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `paymentId` int DEFAULT NULL,
  `invoiceCode` varchar(100) DEFAULT NULL,
  `roomAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `serviceAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `surchargeAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `invoiceDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `subtotal` decimal(15,2) DEFAULT NULL,
  `discountAmount` decimal(15,2) DEFAULT NULL,
  `taxAmount` decimal(15,2) DEFAULT NULL,
  `totalAmount` decimal(15,2) DEFAULT NULL,
  `note` text,
  `status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `invoices`
--

INSERT INTO `invoices` (`id`, `bookingId`, `paymentId`, `invoiceCode`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `invoiceDate`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `note`, `status`) VALUES
(1, 14, 14, 'HD202606-00001', '0.00', '0.00', '0.00', '2026-06-24 20:58:17', '14000000.00', '0.00', '0.00', '14000000.00', NULL, 'issued'),
(2, 15, 15, 'HD202606-00002', '0.00', '0.00', '0.00', '2026-06-24 21:07:54', '15000000.00', '0.00', '0.00', '15000000.00', NULL, 'issued'),
(3, 16, 16, 'HD202606-00003', '0.00', '0.00', '0.00', '2026-06-24 21:44:14', '14000000.00', '0.00', '0.00', '14000000.00', NULL, 'issued'),
(4, 17, 17, 'HD202606-00004', '0.00', '0.00', '0.00', '2026-06-25 20:52:01', '18900000.00', '0.00', '0.00', '18900000.00', NULL, 'issued'),
(5, 18, 18, 'HD202606-00005', '0.00', '0.00', '0.00', '2026-06-25 20:53:19', '16500000.00', '0.00', '0.00', '16500000.00', NULL, 'issued'),
(6, 20, 20, 'HD202607-00001', '0.00', '0.00', '0.00', '2026-07-02 19:48:07', '16800000.00', '0.00', '0.00', '16800000.00', NULL, 'issued'),
(7, 23, 23, 'HD202607-00002', '0.00', '0.00', '0.00', '2026-07-02 22:14:44', '13500000.00', '0.00', '0.00', '13500000.00', NULL, 'issued'),
(8, 26, 26, 'HD202607-00003', '0.00', '0.00', '0.00', '2026-07-11 13:50:55', '33600000.00', '0.00', '0.00', '33600000.00', NULL, 'issued'),
(9, 27, 27, 'HD202607-00004', '0.00', '0.00', '0.00', '2026-07-11 14:05:24', '24000000.00', '0.00', '0.00', '24000000.00', NULL, 'issued'),
(10, 25, 25, 'HD202607-00005', '0.00', '0.00', '0.00', '2026-07-11 14:14:27', '25200000.00', '0.00', '0.00', '25200000.00', NULL, 'issued'),
(11, 33, 33, 'HD202607-00006', '0.00', '0.00', '0.00', '2026-07-16 12:05:26', '900000.00', '0.00', '0.00', '900000.00', NULL, 'issued'),
(12, 32, 32, 'HD202607-00007', '0.00', '0.00', '0.00', '2026-07-16 12:22:06', '30600000.00', '0.00', '0.00', '30600000.00', NULL, 'issued'),
(13, 34, 34, 'HD202607-00008', '0.00', '0.00', '0.00', '2026-07-16 12:49:23', '900000.00', '0.00', '0.00', '900000.00', NULL, 'issued'),
(14, 30, 30, 'HD202607-00009', '0.00', '0.00', '0.00', '2026-07-16 12:59:41', '33600000.00', '0.00', '0.00', '33600000.00', NULL, 'issued'),
(15, 24, 24, 'HD202607-00010', '0.00', '0.00', '0.00', '2026-07-16 13:03:30', '500000.00', '0.00', '0.00', '500000.00', NULL, 'issued'),
(16, 37, 37, 'HD202607-00011', '0.00', '0.00', '0.00', '2026-07-16 13:30:01', '11000000.00', '0.00', '0.00', '11000000.00', NULL, 'issued'),
(17, 38, 38, 'HD202607-00012', '0.00', '0.00', '0.00', '2026-07-16 21:49:07', '12500000.00', '0.00', '0.00', '12500000.00', NULL, 'issued'),
(18, 39, 39, 'HD202607-00013', '700000.00', '0.00', '0.00', '2026-07-18 22:23:27', '700000.00', '0.00', '0.00', '700000.00', NULL, 'issued'),
(19, 41, 41, 'HD202607-00014', '21600000.00', '0.00', '0.00', '2026-07-24 14:17:03', '21600000.00', '0.00', '0.00', '21600000.00', NULL, 'issued'),
(20, 40, 40, 'HD202607-00015', '2000000.00', '500000.00', '0.00', '2026-07-24 19:35:49', '2500000.00', '0.00', '0.00', '2500000.00', NULL, 'issued'),
(21, 45, 45, 'HD202607-00016', '900000.00', '800000.00', '0.00', '2026-07-24 20:57:25', '1700000.00', '0.00', '0.00', '1700000.00', NULL, 'issued'),
(22, 47, 47, 'HD202607-00017', '900000.00', '0.00', '200000.00', '2026-07-25 16:01:00', '1100000.00', '0.00', '0.00', '1100000.00', NULL, 'issued'),
(23, 49, 49, 'HD202607-00018', '900000.00', '0.00', '0.00', '2026-07-25 16:45:51', '900000.00', '0.00', '0.00', '900000.00', NULL, 'issued'),
(24, 50, 50, 'HD202607-00019', '1200000.00', '0.00', '0.00', '2026-07-25 22:17:42', '1200000.00', '0.00', '0.00', '1200000.00', NULL, 'issued'),
(25, 51, 51, 'HD202607-00020', '3000000.00', '0.00', '0.00', '2026-07-25 22:22:41', '3000000.00', '0.00', '0.00', '3000000.00', NULL, 'issued'),
(26, 52, 52, 'HD202607-00021', '900000.00', '0.00', '0.00', '2026-07-29 19:31:25', '900000.00', '0.00', '0.00', '900000.00', NULL, 'issued'),
(27, 43, 43, 'HD202607-00022', '700000.00', '800000.00', '200000.00', '2026-07-29 19:32:39', '1700000.00', '0.00', '0.00', '1700000.00', NULL, 'issued'),
(28, 53, 53, 'HD202607-00023', '900000.00', '0.00', '0.00', '2026-07-29 19:35:51', '900000.00', '0.00', '0.00', '900000.00', NULL, 'issued'),
(29, 54, 54, 'HD202607-00024', '700000.00', '0.00', '0.00', '2026-07-29 19:38:14', '700000.00', '0.00', '0.00', '700000.00', NULL, 'issued'),
(30, 55, 55, 'HD202607-00025', '2100000.00', '0.00', '0.00', '2026-07-29 20:01:02', '2100000.00', '0.00', '0.00', '2100000.00', NULL, 'issued'),
(31, 56, 56, 'HD202607-00026', '4500000.00', '0.00', '0.00', '2026-07-29 20:10:42', '4500000.00', '0.00', '0.00', '4500000.00', NULL, 'issued'),
(32, 57, 57, 'HD202607-00027', '3600000.00', '0.00', '0.00', '2026-07-29 20:11:46', '3600000.00', '0.00', '0.00', '3600000.00', NULL, 'issued'),
(33, 58, 58, 'HD202607-00028', '3600000.00', '0.00', '0.00', '2026-07-29 20:22:40', '3600000.00', '0.00', '0.00', '3600000.00', NULL, 'issued'),
(34, 60, 60, 'HD202607-00029', '13500000.00', '0.00', '0.00', '2026-07-29 20:34:38', '13500000.00', '0.00', '0.00', '13500000.00', NULL, 'issued'),
(35, 59, 59, 'HD202607-00030', '900000.00', '0.00', '0.00', '2026-07-29 20:36:43', '900000.00', '0.00', '0.00', '900000.00', NULL, 'issued'),
(36, 62, 62, 'HD202607-00031', '1200000.00', '0.00', '0.00', '2026-07-29 21:12:01', '1200000.00', '0.00', '0.00', '1200000.00', NULL, 'issued'),
(37, 63, 63, 'HD202607-00032', '3600000.00', '0.00', '0.00', '2026-07-29 21:18:14', '3600000.00', '0.00', '0.00', '3600000.00', NULL, 'issued');

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
  `paymentDate` datetime DEFAULT NULL,
  `voucherCode` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`id`, `bookingId`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `discountAmount`, `depositAmount`, `paidAmount`, `remainingAmount`, `totalAmount`, `paymentMethod`, `paymentStatus`, `transactionCode`, `paymentDate`, `voucherCode`) VALUES
(1, 1, '1000000.00', '0.00', '0.00', '100000.00', '300000.00', '900000.00', '0.00', '900000.00', 'cash', 'paid', 'TXN001', '2026-06-10 10:00:00', NULL),
(2, 2, '1400000.00', '0.00', '0.00', '50000.00', '500000.00', '500000.00', '850000.00', '1350000.00', 'momo', 'deposit_paid', 'TXN002', '2026-06-15 09:00:00', NULL),
(3, 3, '2700000.00', '200000.00', '0.00', '300000.00', '1000000.00', '2600000.00', '0.00', '2600000.00', 'vnpay', 'paid', 'TXN003', '2026-06-20 14:00:00', NULL),
(4, 4, '1200000.00', '0.00', '0.00', '0.00', '500000.00', '500000.00', '700000.00', '1200000.00', 'cash', 'deposit_paid', 'TXN004', '2026-06-22 15:00:00', NULL),
(5, 5, '2000000.00', '0.00', '0.00', '200000.00', '1000000.00', '1800000.00', '0.00', '1800000.00', 'vnpay', 'paid', 'TXN005', '2026-06-25 11:00:00', NULL),
(7, 7, '15500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '15500000.00', '15500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(8, 8, '14000000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '14000000.00', '14000000.00', NULL, 'unpaid', NULL, NULL, NULL),
(9, 9, '3000000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '3000000.00', '3000000.00', NULL, 'unpaid', NULL, NULL, NULL),
(10, 10, '4200000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '4200000.00', '4200000.00', NULL, 'unpaid', NULL, NULL, NULL),
(11, 11, '3500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '3500000.00', '3500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(12, 12, '3500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '3500000.00', '3500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(13, 13, '3500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '3500000.00', '3500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(14, 14, '14000000.00', '0.00', '0.00', '0.00', '0.00', '14000000.00', '0.00', '14000000.00', 'cash', 'paid', 'CASH-MQS521R4-1B8YT0', '2026-06-24 20:58:17', NULL),
(15, 15, '15000000.00', '0.00', '0.00', '0.00', '0.00', '15000000.00', '0.00', '15000000.00', 'cash', 'paid', 'CASH-MQS5EEWF-9HIIM3', '2026-06-24 21:07:54', NULL),
(16, 16, '14000000.00', '0.00', '0.00', '0.00', '0.00', '14000000.00', '0.00', '14000000.00', 'vnpay', 'paid', 'VNPAY-MQS6P5AN-FYXJU4', '2026-06-24 21:44:15', NULL),
(17, 17, '18900000.00', '0.00', '0.00', '0.00', '0.00', '18900000.00', '0.00', '18900000.00', 'cash', 'paid', 'CASH-MQTK9U0B-9MJRPI', '2026-06-25 20:52:01', NULL),
(18, 18, '16500000.00', '0.00', '0.00', '0.00', '0.00', '16500000.00', '0.00', '16500000.00', 'cash', 'paid', 'CASH-MQTKBIHL-K17WPA', '2026-06-25 20:53:19', NULL),
(19, 19, '500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '500000.00', '500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(20, 20, '16800000.00', '0.00', '0.00', '0.00', '0.00', '16800000.00', '0.00', '16800000.00', 'cash', 'paid', 'CASH-MR3I2MY7-X59R6G', '2026-07-02 19:48:08', NULL),
(21, 21, '21000000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '21000000.00', '21000000.00', NULL, 'unpaid', NULL, NULL, NULL),
(22, 22, '14000000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '14000000.00', '14000000.00', NULL, 'unpaid', NULL, NULL, NULL),
(23, 23, '13500000.00', '0.00', '0.00', '0.00', '0.00', '13500000.00', '0.00', '13500000.00', 'cash', 'paid', 'CASH-MR3NB65Z-VW1C2R', '2026-07-02 22:14:44', NULL),
(24, 24, '500000.00', '0.00', '0.00', '0.00', '0.00', '500000.00', '0.00', '500000.00', 'bank_transfer', 'paid', 'BANK-MRN3S83A-WFKMQV', '2026-07-16 13:03:31', NULL),
(25, 25, '25200000.00', '0.00', '0.00', '0.00', '0.00', '25200000.00', '0.00', '25200000.00', 'vnpay', 'paid', 'VNPAY-MRG14748-VVXTUI', '2026-07-11 14:14:27', NULL),
(26, 26, '33600000.00', '0.00', '0.00', '0.00', '0.00', '33600000.00', '0.00', '33600000.00', 'cash', 'paid', 'CASH-MRG09XOC-XR9JIB', '2026-07-11 13:50:56', NULL),
(27, 27, '24000000.00', '0.00', '0.00', '0.00', '0.00', '24000000.00', '0.00', '24000000.00', 'cash', 'refunded', 'CASH-MRG0SK7G-6EGVC8', '2026-07-11 14:05:25', NULL),
(28, 28, '50000000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '50000000.00', '50000000.00', NULL, 'unpaid', NULL, NULL, NULL),
(29, 29, '19600000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '19600000.00', '19600000.00', 'momo', 'unpaid', 'MOMO-29-1784012667992', NULL, NULL),
(30, 30, '33600000.00', '0.00', '0.00', '0.00', '0.00', '33600000.00', '0.00', '33600000.00', 'vnpay', 'paid', 'VNPAY-MRN3NAY0-JPIRH9', '2026-07-16 12:59:41', NULL),
(31, 31, '500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '500000.00', '500000.00', 'vnpay', 'unpaid', 'VNPAY-31-1784133671241', NULL, NULL),
(32, 32, '30600000.00', '0.00', '0.00', '0.00', '0.00', '30600000.00', '0.00', '30600000.00', 'bank_transfer', 'paid', 'BANK-MRN2AYXM-LD47BY', '2026-07-16 12:22:06', NULL),
(33, 33, '900000.00', '0.00', '0.00', '0.00', '0.00', '900000.00', '0.00', '900000.00', 'bank_transfer', 'paid', 'BANK-MRN1PJ7X-FKTXM7', '2026-07-16 12:05:26', NULL),
(34, 34, '900000.00', '0.00', '0.00', '0.00', '0.00', '900000.00', '0.00', '900000.00', 'vnpay', 'paid', 'VNPAY-MRN3A2A9-6XZWSP', '2026-07-16 12:49:24', NULL),
(35, 35, '500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '500000.00', '500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(36, 36, '11500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '11500000.00', '11500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(37, 37, '11000000.00', '0.00', '0.00', '0.00', '0.00', '11000000.00', '0.00', '11000000.00', 'bank_transfer', 'paid', 'BANK-MRN4QB5I-48K17M', '2026-07-16 13:30:01', NULL),
(38, 38, '12500000.00', '0.00', '0.00', '0.00', '0.00', '12500000.00', '0.00', '12500000.00', 'vnpay', 'paid', 'VNPAY-MRNMK5W9-1NLS21', '2026-07-16 21:49:08', NULL),
(39, 39, '700000.00', '0.00', '0.00', '0.00', '0.00', '700000.00', '0.00', '700000.00', 'bank_transfer', 'paid', 'BANK-MRQIO0JL-Y5W36G', '2026-07-18 22:23:27', NULL),
(40, 40, '2000000.00', '850000.00', '0.00', '0.00', '0.00', '0.00', '2850000.00', '2850000.00', 'cash', 'unpaid', NULL, NULL, NULL),
(41, 41, '21600000.00', '0.00', '0.00', '0.00', '0.00', '21600000.00', '0.00', '21600000.00', 'vnpay', 'paid', 'VNPAY-MRYLXLWJ-B2ST9K', '2026-07-24 14:17:03', NULL),
(42, 42, '22500000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '22500000.00', '22500000.00', NULL, 'unpaid', NULL, NULL, NULL),
(43, 43, '700000.00', '800000.00', '200000.00', '0.00', '510000.00', '1700000.00', '0.00', '1700000.00', 'vnpay', 'paid', 'VNPAY-43-1785328300427', '2026-07-29 19:32:39', NULL),
(44, 44, '2000000.00', '350000.00', '0.00', '0.00', '0.00', '0.00', '2350000.00', '2350000.00', 'vnpay', 'unpaid', 'VNPAY-44-1784901916455', NULL, NULL),
(45, 45, '900000.00', '800000.00', '0.00', '0.00', '0.00', '1700000.00', '0.00', '1700000.00', 'bank_transfer', 'paid', 'BANK-MRZ08HHT-5W031G', '2026-07-24 20:57:25', NULL),
(46, 46, '900000.00', '0.00', '200000.00', '0.00', '0.00', '0.00', '1100000.00', '1100000.00', 'vnpay', 'unpaid', 'VNPAY-46-1784903470991', NULL, NULL),
(47, 47, '900000.00', '0.00', '200000.00', '0.00', '0.00', '1100000.00', '0.00', '1100000.00', 'bank_transfer', 'paid', 'BANK-MS0535F6-72EPA2', '2026-07-25 16:01:01', NULL),
(48, 48, '1200000.00', '0.00', '200000.00', '0.00', '0.00', '0.00', '1400000.00', '1400000.00', 'vnpay', 'unpaid', 'VNPAY-48-1784969017812', NULL, NULL),
(49, 49, '900000.00', '0.00', '0.00', '0.00', '0.00', '900000.00', '0.00', '900000.00', 'vnpay', 'paid', 'VNPAY-49-1784972719422', '2026-07-25 16:45:51', NULL),
(50, 50, '1200000.00', '0.00', '0.00', '0.00', '0.00', '1200000.00', '0.00', '1200000.00', 'vnpay', 'paid', 'VNPAY-50-1784992617701', '2026-07-25 22:17:42', NULL),
(51, 51, '3000000.00', '0.00', '0.00', '0.00', '0.00', '3000000.00', '0.00', '3000000.00', 'bank_transfer', 'paid', 'BANK-MS0IPZUK-F2V2T2', '2026-07-25 22:22:41', NULL),
(52, 52, '900000.00', '0.00', '0.00', '0.00', '0.00', '900000.00', '0.00', '900000.00', 'vnpay', 'paid', 'VNPAY-52-1785328248478', '2026-07-29 19:31:26', NULL),
(53, 53, '900000.00', '0.00', '0.00', '0.00', '0.00', '900000.00', '0.00', '900000.00', 'zalopay', 'paid', '260729_53_1785328530634', '2026-07-29 19:35:51', NULL),
(54, 54, '700000.00', '0.00', '0.00', '0.00', '0.00', '700000.00', '0.00', '700000.00', 'zalopay', 'paid', '260729_54_1785328678162', '2026-07-29 19:38:15', NULL),
(55, 55, '2100000.00', '0.00', '0.00', '0.00', '0.00', '2100000.00', '0.00', '2100000.00', 'bank_transfer', 'paid', 'BANK-MS63F8J2-DQ55WI', '2026-07-29 20:01:02', NULL),
(56, 56, '4500000.00', '0.00', '0.00', '0.00', '0.00', '4500000.00', '0.00', '4500000.00', 'bank_transfer', 'paid', 'BANK-MS63RO6P-3KL8X4', '2026-07-29 20:10:42', NULL),
(57, 57, '3600000.00', '0.00', '0.00', '0.00', '0.00', '3600000.00', '0.00', '3600000.00', 'zalopay', 'paid', '260729_57_1785330673108', '2026-07-29 20:11:46', NULL),
(58, 58, '3600000.00', '0.00', '0.00', '0.00', '0.00', '3600000.00', '0.00', '3600000.00', 'vnpay', 'paid', 'VNPAY-58-1785331317440', '2026-07-29 20:22:41', NULL),
(59, 59, '900000.00', '0.00', '0.00', '0.00', '0.00', '900000.00', '0.00', '900000.00', 'bank_transfer', 'refunded', 'BANK-MS64P4VV-FAEEA6', '2026-07-29 20:36:44', NULL),
(60, 60, '13500000.00', '0.00', '0.00', '0.00', '0.00', '13500000.00', '0.00', '13500000.00', 'bank_transfer', 'paid', 'BANK-MS64MG7S-6PEWGZ', '2026-07-29 20:34:38', NULL),
(61, 61, '900000.00', '0.00', '0.00', '0.00', '0.00', '0.00', '900000.00', '900000.00', NULL, 'unpaid', NULL, NULL, NULL),
(62, 62, '1200000.00', '0.00', '0.00', '0.00', '0.00', '1200000.00', '0.00', '1200000.00', 'bank_transfer', 'paid', 'BANK-MS65YIWX-Q6KJQ8', '2026-07-29 21:12:01', NULL),
(63, 63, '3600000.00', '0.00', '0.00', '0.00', '0.00', '3600000.00', '0.00', '3600000.00', 'bank_transfer', 'paid', 'BANK-MS666IED-LPVFB2', '2026-07-29 21:18:14', NULL),
(64, 64, '700000.00', '0.00', '0.00', '70000.00', '189000.00', '189000.00', '441000.00', '630000.00', 'bank_transfer', 'deposit_paid', 'BANK-MS66MF5U-9JVSM1', '2026-07-29 21:30:36', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `payment_confirmation_requests`
--

CREATE TABLE `payment_confirmation_requests` (
  `id` int NOT NULL,
  `paymentId` int NOT NULL,
  `bookingId` int NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `paymentMethod` varchar(30) NOT NULL DEFAULT 'bank_transfer',
  `status` enum('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
  `note` varchar(500) DEFAULT NULL,
  `submittedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `confirmedBy` int DEFAULT NULL,
  `confirmedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `payment_confirmation_requests`
--

INSERT INTO `payment_confirmation_requests` (`id`, `paymentId`, `bookingId`, `amount`, `paymentMethod`, `status`, `note`, `submittedAt`, `confirmedBy`, `confirmedAt`) VALUES
(1, 33, 33, '630000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-16 11:57:33', 1, '2026-07-16 12:05:26'),
(2, 32, 32, '21420000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-16 12:14:49', 1, '2026-07-16 12:22:06'),
(3, 34, 34, '270000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-16 12:24:59', 1, '2026-07-16 12:25:21'),
(4, 24, 24, '350000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-16 13:02:48', 1, '2026-07-16 13:03:30'),
(6, 35, 35, '150000.00', 'bank_transfer', 'pending', NULL, '2026-07-16 13:08:40', NULL, NULL),
(7, 37, 37, '7700000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-16 13:29:30', 1, '2026-07-16 13:30:01'),
(8, 39, 39, '700000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-18 22:23:01', 1, '2026-07-18 22:23:27'),
(9, 40, 40, '1900000.00', 'bank_transfer', 'pending', NULL, '2026-07-24 19:35:35', NULL, NULL),
(10, 43, 43, '1190000.00', 'bank_transfer', 'pending', NULL, '2026-07-29 19:18:58', NULL, NULL),
(11, 45, 45, '1700000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-24 20:57:09', 1, '2026-07-24 20:57:25'),
(12, 46, 46, '330000.00', 'bank_transfer', 'pending', NULL, '2026-07-24 21:26:05', NULL, NULL),
(13, 47, 47, '770000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-25 15:59:45', 1, '2026-07-25 16:01:00'),
(15, 49, 49, '270000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-25 16:22:16', 1, '2026-07-25 16:22:39'),
(16, 51, 51, '3000000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-25 22:22:33', 1, '2026-07-25 22:22:41'),
(18, 55, 55, '1470000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:00:13', 1, '2026-07-29 20:01:02'),
(19, 56, 56, '4500000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:09:46', 1, '2026-07-29 20:10:42'),
(20, 60, 60, '13500000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:34:28', 1, '2026-07-29 20:34:38'),
(21, 59, 59, '900000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-29 20:36:33', 1, '2026-07-29 20:36:43'),
(22, 62, 62, '1200000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-29 21:11:53', 1, '2026-07-29 21:12:01'),
(23, 63, 63, '3600000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-29 21:17:53', 1, '2026-07-29 21:18:14'),
(24, 64, 64, '189000.00', 'bank_transfer', 'confirmed', NULL, '2026-07-29 21:30:28', 1, '2026-07-29 21:30:36');

-- --------------------------------------------------------

--
-- Table structure for table `payment_refunds`
--

CREATE TABLE `payment_refunds` (
  `id` int NOT NULL,
  `paymentId` int NOT NULL,
  `bookingId` int NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `refundRate` decimal(4,2) NOT NULL DEFAULT '0.00',
  `paidAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `refundMethod` enum('cash','bank_transfer') NOT NULL DEFAULT 'bank_transfer',
  `bankBin` varchar(10) DEFAULT NULL,
  `bankName` varchar(100) DEFAULT NULL,
  `accountNumber` varchar(30) DEFAULT NULL,
  `accountName` varchar(100) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `note` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `processedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `payment_refunds`
--

INSERT INTO `payment_refunds` (`id`, `paymentId`, `bookingId`, `amount`, `refundRate`, `paidAmount`, `refundMethod`, `bankBin`, `bankName`, `accountNumber`, `accountName`, `status`, `note`, `createdAt`, `processedAt`) VALUES
(1, 26, 26, '33600000.00', '1.00', '33600000.00', 'cash', NULL, NULL, NULL, NULL, 'rejected', NULL, '2026-07-11 13:51:16', '2026-07-16 11:13:30'),
(2, 27, 27, '24000000.00', '1.00', '24000000.00', 'cash', NULL, NULL, NULL, NULL, 'approved', NULL, '2026-07-11 14:05:41', '2026-07-11 14:44:54'),
(3, 23, 23, '6750000.00', '0.50', '13500000.00', 'cash', NULL, NULL, NULL, NULL, 'rejected', NULL, '2026-07-11 14:05:51', '2026-07-24 19:43:24'),
(4, 59, 59, '450000.00', '0.50', '900000.00', 'cash', NULL, NULL, NULL, NULL, 'approved', NULL, '2026-07-29 20:37:09', '2026-07-29 20:38:56');

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
  `status` varchar(50) DEFAULT NULL,
  `isDeleted` tinyint(1) NOT NULL DEFAULT '0',
  `maintenanceNote` varchar(255) DEFAULT NULL,
  `maintenanceExpectedCompletion` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `rooms`
--

INSERT INTO `rooms` (`id`, `roomTypeId`, `roomNumber`, `floor`, `area`, `status`, `isDeleted`, `maintenanceNote`, `maintenanceExpectedCompletion`) VALUES
(1, 1, '101', 1, '25.00', 'available', 0, NULL, NULL),
(2, 1, '102', 1, '25.00', 'available', 0, NULL, NULL),
(3, 1, '103', 1, '25.00', 'available', 0, NULL, NULL),
(4, 1, '104', 1, '25.00', 'available', 0, NULL, NULL),
(5, 2, '201', 2, '30.00', 'available', 0, NULL, NULL),
(6, 2, '202', 2, '30.00', 'available', 0, NULL, NULL),
(7, 2, '203', 2, '30.00', 'available', 0, NULL, NULL),
(8, 2, '204', 2, '30.00', 'available', 0, NULL, NULL),
(9, 3, '301', 3, '35.00', 'available', 0, NULL, NULL),
(10, 3, '302', 3, '35.00', 'available', 0, NULL, NULL),
(11, 3, '303', 3, '35.00', 'available', 0, NULL, NULL),
(12, 3, '304', 3, '35.00', 'available', 0, NULL, NULL),
(13, 4, '401', 4, '45.00', 'available', 0, NULL, NULL),
(14, 4, '402', 4, '45.00', 'available', 0, NULL, NULL),
(15, 4, '403', 4, '45.00', 'available', 0, NULL, NULL),
(16, 4, '404', 4, '45.00', 'available', 0, NULL, NULL),
(17, 5, '501', 5, '60.00', 'available', 0, NULL, NULL),
(18, 5, '502', 5, '60.00', 'available', 0, NULL, NULL),
(19, 5, '503', 5, '60.00', 'available', 0, NULL, NULL),
(20, 5, '504', 5, '60.00', 'available', 0, NULL, NULL);

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
(1, 1, '2026-01-01', '2026-12-31', '500000.00', 'normal'),
(2, 2, '2026-01-01', '2026-12-31', '700000.00', 'normal'),
(3, 3, '2026-01-01', '2026-12-31', '900000.00', 'normal'),
(4, 4, '2026-01-01', '2026-12-31', '1200000.00', 'normal'),
(5, 5, '2026-01-01', '2026-12-31', '2000000.00', 'normal');

-- --------------------------------------------------------

--
-- Table structure for table `room_types`
--

CREATE TABLE `room_types` (
  `id` int NOT NULL,
  `typeName` varchar(255) DEFAULT NULL,
  `description` text,
  `capacity` int DEFAULT NULL,
  `defaultPrice` decimal(15,2) DEFAULT NULL,
  `isDeleted` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `room_types`
--

INSERT INTO `room_types` (`id`, `typeName`, `description`, `capacity`, `defaultPrice`, `isDeleted`) VALUES
(1, 'Standard', 'Phong tieu chuan', 2, '500000.00', 0),
(2, 'Superior', 'Phong superior', 2, '700000.00', 0),
(3, 'Deluxe', 'Phong deluxe', 3, '900000.00', 0),
(4, 'Family', 'Phong gia dinh', 4, '1200000.00', 0),
(5, 'Suite', 'Phong tong thong', 4, '2000000.00', 0);

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
(1, 'Buffet sáng', '150000.00', 'Buffet sáng phục vụ từ 06:30 đến 10:00.'),
(2, 'Giặt ủi', '100000.00', 'Dịch vụ giặt và ủi quần áo.'),
(3, 'Spa thư giãn', '300000.00', 'Dịch vụ chăm sóc và thư giãn tại spa.'),
(4, 'Đưa đón sân bay', '500000.00', 'Xe đưa đón giữa khách sạn và sân bay.'),
(5, 'Phục vụ tại phòng', '200000.00', 'Phục vụ đồ ăn và thức uống tại phòng.'),
(6, 'Buffet tối', '350000.00', 'Buffet tối phục vụ từ 18:00 đến 21:30.'),
(7, 'Massage', '400000.00', 'Dịch vụ massage thư giãn.'),
(8, 'Thuê xe đạp', '100000.00', 'Thuê xe đạp sử dụng trong ngày.'),
(9, 'Đồ uống minibar', '120000.00', 'Đồ ăn nhẹ và nước uống trong minibar.'),
(10, 'Kê thêm giường', '250000.00', 'Tối đa 1 giường phụ mỗi phòng; đăng ký trước 18:00 ngày nhận phòng.');

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
(1, 'SUMMER10', 'percentage', '10.00', '300000.00', '500000.00', 100, '2026-01-01', '2026-12-31', 'active'),
(2, 'WELCOME50', 'fixed', '50000.00', '50000.00', '300000.00', 200, '2026-01-01', '2026-12-31', 'active'),
(3, 'VIP20', 'percentage', '20.00', '500000.00', '1000000.00', 50, '2026-01-01', '2026-12-31', 'active'),
(7, 'SIUU', 'percentage', '2.00', '500000.00', '12.00', 1, '2026-06-25', '2026-06-30', 'active'),
(8, 'NOSHOW24501VPG', 'percentage', '10.00', NULL, NULL, 1, '2026-07-11', '2026-10-09', 'active'),
(9, 'NOSHOW33XCNVU9', 'percentage', '10.00', NULL, NULL, 1, '2026-07-17', '2026-10-15', 'active'),
(10, 'NOSHOW377KQJTI', 'percentage', '10.00', NULL, NULL, 1, '2026-07-17', '2026-10-15', 'active'),
(11, 'NOSHOW38A234SP', 'percentage', '10.00', NULL, NULL, 1, '2026-07-17', '2026-10-15', 'active'),
(12, 'NOSHOW32QVDF5X', 'percentage', '10.00', NULL, NULL, 1, '2026-07-18', '2026-10-16', 'active'),
(13, 'NOSHOW34IWX169', 'percentage', '10.00', NULL, NULL, 1, '2026-07-18', '2026-10-16', 'active'),
(14, 'NOSHOW39TX9VNF', 'percentage', '10.00', NULL, NULL, 1, '2026-07-19', '2026-10-17', 'active'),
(15, 'NOSHOW25N5TA0A', 'percentage', '10.00', NULL, NULL, 1, '2026-07-24', '2026-10-22', 'active'),
(16, 'NOSHOW30VRGEI2', 'percentage', '10.00', NULL, NULL, 1, '2026-07-24', '2026-10-22', 'active'),
(17, 'NOSHOW414ZNKKX', 'percentage', '10.00', NULL, NULL, 0, '2026-07-25', '2026-10-23', 'active'),
(18, 'NOSHOW43JKX0J8', 'percentage', '10.00', NULL, NULL, 1, '2026-07-25', '2026-10-23', 'active'),
(19, 'NOSHOW47TED3XO', 'percentage', '10.00', NULL, NULL, 1, '2026-07-25', '2026-10-23', 'active'),
(20, 'NOSHOW45YYHMEN', 'percentage', '10.00', NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(21, 'NOSHOW49W8QGN5', 'percentage', '10.00', NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(22, 'NOSHOW50EOCPLM', 'percentage', '10.00', NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(23, 'NOSHOW51VILXRX', 'percentage', '10.00', NULL, NULL, 1, '2026-07-28', '2026-10-26', 'active'),
(24, 'NOSHOW52BC1499', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(25, 'NOSHOW533VUW3B', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(26, 'NOSHOW540F9DK9', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(27, 'NOSHOW55IIV1W5', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(28, 'NOSHOW567GDM8K', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(29, 'NOSHOW57992L1X', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(30, 'NOSHOW58UPHPNY', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(31, 'NOSHOW60X9HBA9', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(32, 'NOSHOW62K3ZNME', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(33, 'NOSHOW63TRUAVN', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active'),
(34, 'NOSHOW64Y3ZXC2', 'percent', '10.00', NULL, NULL, 1, '2026-08-01', '2026-10-30', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `wallet_transactions`
--

CREATE TABLE `wallet_transactions` (
  `id` int NOT NULL,
  `customerId` int NOT NULL,
  `refundId` int DEFAULT NULL,
  `bookingId` int DEFAULT NULL,
  `type` enum('refund_credit','withdrawal') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  `refundMethod` enum('cash','bank_transfer') DEFAULT NULL,
  `bankBin` varchar(10) DEFAULT NULL,
  `bankName` varchar(100) DEFAULT NULL,
  `accountNumber` varchar(30) DEFAULT NULL,
  `accountName` varchar(100) DEFAULT NULL,
  `note` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `processedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `wallet_transactions`
--

INSERT INTO `wallet_transactions` (`id`, `customerId`, `refundId`, `bookingId`, `type`, `amount`, `status`, `refundMethod`, `bankBin`, `bankName`, `accountNumber`, `accountName`, `note`, `createdAt`, `processedAt`) VALUES
(1, 8, 2, 27, 'refund_credit', '24000000.00', 'approved', NULL, NULL, NULL, NULL, NULL, 'Hoàn tiền hủy đặt phòng #27', '2026-07-11 14:44:54', '2026-07-11 14:44:54'),
(2, 8, 4, 59, 'refund_credit', '450000.00', 'approved', NULL, NULL, NULL, NULL, NULL, 'Hoàn tiền hủy đặt phòng #59', '2026-07-29 20:38:56', '2026-07-29 20:38:56'),
(3, 8, NULL, NULL, 'withdrawal', '24450000.00', 'approved', 'bank_transfer', '970422', 'MB Bank', '0393166495', 'ĐỖ HỮU HOAN', NULL, '2026-07-29 20:40:20', '2026-07-29 20:40:33');

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
-- Indexes for table `app_settings`
--
ALTER TABLE `app_settings`
  ADD PRIMARY KEY (`settingKey`);

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
-- Indexes for table `customer_vouchers`
--
ALTER TABLE `customer_vouchers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `userId` (`userId`),
  ADD KEY `voucherId` (`voucherId`),
  ADD KEY `bookingId` (`bookingId`);

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
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoiceCode` (`invoiceCode`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `paymentId` (`paymentId`);

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
-- Indexes for table `payment_confirmation_requests`
--
ALTER TABLE `payment_confirmation_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `paymentId` (`paymentId`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `confirmedBy` (`confirmedBy`);

--
-- Indexes for table `payment_refunds`
--
ALTER TABLE `payment_refunds`
  ADD PRIMARY KEY (`id`),
  ADD KEY `paymentId` (`paymentId`),
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
-- Indexes for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customerId` (`customerId`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `amenities`
--
ALTER TABLE `amenities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `booking_damage_charges`
--
ALTER TABLE `booking_damage_charges`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `booking_details`
--
ALTER TABLE `booking_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `booking_guests`
--
ALTER TABLE `booking_guests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `booking_room_transfers`
--
ALTER TABLE `booking_room_transfers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `booking_services`
--
ALTER TABLE `booking_services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `booking_service_requests`
--
ALTER TABLE `booking_service_requests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `customer_vouchers`
--
ALTER TABLE `customer_vouchers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `damage_reports`
--
ALTER TABLE `damage_reports`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `payment_confirmation_requests`
--
ALTER TABLE `payment_confirmation_requests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `payment_refunds`
--
ALTER TABLE `payment_refunds`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

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
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

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
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `vouchers`
--
ALTER TABLE `vouchers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
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
-- Constraints for table `customer_vouchers`
--
ALTER TABLE `customer_vouchers`
  ADD CONSTRAINT `customer_vouchers_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `customer_vouchers_ibfk_2` FOREIGN KEY (`voucherId`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `customer_vouchers_ibfk_3` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE SET NULL;

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
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`);

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
-- Constraints for table `payment_confirmation_requests`
--
ALTER TABLE `payment_confirmation_requests`
  ADD CONSTRAINT `payment_confirmation_requests_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_confirmation_requests_ibfk_2` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_confirmation_requests_ibfk_3` FOREIGN KEY (`confirmedBy`) REFERENCES `accounts` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payment_refunds`
--
ALTER TABLE `payment_refunds`
  ADD CONSTRAINT `payment_refunds_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payment_refunds_ibfk_2` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;

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

--
-- Constraints for table `wallet_transactions`
--
ALTER TABLE `wallet_transactions`
  ADD CONSTRAINT `wallet_transactions_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

-- --------------------------------------------------------
--
-- Phần schema trước đây backend tự tạo ở lần khởi động đầu tiên
-- (backend/ensure-operational-schema.js). Đưa sẵn vào dump để import
-- xong là cấu trúc đã đầy đủ, không phụ thuộc lần chạy đầu.
--
-- --------------------------------------------------------

--
-- Bổ sung cột cho bảng `room_types` (trạng thái hiển thị của hạng phòng)
--

ALTER TABLE `room_types`
  ADD COLUMN `status` varchar(50) NOT NULL DEFAULT 'active';

--
-- Bổ sung cột cho bảng `reviews` (duyệt/ẩn và phản hồi của khách sạn)
--

ALTER TABLE `reviews`
  ADD COLUMN `status` varchar(20) NOT NULL DEFAULT 'approved',
  ADD COLUMN `images` text,
  ADD COLUMN `adminReply` text,
  ADD COLUMN `repliedAt` datetime DEFAULT NULL,
  ADD COLUMN `hideReason` text;

--
-- Bổ sung cột cho bảng `booking_services` (thời điểm phát sinh dịch vụ)
--

ALTER TABLE `booking_services`
  ADD COLUMN `createdAt` datetime DEFAULT CURRENT_TIMESTAMP;

--
-- Table structure for table `booking_nightly_prices`
-- Giá từng đêm được chốt tại thời điểm đặt, tránh tính lại theo bảng giá mới.
--

CREATE TABLE `booking_nightly_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bookingId` int NOT NULL,
  `stayDate` date NOT NULL,
  `price` decimal(15,2) NOT NULL DEFAULT '0.00',
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_booking_night` (`bookingId`,`stayDate`),
  CONSTRAINT `booking_nightly_prices_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `booking_history`
-- Nhật ký thao tác trên từng đặt phòng: ai làm gì, lúc nào.
--

CREATE TABLE `booking_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bookingId` int NOT NULL,
  `action` varchar(50) NOT NULL,
  `description` text,
  `oldValue` text,
  `newValue` text,
  `amount` decimal(15,2) DEFAULT NULL,
  `performedBy` int DEFAULT NULL,
  `performedByName` varchar(255) DEFAULT NULL,
  `performedByRole` varchar(30) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_booking_history_booking` (`bookingId`),
  CONSTRAINT `booking_history_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
