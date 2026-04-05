import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: { expires: '1d' },
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'link', 'sticker'],
      required: true,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    content: {
      type: String,
      default: '',
    },
    fileUrl: {
      type: String,
      default: '',
    },
    localFilePath: {
      type: String,
      default: '',
    },
    isDeletedFromServer: {
      type: Boolean,
      default: false,
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
    },
    cloudinaryResourceType: {
      type: String,
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    mimeType: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    downloadedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        downloadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

export const Message = mongoose.model('Message', messageSchema)
