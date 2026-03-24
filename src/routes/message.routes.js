import { Router } from 'express'
import {
  deleteMessage,
  getMessagesByRoom,
  uploadFileMessage,
} from '../controllers/message.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upload } from '../middleware/upload.middleware.js'

const router = Router()

router.get('/:roomId', authMiddleware, getMessagesByRoom)
router.post('/upload', authMiddleware, upload.single('file'), uploadFileMessage)
router.delete('/:messageId', authMiddleware, deleteMessage)

export default router
