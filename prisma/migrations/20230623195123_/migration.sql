-- DropForeignKey
ALTER TABLE `chat` DROP FOREIGN KEY `chat_id_usuario_fkey`;

-- AddForeignKey
ALTER TABLE `chat` ADD CONSTRAINT `chat_id_usuario_fkey` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
