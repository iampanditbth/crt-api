import { User } from '../models/User.js'
import { Activity } from '../models/Activity.js'

/**
 * Returns the start-of-day (midnight) in IST for a given date.
 * IST = UTC + 5:30 → offset = 5.5 * 60 * 60 * 1000 ms
 */
const getISTMidnight = (date = new Date()) => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const istTime = new Date(date.getTime() + IST_OFFSET_MS)
  // Zero-out time portion in IST
  istTime.setUTCHours(0, 0, 0, 0)
  // Convert back to UTC to store/compare as UTC
  return new Date(istTime.getTime() - IST_OFFSET_MS)
}

/**
 * Returns the start of the current ISO week (Monday 00:00 IST).
 */
const getWeekStart = () => {
  const now = new Date()
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + IST_OFFSET_MS)
  // Day 0=Sun … 1=Mon … 6=Sat; shift so Mon=0
  const dayOfWeek = (istNow.getUTCDay() + 6) % 7
  istNow.setUTCDate(istNow.getUTCDate() - dayOfWeek)
  istNow.setUTCHours(0, 0, 0, 0)
  return new Date(istNow.getTime() - IST_OFFSET_MS) // back to UTC
}

/**
 * Compute leaderboard score.
 * Formula: streak.current * 2 + totalCompletions
 */
export const computeScore = (user) => {
  const streak = user?.streak?.current ?? 0
  const completions = user?.totalCompletions ?? 0
  return streak * 2 + completions
}

/**
 * Update streak logic for a user document (mutates in-place, does NOT save).
 * - Same day as lastActivity → no change
 * - Exactly the next calendar day → increment
 * - More than one day gap → reset to 1
 */
export const updateStreak = (user) => {
  const now = new Date()
  const todayMidnight = getISTMidnight(now)

  if (!user.streak) {
    user.streak = { current: 0, longest: 0, lastActivity: null }
  }

  const last = user.streak.lastActivity

  if (!last) {
    // First activity ever
    user.streak.current = 1
  } else {
    const lastMidnight = getISTMidnight(new Date(last))
    const diffDays = Math.round(
      (todayMidnight - lastMidnight) / (24 * 60 * 60 * 1000),
    )

    if (diffDays === 0) {
      // Same calendar day — streak unchanged, just update lastActivity
    } else if (diffDays === 1) {
      // Consecutive day → extend streak
      user.streak.current += 1
    } else {
      // Gap detected → reset
      user.streak.current = 1
    }
  }

  // Update longest streak
  if (user.streak.current > (user.streak.longest || 0)) {
    user.streak.longest = user.streak.current
  }

  user.streak.lastActivity = now
}

/**
 * Reset weekly score if we are in a new week.
 */
const refreshWeeklyScore = (user) => {
  const weekStart = getWeekStart()
  if (!user.weekReset || new Date(user.weekReset) < weekStart) {
    user.totalCompletions = 0
    user.weeklyScore = 0
    user.weekReset = weekStart
  }
}

/**
 * Log a user activity:
 * 1. Insert Activity document
 * 2. Update streak
 * 3. Increment totalCompletions
 * 4. Recompute weeklyScore
 * 5. Save user
 *
 * @param {string|ObjectId} userId
 * @param {'study'|'task'|'message'|'general'} type
 * @returns {Promise<User>} updated user doc
 */
export const logActivity = async (userId, type = 'general') => {
  // Insert activity log
  await Activity.create({ userId, type })

  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  // Reset weekly counters if new week
  refreshWeeklyScore(user)

  // Update streak
  const prevLastActivity = user.streak?.lastActivity
  const todayMidnight = getISTMidnight()
  const lastMidnight = prevLastActivity
    ? getISTMidnight(new Date(prevLastActivity))
    : null

  const isNewDay =
    !lastMidnight ||
    Math.round((todayMidnight - lastMidnight) / (24 * 60 * 60 * 1000)) >= 1

  updateStreak(user)

  // Only count as a new completion on the first activity of each calendar day
  if (isNewDay) {
    user.totalCompletions = (user.totalCompletions || 0) + 1
  }

  // Recompute weekly score
  user.weeklyScore = computeScore(user)

  await user.save({ validateBeforeSave: false })
  return user
}
