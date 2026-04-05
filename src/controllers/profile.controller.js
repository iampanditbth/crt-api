import { User } from '../models/User.js'
import { Notification } from '../models/Notification.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const getProfileInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('profileData')
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)

  res.status(200).json({
    success: true,
    profileData: user.profileData,
    notifications,
  })
})

export const updateProfileData = asyncHandler(async (req, res) => {
  const { timer, analytics, hubInfo, academyProgress } = req.body
  const updateObj = {}
  if (timer !== undefined) updateObj['profileData.timer'] = timer
  if (analytics !== undefined) updateObj['profileData.analytics'] = analytics
  if (hubInfo !== undefined) updateObj['profileData.hubInfo'] = hubInfo
  if (academyProgress !== undefined)
    updateObj['profileData.academyProgress'] = academyProgress

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateObj },
    { new: true },
  ).select('profileData')

  res.status(200).json({ success: true, profileData: user.profileData })
})

export const markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true },
  )
  res.status(200).json({ success: true })
})
