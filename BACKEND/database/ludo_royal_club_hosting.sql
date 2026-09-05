-- =====================================================
-- LUDO ROYAL CLUB - MySQL Database (FREE HOSTING Import)
-- InfinityFree / cPanel hosting ke liye.
-- STEP: phpMyAdmin me LEFT side apna database SELECT karo,
-- phir Import -> ye file choose karo -> Go.
-- (Hosting par CREATE DATABASE allowed nahi, isliye wo lines hatayi hain.)
-- =====================================================

-- Clean re-import: purane tables drop karo (fresh setup ke liye safe)
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS mails;
DROP TABLE IF EXISTS kyc_requests;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS bets;
DROP TABLE IF EXISTS users;

-- ==================== USERS ====================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NULL DEFAULT NULL,
    google_uid VARCHAR(128) NULL DEFAULT NULL,
    user_id VARCHAR(10) NOT NULL UNIQUE,
    profile_logo VARCHAR(255) DEFAULT '',
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_deposit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_withdraw DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_win DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    referral_code VARCHAR(10) NOT NULL DEFAULT '',
    referred_by VARCHAR(10) NOT NULL DEFAULT '',
    referral_commission DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    kyc_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    demo_trx TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_google_uid (google_uid),
    UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== BETS ====================
CREATE TABLE IF NOT EXISTS bets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_id INT NULL,
    creator_name VARCHAR(100) NOT NULL DEFAULT '',
    creator_user_id VARCHAR(10) NOT NULL DEFAULT '',
    creator_logo VARCHAR(255) NOT NULL DEFAULT '',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    room_code VARCHAR(20) NOT NULL DEFAULT '',
    status ENUM('waiting','playing','completed','cancelled') NOT NULL DEFAULT 'waiting',
    joiner_id INT NULL,
    joiner_name VARCHAR(100) NOT NULL DEFAULT '',
    joiner_logo VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('Deposit','Withdraw','Win') NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status ENUM('Success','Pending','Rejected') NOT NULL DEFAULT 'Success',
    details TEXT NULL,
    date VARCHAR(30) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== KYC REQUESTS ====================
CREATE TABLE IF NOT EXISTS kyc_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    aadhar_name VARCHAR(100) NOT NULL DEFAULT '',
    aadhar_number VARCHAR(30) NOT NULL DEFAULT '',
    front_image TEXT NULL,
    back_image TEXT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_kyc_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== MAILS ====================
CREATE TABLE IF NOT EXISTS mails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL DEFAULT '',
    body TEXT NULL,
    from_name VARCHAR(100) NOT NULL DEFAULT 'Admin',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mail_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== SETTINGS (key/value) ====================
CREATE TABLE IF NOT EXISTS settings (
    key_name VARCHAR(50) PRIMARY KEY,
    key_value LONGTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== GAMES ====================
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT '',
    logo VARCHAR(255) NOT NULL DEFAULT '',
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- SEED DATA
-- =====================================================

-- App settings (deposit options, limits, texts)
INSERT INTO settings (key_name, key_value) VALUES
('app', '{"depositOptions":"100,200,300,400,500,1000,2000,5000","minDeposit":100,"minWithdraw":195,"maxWithdraw":50000,"privacy":"","terms":"","about":"","rules":""}'),
('support', '{"whatsapp":"https://wa.me/8082547350","telegram":"","chat":"","logo":""}'),
('welcome', '{"message":"Welcome to Ludo Royal Club! Start playing and winning real money. Good luck!"}');

-- Demo bets (lobby me dikhenge — creator_id NULL = demo player)
INSERT INTO bets (creator_id, creator_name, creator_user_id, creator_logo, amount, room_code, status, joiner_name, joiner_logo) VALUES
(NULL, 'Rahul',   '58231', 'USERS-LOGO/photo_2026-09-02_16-25-41.jpg', 100,  'LUDO1A', 'waiting',   '', ''),
(NULL, 'Priya',   '74210', 'USERS-LOGO/photo_2026-09-02_16-26-05.jpg', 200,  'LUDO2B', 'waiting',   '', ''),
(NULL, 'Vikram',  '91532', 'USERS-LOGO/photo_2026-09-02_16-26-06.jpg', 500,  'LUDO3C', 'waiting',   '', ''),
(NULL, 'Sneha',   '63984', 'USERS-LOGO/photo_2026-09-02_16-26-07.jpg', 150,  'LUDO4D', 'waiting',   '', ''),
(NULL, 'Arjun',   '81746', 'USERS-LOGO/photo_2026-09-02_16-26-23.jpg', 300,  'LUDO5E', 'waiting',   '', ''),
(NULL, 'Deepika', '70293', 'USERS-LOGO/photo_2026-09-02_16-26-24.jpg', 1000, 'LUDO6F', 'playing',   'Karan',  'USERS-LOGO/photo_2026-09-02_16-26-26.jpg'),
(NULL, 'Rohan',   '55817', 'USERS-LOGO/photo_2026-09-02_16-26-27.jpg', 250,  'LUDO7G', 'playing',   'Amit',   'USERS-LOGO/photo_2026-09-02_16-26-29.jpg'),
(NULL, 'Kunal',   '98103', 'USERS-LOGO/photo_2026-09-02_16-25-41.jpg', 750,  'LUDO9I', 'playing',   'Ravi',   'USERS-LOGO/photo_2026-09-02_16-26-05.jpg'),
(NULL, 'Ananya',  '42659', 'USERS-LOGO/photo_2026-09-02_16-26-06.jpg', 400,  'LUDO8H', 'completed', 'Sanjay', 'USERS-LOGO/photo_2026-09-02_16-26-07.jpg'),
(NULL, 'Pooja',   '73018', 'USERS-LOGO/photo_2026-09-02_16-26-23.jpg', 100,  'LUDO10J','completed', 'Nikhil', 'USERS-LOGO/photo_2026-09-02_16-26-24.jpg');

-- =====================================================
-- MIGRATION (agar DB pehle se bana hai to ye 3 lines phpMyAdmin me chalao)
-- =====================================================
-- ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL DEFAULT NULL AFTER name;
-- ALTER TABLE users ADD COLUMN google_uid VARCHAR(128) NULL DEFAULT NULL AFTER email;
-- ALTER TABLE users ADD UNIQUE KEY uq_google_uid (google_uid), ADD UNIQUE KEY uq_email (email);