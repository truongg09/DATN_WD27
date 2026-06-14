-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Máy chủ: localhost:3306
-- Thời gian đã tạo: Th6 10, 2026 lúc 04:27 PM
-- Phiên bản máy phục vụ: 8.0.30
-- Phiên bản PHP: 8.1.10

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
  `id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `accounts`
--

INSERT INTO `accounts` (`id`, `email`, `password`, `role`, `status`, `createdAt`) VALUES
(1, 'admin@gmail.com', '123456', 'admin', 'active', '2026-06-10 23:22:28'),
(2, 'staff1@gmail.com', '123456', 'staff', 'active', '2026-06-10 23:22:28'),
(3, 'staff2@gmail.com', '123456', 'staff', 'active', '2026-06-10 23:22:28'),
(4, 'customer1@gmail.com', '123456', 'customer', 'active', '2026-06-10 23:22:28'),
(5, 'customer2@gmail.com', '123456', 'customer', 'active', '2026-06-10 23:22:28'),
(6, 'customer3@gmail.com', '123456', 'customer', 'active', '2026-06-10 23:22:28'),
(7, 'customer4@gmail.com', '123456', 'customer', 'active', '2026-06-10 23:22:28'),
(8, 'customer5@gmail.com', '123456', 'customer', 'active', '2026-06-10 23:22:28');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `amenities`
--

CREATE TABLE `amenities` (
  `id` int NOT NULL,
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
-- Cấu trúc bảng cho bảng `bookings`
--

CREATE TABLE `bookings` (
  `id` int NOT NULL,
  `customerId` int DEFAULT NULL,
  `voucherId` int DEFAULT NULL,
  `bookingCode` varchar(100) DEFAULT NULL,
  `bookingStatus` varchar(50) DEFAULT NULL,
  `totalAmount` decimal(15,2) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `bookings`
--

INSERT INTO `bookings` (`id`, `customerId`, `voucherId`, `bookingCode`, `bookingStatus`, `totalAmount`, `createdAt`) VALUES
(1, 1, 1, 'BK001', 'confirmed', 900000.00, '2026-06-10 23:26:20'),
(2, 2, 2, 'BK002', 'pending', 1350000.00, '2026-06-10 23:26:20'),
(3, 3, 3, 'BK003', 'checkout', 2600000.00, '2026-06-10 23:26:20'),
(4, 4, NULL, 'BK004', 'checkin', 1200000.00, '2026-06-10 23:26:20'),
(5, 5, 1, 'BK005', 'confirmed', 1800000.00, '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_details`
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
-- Đang đổ dữ liệu cho bảng `booking_details`
--

