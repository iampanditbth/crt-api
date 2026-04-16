import { User } from '../models/User.js'
import { Notification } from '../models/Notification.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const getProfileInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    'profileData following followers',
  )
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)

  res.status(200).json({
    success: true,
    profileData: user.profileData,
    following: user.following || [],
    followers: user.followers || [],
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

  res.status(200).json({
    success: true,
    profileData: user.profileData,
    isPublic: user.isPublic,
  })
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

  // Search for users matching username, name, or course.
  // New signups may not have profileData.name populated, so username search captures them.
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { username: searchRegex },
      { 'profileData.name': searchRegex },
      { 'profileData.course': searchRegex },
    ],
  })
    .select(
      '_id username profileData.name profileData.course isOnline lastSeen',
    )
    .limit(20)
    .lean() // make app faster

  res.status(200).json({ success: true, users })
})

export const getUserProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params

  const user = await User.findById(userId).select(
    'username isPublic profileData isOnline lastSeen followers following',
  )

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' })
  }

  if (!user.isPublic) {
    return res
      .status(403)
      .json({ success: false, message: 'This profile is private' })
  }

  res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      name: user.profileData?.name,
      course: user.profileData?.course,
      timer: user.profileData?.timer,
      analytics: user.profileData?.analytics,
      academyProgress: user.profileData?.academyProgress,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      isFollowing:
        user.followers?.some(
          (id) => id.toString() === req.user._id.toString(),
        ) || false,
    },
  })
})

export const followUser = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (id === req.user._id.toString()) {
    return res
      .status(400)
      .json({ success: false, message: 'You cannot follow yourself' })
  }

  const targetUser = await User.findById(id)
  if (!targetUser)
    return res.status(404).json({ success: false, message: 'User not found' })

  const user = await User.findById(req.user._id)

  if (!user.following.includes(id)) {
    user.following.push(id)
    targetUser.followers.push(user._id)
    await user.save({ validateBeforeSave: false })
    await targetUser.save({ validateBeforeSave: false })
  }

  res.status(200).json({
    success: true,
    message: 'User followed successfully',
    following: user.following,
  })
})

export const unfollowUser = asyncHandler(async (req, res) => {
  const { id } = req.params

  const user = await User.findById(req.user._id)
  const targetUser = await User.findById(id)

  if (!targetUser)
    return res.status(404).json({ success: false, message: 'User not found' })

  if (user.following.includes(id)) {
    user.following = user.following.filter((f) => f.toString() !== id)
    targetUser.followers = targetUser.followers.filter(
      (f) => f.toString() !== user._id.toString(),
    )
    await user.save({ validateBeforeSave: false })
    await targetUser.save({ validateBeforeSave: false })
  }

  res.status(200).json({
    success: true,
    message: 'User unfollowed successfully',
    following: user.following,
  })
})

export const getFeed = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)

  const feedUsers = await User.find({
    _id: { $in: user.following },
    isPublic: true, // Only see public user activity
  })
    .select('username profileData isOnline lastSeen')
    .lean()

  res.status(200).json({ success: true, feed: feedUsers })
})

export const markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true },
  )
  res.status(200).json({ success: true })
})

export const getUserNetwork = asyncHandler(async (req, res) => {
  const userId = req.params.userId === 'me' ? req.user._id : req.params.userId
  const user = await User.findById(userId)
    .populate(
      'followers',
      '_id username profileData.name profileData.course isOnline lastSeen',
    )
    .populate(
      'following',
      '_id username profileData.name profileData.course isOnline lastSeen',
    )

  if (!user)
    return res.status(404).json({ success: false, message: 'User not found' })
  res.status(200).json({
    success: true,
    followers: user.followers,
    following: user.following,
  })
})
