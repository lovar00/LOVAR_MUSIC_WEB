const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Models
const User = require('../models/User');
const Song = require('../models/Song');
const Artist = require('../models/Artist');
const Playlist = require('../models/Playlist');
const Reel = require('../models/Reel');

// Middleware
const { auth, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(auth);
router.use(isAdmin);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'uploads/';
    
    if (file.fieldname === 'musicFile') {
      uploadPath += 'music/';
    } else if (file.fieldname === 'coverImage') {
      uploadPath += 'images/';
    } else if (file.fieldname === 'avatar') {
      uploadPath += 'images/avatars/';
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.fieldname === 'musicFile') {
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed for music upload'));
      }
    } else if (file.fieldname === 'coverImage' || file.fieldname === 'avatar') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    } else {
      cb(null, true);
    }
  }
});

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Admin
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await Promise.all([
      User.countDocuments(),
      Song.countDocuments(),
      Artist.countDocuments(),
      Playlist.countDocuments(),
      Reel.countDocuments(),
      User.countDocuments({ userType: 'NORMAL' }),
      User.countDocuments({ userType: 'PREMIUM' }),
      User.countDocuments({ userType: 'VIP' }),
      Song.countDocuments({ approvalStatus: 'pending' }),
      Reel.countDocuments({ approvalStatus: 'pending' })
    ]);

    const dashboardStats = {
      totalUsers: stats[0],
      totalSongs: stats[1],
      totalArtists: stats[2],
      totalPlaylists: stats[3],
      totalReels: stats[4],
      userBreakdown: {
        normal: stats[5],
        premium: stats[6],
        vip: stats[7]
      },
      pendingApprovals: {
        songs: stats[8],
        reels: stats[9]
      }
    };

    // Get recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username email userType createdAt');

    const recentSongs = await Song.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('artist', 'name')
      .select('title artist approvalStatus createdAt');

    res.json({
      stats: dashboardStats,
      recentActivities: {
        users: recentUsers,
        songs: recentSongs
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error while fetching dashboard stats' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filters
// @access  Admin
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const userType = req.query.userType;
    const search = req.query.search;
    const isActive = req.query.isActive;

    let query = {};

    if (userType && userType !== 'all') {
      query.userType = userType;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user details
// @access  Admin
router.put('/users/:id', [
  body('userType')
    .optional()
    .isIn(['NORMAL', 'PREMIUM', 'VIP', 'ADMIN'])
    .withMessage('Invalid user type'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { userType, isActive, profile } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (userType) user.userType = userType;
    if (isActive !== undefined) user.isActive = isActive;
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: { ...user.toObject(), password: undefined }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error while updating user' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user account
// @access  Admin
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Don't allow admin to delete themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user's content
    await Promise.all([
      Playlist.deleteMany({ creator: userId }),
      Reel.deleteMany({ creator: userId }),
      Song.deleteMany({ uploadedBy: userId })
    ]);

    // Delete user
    await User.findByIdAndDelete(userId);

    res.json({ message: 'User and associated content deleted successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
});

// @route   GET /api/admin/songs
// @desc    Get all songs for admin management
// @access  Admin
router.get('/songs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const search = req.query.search;

    let query = {};

    if (status && status !== 'all') {
      query.approvalStatus = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } }
      ];
    }

    const songs = await Song.find(query)
      .populate('artist', 'name')
      .populate('uploadedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Song.countDocuments(query);

    res.json({
      songs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get songs error:', error);
    res.status(500).json({ message: 'Server error while fetching songs' });
  }
});

// @route   POST /api/admin/songs/:id/approve
// @desc    Approve a song
// @access  Admin
router.post('/songs/:id/approve', async (req, res) => {
  try {
    const songId = req.params.id;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    song.approvalStatus = 'approved';
    song.approvedBy = req.user._id;
    song.isPublished = true;
    await song.save();

    // Notify user via socket if connected
    req.io.to(song.uploadedBy.toString()).emit('songApproved', {
      songId: song._id,
      title: song.title,
      message: 'Your song has been approved and is now live!'
    });

    res.json({ message: 'Song approved successfully', song });

  } catch (error) {
    console.error('Approve song error:', error);
    res.status(500).json({ message: 'Server error while approving song' });
  }
});

// @route   POST /api/admin/songs/:id/reject
// @desc    Reject a song
// @access  Admin
router.post('/songs/:id/reject', [
  body('reason')
    .notEmpty()
    .withMessage('Rejection reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const songId = req.params.id;
    const { reason } = req.body;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    song.approvalStatus = 'rejected';
    song.approvedBy = req.user._id;
    song.rejectionReason = reason;
    song.isPublished = false;
    await song.save();

    // Notify user
    req.io.to(song.uploadedBy.toString()).emit('songRejected', {
      songId: song._id,
      title: song.title,
      reason: reason,
      message: 'Your song has been rejected. Please check the reason and try again.'
    });

    res.json({ message: 'Song rejected successfully', song });

  } catch (error) {
    console.error('Reject song error:', error);
    res.status(500).json({ message: 'Server error while rejecting song' });
  }
});

// @route   GET /api/admin/reels
// @desc    Get all reels for admin management
// @access  Admin
router.get('/reels', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    let query = {};

    if (status && status !== 'all') {
      query.approvalStatus = status;
    }

    const reels = await Reel.find(query)
      .populate('creator', 'username email profile.avatar')
      .populate('song', 'title artist')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Reel.countDocuments(query);

    res.json({
      reels,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get reels error:', error);
    res.status(500).json({ message: 'Server error while fetching reels' });
  }
});

// @route   POST /api/admin/reels/:id/approve
// @desc    Approve a reel
// @access  Admin
router.post('/reels/:id/approve', async (req, res) => {
  try {
    const reelId = req.params.id;

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    await reel.approve(req.user._id);

    // Notify user
    req.io.to(reel.creator.toString()).emit('reelApproved', {
      reelId: reel._id,
      title: reel.title,
      message: 'Your reel has been approved and is now live!'
    });

    res.json({ message: 'Reel approved successfully', reel });

  } catch (error) {
    console.error('Approve reel error:', error);
    res.status(500).json({ message: 'Server error while approving reel' });
  }
});

// @route   POST /api/admin/reels/:id/reject
// @desc    Reject a reel
// @access  Admin
router.post('/reels/:id/reject', [
  body('reason')
    .notEmpty()
    .withMessage('Rejection reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const reelId = req.params.id;
    const { reason } = req.body;

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    await reel.reject(req.user._id, reason);

    // Notify user
    req.io.to(reel.creator.toString()).emit('reelRejected', {
      reelId: reel._id,
      title: reel.title,
      reason: reason,
      message: 'Your reel has been rejected. Please check the reason and try again.'
    });

    res.json({ message: 'Reel rejected successfully', reel });

  } catch (error) {
    console.error('Reject reel error:', error);
    res.status(500).json({ message: 'Server error while rejecting reel' });
  }
});

// @route   POST /api/admin/artists
// @desc    Create new artist
// @access  Admin
router.post('/artists', upload.single('avatar'), [
  body('name')
    .notEmpty()
    .withMessage('Artist name is required'),
  body('bio')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bio must be less than 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, bio, genres, country, socialLinks } = req.body;

    const artist = new Artist({
      name,
      bio,
      genres: genres ? JSON.parse(genres) : [],
      country,
      socialLinks: socialLinks ? JSON.parse(socialLinks) : {},
      avatar: req.file ? `/uploads/images/avatars/${req.file.filename}` : ''
    });

    await artist.save();

    res.status(201).json({
      message: 'Artist created successfully',
      artist
    });

  } catch (error) {
    console.error('Create artist error:', error);
    res.status(500).json({ message: 'Server error while creating artist' });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get platform analytics
// @access  Admin
router.get('/analytics', async (req, res) => {
  try {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // User growth analytics
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: lastMonth }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Most popular songs
    const popularSongs = await Song.find({ isPublished: true })
      .sort({ 'stats.plays': -1 })
      .limit(10)
      .populate('artist', 'name')
      .select('title artist stats.plays stats.likes');

    // User type distribution
    const userTypeStats = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent activity
    const recentActivity = {
      newUsers: await User.countDocuments({ createdAt: { $gte: lastWeek } }),
      newSongs: await Song.countDocuments({ createdAt: { $gte: lastWeek } }),
      newReels: await Reel.countDocuments({ createdAt: { $gte: lastWeek } })
    };

    res.json({
      userGrowth,
      popularSongs,
      userTypeStats,
      recentActivity
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error while fetching analytics' });
  }
});

module.exports = router;