const express = require('express');
const { body, validationResult } = require('express-validator');

// Models
const User = require('../models/User');
const Song = require('../models/Song');
const Playlist = require('../models/Playlist');

// Middleware
const { auth, optionalAuth } = require('../middleware/auth');
const { 
  avatarUpload,
  processImageFile,
  deleteFile,
  formatFileSize
} = require('../middleware/upload');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('playlists', 'title coverImage createdAt')
      .populate('likedSongs', 'title artist coverImage duration')
      .populate({
        path: 'likedSongs',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      })
      .populate('recentlyPlayed.song', 'title artist coverImage duration');

    res.json({
      user: {
        ...user.toObject(),
        permissions: user.getPermissions()
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('profile.firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('profile.lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  body('profile.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters'),
  body('profile.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('preferences.favoriteGenres')
    .optional()
    .isArray()
    .withMessage('Favorite genres must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { profile, preferences } = req.body;

    const user = await User.findById(req.user._id);
    
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        ...user.toObject(),
        permissions: user.getPermissions()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

// @route   POST /api/users/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', 
  auth,
  avatarUpload.single('avatar'),
  processImageFile,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Avatar image is required' });
      }

      const user = await User.findById(req.user._id);
      
      // Delete old avatar if exists
      if (user.profile.avatar && user.profile.avatar !== '') {
        await deleteFile(user.profile.avatar);
      }

      // Update user avatar
      user.profile.avatar = req.fileUrl;
      await user.save();

      res.json({
        message: 'Avatar uploaded successfully',
        avatarUrl: req.fileUrl,
        user: {
          ...user.toObject(),
          permissions: user.getPermissions()
        }
      });

    } catch (error) {
      console.error('Avatar upload error:', error);
      
      // Clean up uploaded file on error
      if (req.file) {
        await deleteFile(req.file.path);
      }
      
      res.status(500).json({ message: 'Server error during avatar upload' });
    }
  }
);

// @route   GET /api/users/:id
// @desc    Get public user profile
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username profile stats userType createdAt')
      .populate('playlists', 'title coverImage isPublic createdAt')
      .populate({
        path: 'playlists',
        match: { isPublic: true }
      });

    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's public reels count
    const Reel = require('../models/Reel');
    const reelsCount = await Reel.countDocuments({
      creator: user._id,
      approvalStatus: 'approved',
      isPublic: true,
      isActive: true
    });

    res.json({
      user: {
        ...user.toObject(),
        reelsCount,
        // Hide sensitive info for public view
        email: undefined,
        subscription: undefined,
        preferences: undefined,
        likedSongs: undefined,
        recentlyPlayed: undefined
      }
    });

  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ message: 'Server error while fetching user profile' });
  }
});

// @route   GET /api/users/:id/playlists
// @desc    Get user's public playlists
// @access  Public
router.get('/:id/playlists', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.id);
    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    const playlists = await Playlist.find({
      creator: req.params.id,
      isPublic: true
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('creator', 'username profile.avatar')
      .populate('songs.song', 'title artist coverImage duration')
      .populate({
        path: 'songs.song',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      });

    const total = await Playlist.countDocuments({
      creator: req.params.id,
      isPublic: true
    });

    res.json({
      playlists,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + playlists.length < total
      }
    });

  } catch (error) {
    console.error('Get user playlists error:', error);
    res.status(500).json({ message: 'Server error while fetching user playlists' });
  }
});

// @route   GET /api/users/:id/stats
// @desc    Get user statistics
// @access  Public
router.get('/:id/stats', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get various counts
    const [
      playlistsCount,
      reelsCount,
      uploadedSongsCount
    ] = await Promise.all([
      Playlist.countDocuments({ creator: req.params.id, isPublic: true }),
      require('../models/Reel').countDocuments({
        creator: req.params.id,
        approvalStatus: 'approved',
        isPublic: true,
        isActive: true
      }),
      Song.countDocuments({
        uploadedBy: req.params.id,
        isPublished: true,
        approvalStatus: 'approved'
      })
    ]);

    res.json({
      stats: {
        totalListeningTime: user.stats.totalListeningTime,
        songsPlayed: user.stats.songsPlayed,
        playlistsCreated: playlistsCount,
        reelsCreated: reelsCount,
        songsUploaded: uploadedSongsCount,
        memberSince: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error while fetching user stats' });
  }
});

// @route   POST /api/users/follow/:id
// @desc    Follow/unfollow a user
// @access  Private
router.post('/follow/:id', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findById(currentUserId);
    
    // Check if already following
    const isFollowing = currentUser.following?.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== targetUserId
      );
      targetUser.followers = targetUser.followers?.filter(
        id => id.toString() !== currentUserId.toString()
      ) || [];
    } else {
      // Follow
      if (!currentUser.following) currentUser.following = [];
      if (!targetUser.followers) targetUser.followers = [];
      
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);
    }

    await Promise.all([
      currentUser.save(),
      targetUser.save()
    ]);

    res.json({
      message: isFollowing ? 'User unfollowed' : 'User followed',
      isFollowing: !isFollowing,
      followersCount: targetUser.followers?.length || 0
    });

  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ message: 'Server error while following user' });
  }
});

// @route   GET /api/users/search
// @desc    Search users
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20, page = 1 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const skip = (page - 1) * limit;

    const users = await User.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { 'profile.firstName': { $regex: q, $options: 'i' } },
            { 'profile.lastName': { $regex: q, $options: 'i' } }
          ]
        }
      ]
    })
      .select('username profile.firstName profile.lastName profile.avatar userType stats')
      .sort({ 'stats.songsPlayed': -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments({
      $and: [
        { isActive: true },
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { 'profile.firstName': { $regex: q, $options: 'i' } },
            { 'profile.lastName': { $regex: q, $options: 'i' } }
          ]
        }
      ]
    });

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + users.length < total
      },
      searchQuery: q
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error while searching users' });
  }
});

module.exports = router;