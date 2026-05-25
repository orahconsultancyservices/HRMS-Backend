/*
  Warnings:

  - You are about to alter the column `role` on the `Employee` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `Enum(EnumId(0))`.
  - A unique constraint covering the columns `[managesDepartment]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Department` ADD COLUMN `managerId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `managesDepartment` INTEGER NULL,
    ADD COLUMN `teamLeadId` INTEGER NULL,
    MODIFY `role` ENUM('admin', 'manager', 'teamlead', 'employee') NOT NULL DEFAULT 'employee';

-- CreateTable
CREATE TABLE `AccessPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `targetType` ENUM('department', 'team') NOT NULL,
    `targetId` INTEGER NOT NULL,
    `targetName` VARCHAR(100) NOT NULL,
    `accessLevel` ENUM('view', 'manage') NOT NULL DEFAULT 'view',
    `grantedBy` INTEGER NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AccessPermission_employeeId_idx`(`employeeId`),
    INDEX `AccessPermission_targetId_idx`(`targetId`),
    INDEX `AccessPermission_isActive_idx`(`isActive`),
    UNIQUE INDEX `AccessPermission_employeeId_targetType_targetId_key`(`employeeId`, `targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Department_managerId_idx` ON `Department`(`managerId`);

-- CreateIndex
CREATE UNIQUE INDEX `Employee_managesDepartment_key` ON `Employee`(`managesDepartment`);

-- CreateIndex
CREATE INDEX `Employee_teamLeadId_idx` ON `Employee`(`teamLeadId`);

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_managesDepartment_fkey` FOREIGN KEY (`managesDepartment`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_teamLeadId_fkey` FOREIGN KEY (`teamLeadId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessPermission` ADD CONSTRAINT `AccessPermission_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessPermission` ADD CONSTRAINT `AccessPermission_grantedBy_fkey` FOREIGN KEY (`grantedBy`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
