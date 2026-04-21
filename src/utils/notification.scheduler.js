import cron from 'node-cron'
import { User } from '../models/User.js'
import { Notification } from '../models/Notification.js'

/**
 * Helper: create a notification only if one with the same type
 * was NOT already sent to this user today. Prevents spam.
 */
const createIfNotSentToday = async (userId, type, title, message) => {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const existing = await Notification.findOne({
    userId,
    type,
    title,
    createdAt: { $gte: dayStart },
  })

  if (!existing) {
    await Notification.create({ userId, type, title, message })
  }
}

/**
 * Job 1 — Inactivity Alert
 * Runs every hour.
 * Finds users who haven't logged activity for >= 24 hours
 * and sends them a single "No activity" notification per day.
 */
const inactivityJob = cron.schedule(
  '0 * * * *', // top of every hour
  async () => {
    try {
      const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const inactiveUsers = await User.find({
        $or: [
          { 'streak.lastActivity': { $lte: threshold } },
          { 'streak.lastActivity': null },
        ],
      })
        .select('_id streak')
        .lean()

      for (const user of inactiveUsers) {
        await createIfNotSentToday(
          user._id,
          'alert',
          '⏰ No activity for 24 hours',
          'You haven\'t logged any activity today. Keep your learning streak alive — every day counts!',
        )
      }

      console.log(`[Scheduler] Inactivity check: ${inactiveUsers.length} users notified`)
    } catch (err) {
      console.error('[Scheduler] Inactivity job error:', err)
    }
  },
  { scheduled: false }, // start manually so DB is ready first
)

/**
 * Job 2 — Streak Danger Alert
 * Runs every hour.
 * Finds users whose streak is > 0 and last activity was
 * between 12 and 23.9 hours ago (danger zone — about to break).
 */
const streakDangerJob = cron.schedule(
  '30 * * * *', // 30 min past every hour (staggered from inactivity job)
  async () => {
    try {
      const now = Date.now()
      const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000)
      const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000)

      const dangerUsers = await User.find({
        'streak.current': { $gt: 0 },
        'streak.lastActivity': {
          $gte: twentyFourHoursAgo,
          $lte: twelveHoursAgo,
        },
      })
        .select('_id streak')
        .lean()

      for (const user of dangerUsers) {
        const hoursLeft = Math.round(
          (24 * 60 * 60 * 1000 -
            (now - new Date(user.streak.lastActivity).getTime())) /
            (60 * 60 * 1000),
        )

        await createIfNotSentToday(
          user._id,
          'alert',
          '🔥 Your streak is about to break!',
          `You have a ${user.streak.current}-day streak — but it'll reset in ~${hoursLeft}h if you don't log activity. Don't break the chain!`,
        )
      }

      console.log(`[Scheduler] Streak danger check: ${dangerUsers.length} users at risk`)
    } catch (err) {
      console.error('[Scheduler] Streak danger job error:', err)
    }
  },
  { scheduled: false },
)

/**
 * Start both cron jobs. Call this once after the DB has connected.
 */
export const startNotificationScheduler = () => {
  inactivityJob.start()
  streakDangerJob.start()
  console.log('[Scheduler] Notification jobs started')
}
