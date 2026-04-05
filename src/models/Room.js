import mongoose from 'mongoose'

const generateCode = () => Math.floor(1000 + Math.random() * 9000).toString()

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    code: {
      type: String,
      default: null,
      sparse: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    invitedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  },
)

roomSchema.index({ name: 1, createdBy: 1 }, { unique: true })

roomSchema.pre('save', async function () {
  if (this.isNew && this.isPrivate && !this.code) {
    this.code = generateCode()
  }
})

export const Room = mongoose.model('Room', roomSchema)
export { generateCode }
