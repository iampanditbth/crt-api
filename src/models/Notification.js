import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, type: { type: String, enum: ['alert', 'msg', 'discussion'], required: true }, title: { type: String, required: true }, message: { type: String, required: true }, isRead: { type: Boolean, default: false }, link: { type: String }, relatedId: { type: mongoose.Schema.Types.ObjectId } }, { timestamps: true })

export const Notification = mongoose.model('Notification', notificationSchema)