import mongoose from 'mongoose'

/**
 * Activity log — one document per user action.
 * Used for streak calculation and inactivity detection.
 */
const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['study', 'task', 'message', 'general'],
      default: 'general',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// Compound index: fast lookup of user activity within a time range
activitySchema.index({ userId: 1, createdAt: -1 })

export const Activity = mongoose.model('Activity', activitySchema)
