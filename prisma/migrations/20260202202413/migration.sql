-- AlterTable
ALTER TABLE `LeaveRequest` ADD COLUMN `isHalfDay` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isPaid` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `paidDays` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `type` ENUM('Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Bereavement', 'Paid', 'Unpaid', 'HalfDay') NOT NULL;

-- CreateTable
CREATE TABLE `Task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `type` ENUM('daily', 'weekly', 'monthly') NOT NULL,
    `category` ENUM('applications', 'interviews', 'assessments') NOT NULL,
    `target` INTEGER NOT NULL,
    `achieved` INTEGER NOT NULL DEFAULT 0,
    `unit` VARCHAR(50) NOT NULL,
    `deadline` DATETIME(3) NOT NULL,
    `status` ENUM('active', 'completed', 'overdue') NOT NULL DEFAULT 'active',
    `assignedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `priority` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    `assignedToId` INTEGER NOT NULL,
    `assignedById` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `recurring` BOOLEAN NOT NULL DEFAULT false,
    `recurrence` ENUM('daily', 'weekly', 'monthly') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_assignedToId_idx`(`assignedToId`),
    INDEX `Task_assignedById_idx`(`assignedById`),
    INDEX `Task_status_idx`(`status`),
    INDEX `Task_deadline_idx`(`deadline`),
    INDEX `Task_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskSubmission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `count` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedBy` INTEGER NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaskSubmission_taskId_idx`(`taskId`),
    INDEX `TaskSubmission_employeeId_idx`(`employeeId`),
    INDEX `TaskSubmission_date_idx`(`date`),
    INDEX `TaskSubmission_verified_idx`(`verified`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskSubmission` ADD CONSTRAINT `TaskSubmission_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskSubmission` ADD CONSTRAINT `TaskSubmission_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
