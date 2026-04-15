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
  const { timer, analytics, hubInfo, academyProgress, name, course } = req.body
  const updateObj = {}
  if (timer !== undefined) updateObj['profileData.timer'] = timer
  if (analytics !== undefined) updateObj['profileData.analytics'] = analytics
  if (hubInfo !== undefined) updateObj['profileData.hubInfo'] = hubInfo
  if (academyProgress !== undefined)
    updateObj['profileData.academyProgress'] = academyProgress
  if (name !== undefined) updateObj['profileData.name'] = name
  if (course !== undefined) updateObj['profileData.course'] = course

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updateObj },
    { new: true },
  ).select('profileData isPublic')

  res.status(200).json({ success: true, profileData: user.profileData, isPublic: user.isPublic })
})

export const updatePrivacy = asyncHandler(async (req, res) => {
  const { isPublic } = req.body
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { isPublic },
    { new: true },
  ).select('isPublic')

  res.status(200).json({ success: true, isPublic: user.isPublic })
})

export const searchUsers = asyncHandler(async (req, res) => {
  const { query } = req.query
  if (!query) {
    return res.status(200).json({ success: true, users: [] })
  }

  const searchRegex = new RegExp(query, 'i')

  // Search for public users matching username, name, or course
  const users = await User.find({
    isPublic: true,
    _id: { $ne: req.user._id },
    $or: [
      { username: searchRegex },
      { 'profileData.name': searchRegex },
      { 'profileData.course': searchRegex }
    ]
  }).select('_id username profileData.name profileData.course isOnline lastSeen')
    .limit(20)

  res.status(200).json({ success: true, users })
})

export const getUserProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params

  const user = await User.findById(userId).select('username isPublic profileData isOnline lastSeen')
  
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  if (!user.isPublic) {
    return res.status(403).json({ success: false, message: 'This profile is private' })
  }

  res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      name: user.profileData?.name,
      course: user.profileData?.course,
      timer: user.profileData?.timer,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    }
  })
})

export const markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true },
  )
  res.status(200).json({ success: true })
})
