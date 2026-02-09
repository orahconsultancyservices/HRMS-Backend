/*
  Warnings:

  - You are about to alter the column `casual` on the `LeaveBalance` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `sick` on the `LeaveBalance` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `earned` on the `LeaveBalance` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `maternity` on the `LeaveBalance` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `paternity` on the `LeaveBalance` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `bereavement` on the `LeaveBalance` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `days` on the `LeaveRequest` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `LeaveBalance` ADD COLUMN `lastUpdated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `paidConsumed` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `paidEarned` INTEGER NOT NULL DEFAULT 0,
    MODIFY `casual` DOUBLE NOT NULL DEFAULT 12,
    MODIFY `sick` DOUBLE NOT NULL DEFAULT 8,
    MODIFY `earned` DOUBLE NOT NULL DEFAULT 20,
    MODIFY `maternity` DOUBLE NOT NULL DEFAULT 90,
    MODIFY `paternity` DOUBLE NOT NULL DEFAULT 7,
    MODIFY `bereavement` DOUBLE NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE `LeaveRequest` MODIFY `days` DOUBLE NOT NULL;

-- CreateTable
CREATE TABLE `LeaveAuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leaveId` INTEGER NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `performedBy` INTEGER NOT NULL,
    `oldStatus` VARCHAR(20) NULL,
    `newStatus` VARCHAR(20) NULL,
    `oldDays` DOUBLE NULL,
    `newDays` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeaveAuditLog_leaveId_idx`(`leaveId`),
    INDEX `LeaveAuditLog_performedBy_idx`(`performedBy`),
    INDEX `LeaveAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeavePolicyConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `policyName` VARCHAR(100) NOT NULL,
    `paidLeavesPerMonth` DOUBLE NOT NULL DEFAULT 1,
    `maxAdvanceBookingDays` INTEGER NOT NULL DEFAULT 90,
    `minNoticeDays` INTEGER NOT NULL DEFAULT 1,
    `maxConsecutiveDays` INTEGER NOT NULL DEFAULT 30,
    `carryForwardEnabled` BOOLEAN NOT NULL DEFAULT false,
    `maxCarryForward` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeavePolicyConfig_isActive_effectiveFrom_idx`(`isActive`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `LeaveBalance_employeeId_idx` ON `LeaveBalance`(`employeeId`);

-- CreateIndex
CREATE INDEX `LeaveRequest_from_to_idx` ON `LeaveRequest`(`from`, `to`);

-- CreateIndex
CREATE INDEX `LeaveRequest_isPaid_status_idx` ON `LeaveRequest`(`isPaid`, `status`);
