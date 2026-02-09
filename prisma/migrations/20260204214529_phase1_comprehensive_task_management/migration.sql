-- DropIndex
DROP INDEX `Employee_department_idx` ON `Employee`;

-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `departmentId` INTEGER NULL,
    ADD COLUMN `designationId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Task` ADD COLUMN `adjustedBy` INTEGER NULL,
    ADD COLUMN `adjustedDate` DATETIME(3) NULL,
    ADD COLUMN `comments` TEXT NULL,
    ADD COLUMN `isLocked` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lockDate` DATETIME(3) NULL,
    ADD COLUMN `originalTarget` INTEGER NULL,
    MODIFY `category` ENUM('applications', 'interviews', 'assessments', 'calls', 'meetings', 'closures', 'screenings', 'submissions', 'placements') NOT NULL;

-- AlterTable
ALTER TABLE `TaskSubmission` ADD COLUMN `profileComment` TEXT NULL;

-- CreateTable
CREATE TABLE `Department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_name_key`(`name`),
    UNIQUE INDEX `Department_code_key`(`code`),
    INDEX `Department_code_idx`(`code`),
    INDEX `Department_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Designation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `departmentId` INTEGER NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Designation_departmentId_idx`(`departmentId`),
    INDEX `Designation_isActive_idx`(`isActive`),
    UNIQUE INDEX `Designation_departmentId_code_key`(`departmentId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DefaultKPI` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designationId` INTEGER NOT NULL,
    `metricName` VARCHAR(100) NOT NULL,
    `type` ENUM('daily', 'weekly', 'monthly') NOT NULL,
    `category` ENUM('applications', 'interviews', 'assessments', 'calls', 'meetings', 'closures', 'screenings', 'submissions', 'placements') NOT NULL,
    `defaultTarget` INTEGER NOT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `targetMin` INTEGER NULL,
    `targetMax` INTEGER NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DefaultKPI_designationId_idx`(`designationId`),
    INDEX `DefaultKPI_type_idx`(`type`),
    INDEX `DefaultKPI_isActive_idx`(`isActive`),
    UNIQUE INDEX `DefaultKPI_designationId_metricName_type_key`(`designationId`, `metricName`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MonthlyPerformance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `designationId` INTEGER NULL,
    `departmentId` INTEGER NULL,
    `totalTasksAssigned` INTEGER NOT NULL,
    `totalTasksCompleted` INTEGER NOT NULL,
    `totalTarget` INTEGER NOT NULL,
    `totalAchieved` INTEGER NOT NULL,
    `achievementPercent` DOUBLE NOT NULL,
    `dailyTarget` INTEGER NOT NULL DEFAULT 0,
    `dailyAchieved` INTEGER NOT NULL DEFAULT 0,
    `weeklyTarget` INTEGER NOT NULL DEFAULT 0,
    `weeklyAchieved` INTEGER NOT NULL DEFAULT 0,
    `monthlyTarget` INTEGER NOT NULL DEFAULT 0,
    `monthlyAchieved` INTEGER NOT NULL DEFAULT 0,
    `trendVsLastMonth` VARCHAR(50) NULL,
    `percentageChange` DOUBLE NULL,
    `teamLeadRemarks` TEXT NULL,
    `remarkedBy` INTEGER NULL,
    `remarkedAt` DATETIME(3) NULL,
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `lockedBy` INTEGER NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MonthlyPerformance_employeeId_idx`(`employeeId`),
    INDEX `MonthlyPerformance_year_month_idx`(`year`, `month`),
    INDEX `MonthlyPerformance_isLocked_idx`(`isLocked`),
    INDEX `MonthlyPerformance_designationId_idx`(`designationId`),
    INDEX `MonthlyPerformance_departmentId_idx`(`departmentId`),
    UNIQUE INDEX `MonthlyPerformance_employeeId_year_month_key`(`employeeId`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `taskId` INTEGER NOT NULL,
    `metricName` VARCHAR(100) NOT NULL,
    `actual` INTEGER NOT NULL,
    `notes` TEXT NULL,
    `profileComment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isEditable` BOOLEAN NOT NULL DEFAULT true,
    `lockedAt` DATETIME(3) NULL,

    INDEX `DailyActivityLog_employeeId_date_idx`(`employeeId`, `date`),
    INDEX `DailyActivityLog_taskId_idx`(`taskId`),
    INDEX `DailyActivityLog_date_idx`(`date`),
    INDEX `DailyActivityLog_isEditable_idx`(`isEditable`),
    UNIQUE INDEX `DailyActivityLog_employeeId_date_taskId_key`(`employeeId`, `date`, `taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Employee_departmentId_idx` ON `Employee`(`departmentId`);

-- CreateIndex
CREATE INDEX `Employee_designationId_idx` ON `Employee`(`designationId`);

-- CreateIndex
CREATE INDEX `Task_isLocked_idx` ON `Task`(`isLocked`);

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Designation` ADD CONSTRAINT `Designation_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DefaultKPI` ADD CONSTRAINT `DefaultKPI_designationId_fkey` FOREIGN KEY (`designationId`) REFERENCES `Designation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_adjustedBy_fkey` FOREIGN KEY (`adjustedBy`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MonthlyPerformance` ADD CONSTRAINT `MonthlyPerformance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MonthlyPerformance` ADD CONSTRAINT `MonthlyPerformance_remarkedBy_fkey` FOREIGN KEY (`remarkedBy`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MonthlyPerformance` ADD CONSTRAINT `MonthlyPerformance_lockedBy_fkey` FOREIGN KEY (`lockedBy`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyActivityLog` ADD CONSTRAINT `DailyActivityLog_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyActivityLog` ADD CONSTRAINT `DailyActivityLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
