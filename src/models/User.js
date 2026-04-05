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
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    profileData: {
      timer: { type: Number, default: 0 },
      analytics: { type: Object, default: {} },
      hubInfo: { type: Object, default: {} },
      academyProgress: { type: Object, default: {} },
    },
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

export const User = mongoose.model('User', userSchema)
