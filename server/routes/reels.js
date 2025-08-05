const express = require('express');
const { body, validationResult } = require('express-validator');
const path = require('path');

// Models
const Reel = require('../models/Reel');
const Song = require('../models/Song');
const User = require('../models/User');

// Middleware
const { auth, optionalAuth, userActionLimit } = require('../middleware/auth');
const { 
  videoUpload, 
  multipleUpload,
  processVideoFile,
  deleteFile,
  getFileSize,
  formatFileSize,
  getVideoMetadata,
  generateVideoThumbnail
} = require('../middleware/upload');

const router = express.Router();

// @route   GET /api/reels
// @desc    Get reels feed (approved reels only)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const hashtag = req.query.hashtag;
    const userId = req.query.userId;

    let query = {
      approvalStatus: 'approved',
      isActive: true,
      isPublic: true
    };

    // Filter by hashtag
    if (hashtag) {
      query.hashtags = { $in: [hashtag] };
    }

    // Filter by user
    if (userId) {
      query.creator = userId;
    }

    const reels = await Reel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('creator', 'username profile.avatar profile.firstName profile.lastName')
      .populate('song', 'title artist coverImage duration')
      .populate({
        path: 'song',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      });

    const total = await Reel.countDocuments(query);

    res.json({
      reels,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + reels.length < total
      }
    });

  } catch (error) {
    console.error('Get reels error:', error);
    res.status(500).json({ message: 'Server error while fetching reels' });
  }
});

// @route   GET /api/reels/trending
// @desc    Get trending reels
// @access  Public
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const reels = await Reel.find({
      approvalStatus: 'approved',
      isActive: true,
      isPublic: true
    })
      .sort({ 'stats.views': -1, 'stats.likes': -1, createdAt: -1 })
      .limit(limit)
      .populate('creator', 'username profile.avatar profile.firstName profile.lastName')
      .populate('song', 'title artist coverImage duration')
      .populate({
        path: 'song',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      });

    res.json({ reels });

  } catch (error) {
    console.error('Get trending reels error:', error);
    res.status(500).json({ message: 'Server error while fetching trending reels' });
  }
});