INSERT INTO `booking_details` (`id`, `bookingId`, `roomId`, `checkInDate`, `checkOutDate`, `adults`, `children`, `roomPrice`) VALUES
(1, 1, 1, '2026-06-10', '2026-06-12', 2, 0, 500000.00),
(2, 2, 5, '2026-06-15', '2026-06-17', 2, 1, 700000.00),
(3, 3, 9, '2026-06-20', '2026-06-23', 3, 1, 900000.00),
(4, 4, 13, '2026-06-22', '2026-06-24', 4, 0, 1200000.00),
(5, 5, 17, '2026-06-25', '2026-06-27', 2, 0, 2000000.00);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_services`
--

CREATE TABLE `booking_services` (
  `id` int NOT NULL,
  `bookingId` int DEFAULT NULL,
  `serviceId` int DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `totalPrice` decimal(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `booking_services`
--

INSERT INTO `booking_services` (`id`, `bookingId`, `serviceId`, `quantity`, `totalPrice`) VALUES
(1, 1, 1, 2, 300000.00),
(2, 2, 2, 1, 100000.00),
(3, 3, 3, 2, 600000.00),
(4, 4, 5, 1, 200000.00),
(5, 5, 7, 1, 400000.00);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `booking_status_logs`
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
-- Đang đổ dữ liệu cho bảng `customers`
--

INSERT INTO `customers` (`id`, `accountId`, `fullName`, `phone`, `gender`, `dateOfBirth`, `citizenId`, `nationality`, `address`) VALUES
(1, 4, 'Nguyen Van A', '0911111111', 'Male', NULL, NULL, 'Vietnam', 'Ha Noi'),
(2, 5, 'Tran Thi B', '0922222222', 'Female', NULL, NULL, 'Vietnam', 'Hai Phong'),
(3, 6, 'Le Van C', '0933333333', 'Male', NULL, NULL, 'Vietnam', 'Da Nang'),
(4, 7, 'Pham Thi D', '0944444444', 'Female', NULL, NULL, 'Vietnam', 'Hue'),
(5, 8, 'Hoang Van E', '0955555555', 'Male', NULL, NULL, 'Vietnam', 'HCM');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `damage_reports`
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
-- Đang đổ dữ liệu cho bảng `damage_reports`
--

INSERT INTO `damage_reports` (`id`, `bookingId`, `roomItemId`, `description`, `compensationFee`, `reportDate`) VALUES
(1, 2, 3, 'May say toc bi vo', 300000.00, '2026-06-10 23:26:20'),
(2, 3, 4, 'Mini bar hong', 500000.00, '2026-06-10 23:26:20'),
(3, 5, 10, 'Den ban bi hu', 200000.00, '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `employees`
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
-- Đang đổ dữ liệu cho bảng `employees`
--

INSERT INTO `employees` (`id`, `accountId`, `fullName`, `phone`, `position`, `salary`, `hireDate`) VALUES
(1, 2, 'Nguyen Le Staff', '0901234567', 'Receptionist', 12000000.00, '2025-01-01'),
(2, 3, 'Tran Staff', '0908888888', 'Manager', 18000000.00, '2025-01-01');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `notifications`
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
-- Đang đổ dữ liệu cho bảng `notifications`
--

INSERT INTO `notifications` (`id`, `accountId`, `title`, `content`, `isRead`, `createdAt`) VALUES
(1, 1, 'Booking moi', 'Co booking BK001 vua duoc tao', 1, '2026-06-10 23:26:20'),
(2, 2, 'Check-in', 'Khach BK004 da check-in', 0, '2026-06-10 23:26:20'),
(3, 3, 'Thanh toan', 'Don BK003 da thanh toan', 1, '2026-06-10 23:26:20'),
(4, 4, 'Khuyen mai', 'Ban nhan duoc voucher moi', 0, '2026-06-10 23:26:20'),
(5, 5, 'Danh gia', 'Cam on ban da danh gia khach san', 1, '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `payments`
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
-- Đang đổ dữ liệu cho bảng `payments`
--

INSERT INTO `payments` (`id`, `bookingId`, `roomAmount`, `serviceAmount`, `surchargeAmount`, `discountAmount`, `depositAmount`, `paidAmount`, `remainingAmount`, `totalAmount`, `paymentMethod`, `paymentStatus`, `transactionCode`, `paymentDate`) VALUES
(1, 1, 1000000.00, 0.00, 0.00, 100000.00, 300000.00, 900000.00, 0.00, 900000.00, 'cash', 'paid', 'TXN001', '2026-06-10 10:00:00'),
(2, 2, 1400000.00, 0.00, 0.00, 50000.00, 500000.00, 500000.00, 850000.00, 1350000.00, 'momo', 'unpaid', 'TXN002', '2026-06-15 09:00:00'),
(3, 3, 2700000.00, 200000.00, 0.00, 300000.00, 1000000.00, 2600000.00, 0.00, 2600000.00, 'vnpay', 'paid', 'TXN003', '2026-06-20 14:00:00'),
(4, 4, 1200000.00, 0.00, 0.00, 0.00, 500000.00, 500000.00, 700000.00, 1200000.00, 'cash', 'unpaid', 'TXN004', '2026-06-22 15:00:00'),
(5, 5, 2000000.00, 0.00, 0.00, 200000.00, 1000000.00, 1800000.00, 0.00, 1800000.00, 'vnpay', 'paid', 'TXN005', '2026-06-25 11:00:00');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `payment_status_logs`
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
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `reviews`
--

INSERT INTO `reviews` (`id`, `bookingId`, `customerId`, `rating`, `comment`, `createdAt`) VALUES
(1, 1, 1, 5, 'Phong sach se, nhan vien than thien', '2026-06-10 23:26:20'),
(2, 2, 2, 4, 'Phong dep, do an ngon', '2026-06-10 23:26:20'),
(3, 3, 3, 5, 'Rat hai long voi dich vu', '2026-06-10 23:26:20'),
(4, 4, 4, 4, 'Gia hop ly', '2026-06-10 23:26:20'),
(5, 5, 5, 5, 'Se quay lai lan sau', '2026-06-10 23:26:20');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `rooms`
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
-- Đang đổ dữ liệu cho bảng `rooms`
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
-- Cấu trúc bảng cho bảng `room_images`
--

CREATE TABLE `room_images` (
  `id` int NOT NULL,
  `roomTypeId` int DEFAULT NULL,
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
  `id` int NOT NULL,
  `roomId` int DEFAULT NULL,
  `itemName` varchar(255) DEFAULT NULL,
  `quantity` int DEFAULT NULL,
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
  `id` int NOT NULL,
  `roomTypeId` int DEFAULT NULL,
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
  `id` int NOT NULL,
  `typeName` varchar(255) DEFAULT NULL,
  `description` text,
  `capacity` int DEFAULT NULL,
  `defaultPrice` decimal(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `room_types`
--

INSERT INTO `room_types` (`id`, `typeName`, `description`, `capacity`, `defaultPrice`) VALUES
(1, 'Standard', 'Phong tieu chuan', 2, 500000.00),
(2, 'Superior', 'Phong superior', 2, 700000.00),
(3, 'Deluxe', 'Phong deluxe', 3, 900000.00),
(4, 'Family', 'Phong gia dinh', 4, 1200000.00),
(5, 'Suite', 'Phong tong thong', 4, 2000000.00);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `room_type_amenities`
--

CREATE TABLE `room_type_amenities` (
  `id` int NOT NULL,
  `roomTypeId` int DEFAULT NULL,
  `amenityId` int DEFAULT NULL
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
  `id` int NOT NULL,
  `serviceName` varchar(255) DEFAULT NULL,
  `price` decimal(15,2) DEFAULT NULL,
  `description` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Đang đổ dữ liệu cho bảng `services`
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
(10, 'Extra Bed', 250000.00, 'Extra Bed');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `vouchers`
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
-- Đang đổ dữ liệu cho bảng `vouchers`
--

INSERT INTO `vouchers` (`id`, `code`, `discountType`, `discountValue`, `maxDiscount`, `minBookingAmount`, `quantity`, `startDate`, `endDate`, `status`) VALUES
(1, 'SUMMER10', 'percent', 10.00, 300000.00, 500000.00, 100, '2026-01-01', '2026-12-31', 'active'),
(2, 'WELCOME50', 'fixed', 50000.00, 50000.00, 300000.00, 200, '2026-01-01', '2026-12-31', 'active'),
(3, 'VIP20', 'percent', 20.00, 500000.00, 1000000.00, 50, '2026-01-01', '2026-12-31', 'active');

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
-- Chỉ mục cho bảng `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `bookingCode` (`bookingCode`),
  ADD KEY `customerId` (`customerId`),
  ADD KEY `voucherId` (`voucherId`);

