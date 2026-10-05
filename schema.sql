-- ==========================================================
-- Smart Queue Management System Database Schema (MySQL)
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `smart_queue_db`;
USE `smart_queue_db`;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS `departments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `prefix` VARCHAR(10) NOT NULL UNIQUE,
  `avg_service_time_mins` INT DEFAULT 5,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Counters Table
CREATE TABLE IF NOT EXISTS `counters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `counter_number` VARCHAR(20) NOT NULL,
  `department_id` INT NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE
);

-- 3. Tokens Table
CREATE TABLE IF NOT EXISTS `tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `token_number` VARCHAR(20) NOT NULL,
  `user_name` VARCHAR(100) NOT NULL,
  `user_phone` VARCHAR(20) NOT NULL,
  `department_id` INT NOT NULL,
  `counter_id` INT NULL,
  `status` ENUM('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW') DEFAULT 'WAITING',
  `estimated_wait_mins` INT DEFAULT 0,
  `booked_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `called_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`counter_id`) REFERENCES `counters`(`id`) ON DELETE SET NULL
);

-- Initial Seed Data
INSERT INTO `departments` (`name`, `prefix`, `avg_service_time_mins`) VALUES
('General Consultation', 'GEN', 5),
('Billing & Cashier', 'BIL', 3),
('Pharmacy & Medicine', 'PHA', 4),
('Account & Registration', 'ACC', 7)
ON DUPLICATE KEY UPDATE `name`=`name`;

INSERT INTO `counters` (`counter_number`, `department_id`, `status`) VALUES
('Counter 1 (General)', 1, 'ACTIVE'),
('Counter 2 (Billing)', 2, 'ACTIVE'),
('Counter 3 (Pharmacy)', 3, 'ACTIVE'),
('Counter 4 (Accounts)', 4, 'ACTIVE')
ON DUPLICATE KEY UPDATE `counter_number`=`counter_number`;
