-- AddColumn: role and reportTo for Employee model
ALTER TABLE `Employee` ADD COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'employee';
ALTER TABLE `Employee` ADD COLUMN `reportTo` INT;

-- Add foreign key for reportTo relationship (self-referencing)
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_reportTo_fkey` FOREIGN KEY (`reportTo`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for new columns
CREATE INDEX `Employee_reportTo_idx` ON `Employee`(`reportTo`);
CREATE INDEX `Employee_role_idx` ON `Employee`(`role`);