--
-- Chỉ mục cho bảng `booking_details`
--
ALTER TABLE `booking_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomId` (`roomId`);

--
-- Chỉ mục cho bảng `booking_services`
--
ALTER TABLE `booking_services`
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
-- Chỉ mục cho bảng `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bookingId` (`bookingId`),
  ADD KEY `roomItemId` (`roomItemId`);

--
-- Chỉ mục cho bảng `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD KEY `accountId` (`accountId`);

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
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT cho bảng `amenities`
--
ALTER TABLE `amenities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `booking_details`
--
ALTER TABLE `booking_details`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `booking_services`
--
ALTER TABLE `booking_services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `damage_reports`
--
ALTER TABLE `damage_reports`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT cho bảng `employees`
--
ALTER TABLE `employees`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT cho bảng `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT cho bảng `room_images`
--
ALTER TABLE `room_images`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `room_items`
--
ALTER TABLE `room_items`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `room_prices`
--
ALTER TABLE `room_prices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `room_types`
--
ALTER TABLE `room_types`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT cho bảng `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT cho bảng `services`
--
ALTER TABLE `services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT cho bảng `vouchers`
--
ALTER TABLE `vouchers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Ràng buộc đối với các bảng kết xuất
--

--
-- Ràng buộc cho bảng `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`voucherId`) REFERENCES `vouchers` (`id`);

--
-- Ràng buộc cho bảng `booking_details`
--
ALTER TABLE `booking_details`
  ADD CONSTRAINT `booking_details_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_details_ibfk_2` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`);