// @route   GET /api/reels/hashtags/:hashtag
// @desc    Get reels by hashtag
// @access  Public
router.get('/hashtags/:hashtag', optionalAuth, async (req, res) => {
  try {
    const hashtag = req.params.hashtag;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const reels = await Reel.find({
      hashtags: { $in: [hashtag] },
      approvalStatus: 'approved',
      isActive: true,
      isPublic: true
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('creator', 'username profile.avatar profile.firstName profile.lastName')
      .populate('song', 'title artist coverImage duration')
      .populate({
        path: 'song',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      });

    const total = await Reel.countDocuments({
      hashtags: { $in: [hashtag] },
      approvalStatus: 'approved',
      isActive: true,
      isPublic: true
    });

    res.json({
      reels,
      hashtag,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + reels.length < total
      }
    });

  } catch (error) {
    console.error('Get reels by hashtag error:', error);
    res.status(500).json({ message: 'Server error while fetching reels by hashtag' });
  }
});

// @route   POST /api/reels
// @desc    Create new reel
// @access  Private
router.post('/', 
  auth,
  userActionLimit(10, 60 * 60 * 1000), // 10 reels per hour
  videoUpload.single('videoFile'),
  [
    body('title')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title is required and must be between 1-100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('songId')
      .notEmpty()
      .isMongoId()
      .withMessage('Valid song ID is required'),
    body('audioStartTime')
      .isFloat({ min: 0 })
      .withMessage('Audio start time must be a positive number'),
    body('audioEndTime')
      .isFloat({ min: 0 })
      .withMessage('Audio end time must be a positive number'),
    body('hashtags')
      .optional()
      .isArray()
      .withMessage('Hashtags must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Check if video file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Video file is required' });
      }

      const { title, description, songId, audioStartTime, audioEndTime, hashtags, tags, isPublic = true } = req.body;
      
      // Verify song exists and is published
      const song = await Song.findById(songId);
      if (!song || !song.isPublished) {
        await deleteFile(req.file.path);
        return res.status(404).json({ message: 'Song not found or not published' });
      }

      // Process video file
      const videoFile = req.file;
      const videoPath = videoFile.path;
      
      // Get video metadata
      const videoMetadata = await getVideoMetadata(videoPath);

      // Validate duration (max 60 seconds)
      if (videoMetadata.duration > 60) {
        await deleteFile(videoPath);
        return res.status(400).json({ message: 'Video duration must be 60 seconds or less' });
      }

      // Validate audio times
      const audioStart = parseFloat(audioStartTime);
      const audioEnd = parseFloat(audioEndTime);
      
      if (audioEnd <= audioStart) {
        await deleteFile(videoPath);
        return res.status(400).json({ message: 'Audio end time must be greater than start time' });
      }

      if (audioEnd - audioStart > 60) {
        await deleteFile(videoPath);
        return res.status(400).json({ message: 'Audio clip duration must be 60 seconds or less' });
      }

      if (audioEnd > song.duration) {
        await deleteFile(videoPath);
        return res.status(400).json({ message: 'Audio end time cannot exceed song duration' });
      }

      // Generate thumbnail
      const thumbnailName = `thumb_${videoFile.filename.replace(/\.[^/.]+$/, '.jpg')}`;
      const thumbnailPath = path.join('uploads/videos/thumbnails', thumbnailName);
      
      try {
        await generateVideoThumbnail(videoPath, thumbnailPath);
      } catch (thumbnailError) {
        console.error('Thumbnail generation error:', thumbnailError);
        // Continue without thumbnail
      }

      // Process hashtags
      let processedHashtags = [];
      if (hashtags) {
        try {
          const hashtagArray = Array.isArray(hashtags) ? hashtags : JSON.parse(hashtags);
          processedHashtags = hashtagArray.map(tag => 
            tag.replace(/^#/, '').toLowerCase().trim()
          ).filter(tag => tag.length > 0 && tag.length <= 50);
        } catch (e) {
          console.error('Hashtag processing error:', e);
        }
      }

      // Process tags
      let processedTags = [];
      if (tags) {
        try {
          const tagArray = Array.isArray(tags) ? tags : JSON.parse(tags);
          processedTags = tagArray.map(tag => tag.trim()).filter(tag => tag.length > 0);
        } catch (e) {
          console.error('Tag processing error:', e);
        }
      }

      // Create reel object
      const reelData = {
        title,
        description: description || '',
        videoUrl: `/uploads/videos/reels/${videoFile.filename}`,
        thumbnailUrl: `/uploads/videos/thumbnails/${thumbnailName}`,
        song: songId,
        audioStartTime: audioStart,
        audioEndTime: audioEnd,
        duration: videoMetadata.duration,
        creator: req.user._id,
        hashtags: processedHashtags,
        tags: processedTags,
        isPublic: isPublic === 'true' || isPublic === true,
        metadata: {
          fileSize: videoFile.size,
          resolution: `${videoMetadata.width}x${videoMetadata.height}`,
          format: videoMetadata.format,
          quality: videoMetadata.height >= 720 ? 'HD' : 'SD'
        }
      };

      const reel = new Reel(reelData);
      await reel.save();

      // Populate the response
      await reel.populate('creator', 'username profile.avatar profile.firstName profile.lastName');
      await reel.populate('song', 'title artist coverImage duration');

      res.status(201).json({
        message: 'Reel uploaded successfully and is pending approval',
        reel: {
          ...reel.toObject(),
          formattedFileSize: formatFileSize(reel.metadata.fileSize),
          formattedDuration: reel.formattedDuration
        }
      });

    } catch (error) {
      console.error('Reel upload error:', error);
      
      // Clean up uploaded file on error
      if (req.file) {
        await deleteFile(req.file.path);
      }
      
      res.status(500).json({ message: 'Server error during reel upload' });
    }
  }
);

// @route   GET /api/reels/:id
// @desc    Get specific reel
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id)
      .populate('creator', 'username profile.avatar profile.firstName profile.lastName profile.bio')
      .populate('song', 'title artist coverImage duration')
      .populate({
        path: 'song',
        populate: {
          path: 'artist',
          select: 'name avatar verified'
        }
      })
      .populate('comments.user', 'username profile.avatar');

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    // Only show approved reels to non-creators
    if (reel.approvalStatus !== 'approved' && 
        (!req.user || reel.creator._id.toString() !== req.user._id.toString())) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    // Increment view count
    await reel.incrementViews();

    res.json({
      ...reel.toObject(),
      formattedFileSize: formatFileSize(reel.metadata?.fileSize || 0),
      formattedDuration: reel.formattedDuration,
      isLiked: req.user ? reel.interactions.likedBy.some(like => 
        like.user.toString() === req.user._id.toString()
      ) : false
    });

  } catch (error) {
    console.error('Get reel details error:', error);
    res.status(500).json({ message: 'Server error while fetching reel details' });
  }
});

