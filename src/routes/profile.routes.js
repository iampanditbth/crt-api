import { Router } from 'express'
import {
  getProfileInfo,
  updateProfileData,
  markNotificationsRead,
} from '../controllers/profile.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()

router.get('/', authMiddleware, getProfileInfo)
router.put('/', authMiddleware, updateProfileData)
router.put('/notifications/read', authMiddleware, markNotificationsRead)

export default router
