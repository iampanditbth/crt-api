import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    profileData: {
      name: { type: String, default: '' },
      course: { type: String, default: '' },
      timer: { type: Number, default: 0 },
      analytics: { type: Object, default: {} },
      hubInfo: { type: Object, default: {} },
        academyProgress: { type: Object, default: {} },
    },
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActivity: { type: Date, default: null },
    },
    totalCompletions: { type: Number, default: 0 },
    weeklyScore: { type: Number, default: 0 },
    weekReset: { type: Date, default: null },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

userSchema.pre('save', async function save() {
  if (!this.isModified('password')) {
    return
  }

  this.password = await bcrypt.hash(this.password, 10)
})

userSchema.methods.comparePassword = function comparePassword(rawPassword) {
  return bcrypt.compare(rawPassword, this.password)
}

// Optimized indexes for leaderboard & streak queries
userSchema.index({ weeklyScore: -1, _id: 1 })
userSchema.index({ 'streak.lastActivity': 1 })

export const User = mongoose.model('User', userSchema)