// @route   POST /api/reels/:id/like
// @desc    Like/unlike a reel
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    
    if (!reel || reel.approvalStatus !== 'approved') {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const wasLiked = await reel.toggleLike(req.user._id);

    res.json({ 
      message: wasLiked ? 'Reel liked' : 'Reel unliked',
      isLiked: wasLiked,
      likesCount: reel.stats.likes
    });

  } catch (error) {
    console.error('Like reel error:', error);
    res.status(500).json({ message: 'Server error while liking reel' });
  }
});

// @route   POST /api/reels/:id/comment
// @desc    Add comment to reel
// @access  Private
router.post('/:id/comment', 
  auth,
  userActionLimit(20, 60 * 60 * 1000), // 20 comments per hour
  [
    body('text')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Comment text is required and must be between 1-500 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      const reel = await Reel.findById(req.params.id);
      
      if (!reel || reel.approvalStatus !== 'approved') {
        return res.status(404).json({ message: 'Reel not found' });
      }

      const { text } = req.body;

      await reel.addComment(req.user._id, text);

      // Get the updated reel with populated comments
      const updatedReel = await Reel.findById(req.params.id)
        .populate('comments.user', 'username profile.avatar');

      const newComment = updatedReel.comments[updatedReel.comments.length - 1];

      res.status(201).json({
        message: 'Comment added successfully',
        comment: newComment,
        commentsCount: reel.stats.comments
      });

    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({ message: 'Server error while adding comment' });
    }
  }
);

// @route   GET /api/reels/user/:userId
// @desc    Get reels by specific user
// @access  Public
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Check if requesting own reels or public reels
    let query = { creator: userId };
    
    if (!req.user || req.user._id.toString() !== userId) {
      // Show only approved public reels to others
      query.approvalStatus = 'approved';
      query.isActive = true;
      query.isPublic = true;
    }

    const reels = await Reel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('creator', 'username profile.avatar profile.firstName profile.lastName')
      .populate('song', 'title artist coverImage duration')
      .populate({
        path: 'song',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      });

    const total = await Reel.countDocuments(query);

    res.json({
      reels,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + reels.length < total
      }
    });

  } catch (error) {
    console.error('Get user reels error:', error);
    res.status(500).json({ message: 'Server error while fetching user reels' });
  }
});

// @route   DELETE /api/reels/:id
// @desc    Delete own reel
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    // Check if user owns the reel or is admin
    if (reel.creator.toString() !== req.user._id.toString() && !req.user.isAdmin()) {
      return res.status(403).json({ message: 'Not authorized to delete this reel' });
    }

    // Delete files from server
    if (reel.videoUrl) {
      await deleteFile(reel.videoUrl);
    }
    if (reel.thumbnailUrl) {
      await deleteFile(reel.thumbnailUrl);
    }

    // Remove reel from database
    await Reel.findByIdAndDelete(req.params.id);

    res.json({ message: 'Reel deleted successfully' });

  } catch (error) {
    console.error('Delete reel error:', error);
    res.status(500).json({ message: 'Server error while deleting reel' });
  }
});

// @route   GET /api/reels/hashtags/popular
// @desc    Get popular hashtags
// @access  Public
router.get('/hashtags/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const popularHashtags = await Reel.aggregate([
      {
        $match: {
          approvalStatus: 'approved',
          isActive: true,
          isPublic: true
        }
      },
      {
        $unwind: '$hashtags'
      },
      {
        $group: {
          _id: '$hashtags',
          count: { $sum: 1 },
          totalViews: { $sum: '$stats.views' },
          totalLikes: { $sum: '$stats.likes' }
        }
      },
      {
        $sort: { count: -1, totalViews: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          hashtag: '$_id',
          count: 1,
          totalViews: 1,
          totalLikes: 1,
          _id: 0
        }
      }
    ]);

    res.json({ hashtags: popularHashtags });

  } catch (error) {
    console.error('Get popular hashtags error:', error);
    res.status(500).json({ message: 'Server error while fetching popular hashtags' });
  }
});

module.exports = router;