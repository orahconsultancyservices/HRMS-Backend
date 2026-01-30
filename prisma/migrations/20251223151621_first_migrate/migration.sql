-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `employeeId` VARCHAR(50) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `orgEmail` VARCHAR(255) NOT NULL,
    `orgPassword` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `department` VARCHAR(100) NOT NULL,
    `position` VARCHAR(100) NOT NULL,
    `joinDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leaveDate` DATETIME(3) NULL,
    `location` VARCHAR(255) NULL,
    `emergencyContact` VARCHAR(20) NULL,
    `avatar` VARCHAR(10) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_employeeId_key`(`employeeId`),
    UNIQUE INDEX `Employee_email_key`(`email`),
    UNIQUE INDEX `Employee_orgEmail_key`(`orgEmail`),
    INDEX `Employee_department_idx`(`department`),
    INDEX `Employee_position_idx`(`position`),
    INDEX `Employee_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveBalance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `casual` INTEGER NOT NULL DEFAULT 12,
    `sick` INTEGER NOT NULL DEFAULT 8,
    `earned` INTEGER NOT NULL DEFAULT 20,
    `maternity` INTEGER NOT NULL DEFAULT 90,
    `paternity` INTEGER NOT NULL DEFAULT 7,
    `bereavement` INTEGER NOT NULL DEFAULT 7,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeaveBalance_employeeId_key`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empId` INTEGER NOT NULL,
    `type` ENUM('Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Bereavement') NOT NULL,
    `from` DATETIME(3) NOT NULL,
    `to` DATETIME(3) NOT NULL,
    `days` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `appliedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `contactDuringLeave` VARCHAR(20) NULL,
    `addressDuringLeave` TEXT NULL,
    `managerNotes` TEXT NULL,
    `approvedBy` VARCHAR(100) NULL,
    `approvedDate` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeaveRequest_empId_idx`(`empId`),
    INDEX `LeaveRequest_status_idx`(`status`),
    INDEX `LeaveRequest_appliedDate_idx`(`appliedDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeaveBalance` ADD CONSTRAINT `LeaveBalance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_empId_fkey` FOREIGN KEY (`empId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
