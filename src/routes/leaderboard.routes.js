import { Router } from 'express'
import {
  logActivityHandler,
  getLeaderboard,
  getMyRank,
  getMyStreak,
} from '../controllers/leaderboard.controller.js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()

// Log an activity event (updates streak + weekly score)
router.post('/activity', authMiddleware, logActivityHandler)

// Get weekly top-50 leaderboard
router.get('/', authMiddleware, getLeaderboard)

// Get authenticated user's rank in current week
router.get('/my-rank', authMiddleware, getMyRank)

// Get authenticated user's streak details
router.get('/my-streak', authMiddleware, getMyStreak)

export default router
