import { User } from '../models/User.js'
import { logActivity, computeScore } from '../utils/streak.service.js'
import { asyncHandler } from '../utils/asyncHandler.js'

/**
 * POST /api/leaderboard/activity
 * Log user activity, update streak and weekly score.
 */
export const logActivityHandler = asyncHandler(async (req, res) => {
  const { type = 'general' } = req.body
  const userId = req.user._id

  const user = await logActivity(userId, type)

  res.status(200).json({
    success: true,
    streak: user.streak,
    totalCompletions: user.totalCompletions,
    weeklyScore: user.weeklyScore,
    score: computeScore(user),
  })
})

/**
 * GET /api/leaderboard
 * Returns top-50 users for the current week, sorted by weeklyScore DESC.
 * Optimized: uses { weeklyScore: -1, _id: 1 } index defined on User model.
 */
export const getLeaderboard = asyncHandler(async (req, res) => {
  const weekStart = getWeekStart()

  const users = await User.find({
    $or: [
      { weekReset: { $gte: weekStart } },
      { weeklyScore: { $gt: 0 } },
    ],
  })
    .select('username profileData.name profileData.course weeklyScore streak totalCompletions')
    .sort({ weeklyScore: -1, _id: 1 })
    .limit(50)
    .lean()

  const leaderboard = users.map((u, index) => ({
    rank: index + 1,
    userId: u._id,
    username: u.username,
    name: u.profileData?.name || '',
    course: u.profileData?.course || '',
    weeklyScore: u.weeklyScore || 0,
    currentStreak: u.streak?.current || 0,
    longestStreak: u.streak?.longest || 0,
    totalCompletions: u.totalCompletions || 0,
  }))

  res.status(200).json({ success: true, leaderboard, weekStart })
})

/**
 * GET /api/leaderboard/my-rank
 * Returns the authenticated user's rank in the current weekly leaderboard.
 */
export const getMyRank = asyncHandler(async (req, res) => {
  const userId = String(req.user._id)
  const weekStart = getWeekStart()

  // Count how many users score higher than current user
  const currentUser = await User.findById(userId)
    .select('weeklyScore streak totalCompletions')
    .lean()

  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  const myScore = currentUser.weeklyScore || 0

  const higherCount = await User.countDocuments({
    $or: [
      { weekReset: { $gte: weekStart } },
      { weeklyScore: { $gt: 0 } },
    ],
    weeklyScore: { $gt: myScore },
  })

  res.status(200).json({
    success: true,
    rank: higherCount + 1,
    weeklyScore: myScore,
    currentStreak: currentUser.streak?.current || 0,
    longestStreak: currentUser.streak?.longest || 0,
    totalCompletions: currentUser.totalCompletions || 0,
  })
})

/**
 * GET /api/leaderboard/my-streak
 * Returns the authenticated user's streak info.
 */
export const getMyStreak = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('streak totalCompletions weeklyScore weekReset')
    .lean()

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  // Compute hours until streak breaks
  let hoursUntilBreak = null
  if (user.streak?.lastActivity && user.streak?.current > 0) {
    const elapsed = Date.now() - new Date(user.streak.lastActivity).getTime()
    const remaining = 24 * 60 * 60 * 1000 - elapsed
    hoursUntilBreak = remaining > 0 ? Math.round(remaining / (60 * 60 * 1000)) : 0
  }

  res.status(200).json({
    success: true,
    streak: {
      current: user.streak?.current || 0,
      longest: user.streak?.longest || 0,
      lastActivity: user.streak?.lastActivity || null,
      hoursUntilBreak,
    },
    totalCompletions: user.totalCompletions || 0,
    weeklyScore: user.weeklyScore || 0,
    weekReset: user.weekReset || null,
  })
})

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the UTC timestamp for Monday 00:00 IST of the current week.
 */
const getWeekStart = () => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const istNow = new Date(Date.now() + IST_OFFSET_MS)
  const dayOfWeek = (istNow.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  istNow.setUTCDate(istNow.getUTCDate() - dayOfWeek)
  istNow.setUTCHours(0, 0, 0, 0)
  return new Date(istNow.getTime() - IST_OFFSET_MS)
}