--
-- Ràng buộc cho bảng `booking_services`
--
ALTER TABLE `booking_services`
  ADD CONSTRAINT `booking_services_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_services_ibfk_2` FOREIGN KEY (`serviceId`) REFERENCES `services` (`id`);

--
-- Ràng buộc cho bảng `booking_status_logs`
--
ALTER TABLE `booking_status_logs`
  ADD CONSTRAINT `booking_status_logs_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `booking_status_logs_ibfk_2` FOREIGN KEY (`changedBy`) REFERENCES `accounts` (`id`);

--
-- Ràng buộc cho bảng `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Ràng buộc cho bảng `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD CONSTRAINT `damage_reports_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `damage_reports_ibfk_2` FOREIGN KEY (`roomItemId`) REFERENCES `room_items` (`id`);

--
-- Ràng buộc cho bảng `employees`
--
ALTER TABLE `employees`
  ADD CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Ràng buộc cho bảng `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`accountId`) REFERENCES `accounts` (`id`);

--
-- Ràng buộc cho bảng `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`);

--
-- Ràng buộc cho bảng `payment_status_logs`
--
ALTER TABLE `payment_status_logs`
  ADD CONSTRAINT `payment_status_logs_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`),
  ADD CONSTRAINT `payment_status_logs_ibfk_2` FOREIGN KEY (`changedBy`) REFERENCES `accounts` (`id`);

--
-- Ràng buộc cho bảng `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`bookingId`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `reviews_ibfk_2` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`);

--
-- Ràng buộc cho bảng `rooms`
--
ALTER TABLE `rooms`
  ADD CONSTRAINT `rooms_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Ràng buộc cho bảng `room_images`
--
ALTER TABLE `room_images`
  ADD CONSTRAINT `room_images_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Ràng buộc cho bảng `room_items`
--
ALTER TABLE `room_items`
  ADD CONSTRAINT `room_items_ibfk_1` FOREIGN KEY (`roomId`) REFERENCES `rooms` (`id`);

--
-- Ràng buộc cho bảng `room_prices`
--
ALTER TABLE `room_prices`
  ADD CONSTRAINT `room_prices_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`);

--
-- Ràng buộc cho bảng `room_type_amenities`
--
ALTER TABLE `room_type_amenities`
  ADD CONSTRAINT `room_type_amenities_ibfk_1` FOREIGN KEY (`roomTypeId`) REFERENCES `room_types` (`id`),
  ADD CONSTRAINT `room_type_amenities_ibfk_2` FOREIGN KEY (`amenityId`) REFERENCES `amenities` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
