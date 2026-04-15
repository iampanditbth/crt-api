import { Router } from 'express'
import {
  getProfileInfo,
  updateProfileData,
  markNotificationsRead,
  updatePrivacy,
  searchUsers,
  getUserProfile,
} from '../controllers/profile.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()

router.get('/search', authMiddleware, searchUsers)
router.get('/user/:userId', authMiddleware, getUserProfile)
router.get('/', authMiddleware, getProfileInfo)
router.put('/', authMiddleware, updateProfileData)
router.put('/privacy', authMiddleware, updatePrivacy)
router.put('/notifications/read', authMiddleware, markNotificationsRead)

export default router
