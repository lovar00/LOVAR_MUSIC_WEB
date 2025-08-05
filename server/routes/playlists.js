const express = require('express');
const { body, validationResult } = require('express-validator');

// Models
const Playlist = require('../models/Playlist');
const Song = require('../models/Song');
const User = require('../models/User');

// Middleware
const { auth, optionalAuth, userActionLimit } = require('../middleware/auth');
const { 
  coverUpload,
  processImageFile,
  deleteFile,
  formatFileSize
} = require('../middleware/upload');

const router = express.Router();

// @route   GET /api/playlists
// @desc    Get user's playlists
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const playlists = await Playlist.find({
      $or: [
        { creator: req.user._id },
        { collaborators: req.user._id }
      ]
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
      $or: [
        { creator: req.user._id },
        { collaborators: req.user._id }
      ]
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
    console.error('Get playlists error:', error);
    res.status(500).json({ message: 'Server error while fetching playlists' });
  }
});

// @route   GET /api/playlists/featured
// @desc    Get featured public playlists
// @access  Public
router.get('/featured', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const playlists = await Playlist.find({
      isPublic: true,
      'songs.0': { $exists: true } // Has at least one song
    })
      .sort({ 'stats.plays': -1, 'stats.followers': -1, createdAt: -1 })
      .limit(limit)
      .populate('creator', 'username profile.avatar')
      .populate('songs.song', 'title artist coverImage duration')
      .populate({
        path: 'songs.song',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      });

    res.json({ playlists });

  } catch (error) {
    console.error('Get featured playlists error:', error);
    res.status(500).json({ message: 'Server error while fetching featured playlists' });
  }
});

// @route   POST /api/playlists
// @desc    Create new playlist
// @access  Private
router.post('/', 
  auth,
  userActionLimit(20, 60 * 60 * 1000), // 20 playlists per hour
  coverUpload.single('coverImage'),
  [
    body('title')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title is required and must be between 1-100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),
    body('collaborative')
      .optional()
      .isBoolean()
      .withMessage('collaborative must be a boolean')
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

      // Check user's playlist limit
      const user = req.user;
      const permissions = user.getPermissions();
      const currentPlaylistCount = await Playlist.countDocuments({ creator: user._id });

      if (permissions.maxPlaylists !== -1 && currentPlaylistCount >= permissions.maxPlaylists) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(403).json({ 
          message: `You have reached your playlist limit of ${permissions.maxPlaylists}. Upgrade to create more playlists.` 
        });
      }

      const { title, description, isPublic = true, collaborative = false, tags } = req.body;

      // Process cover image
      let coverImageUrl = '';
      if (req.file) {
        coverImageUrl = `/uploads/images/covers/${req.file.filename}`;
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

      const playlist = new Playlist({
        title,
        description: description || '',
        coverImage: coverImageUrl,
        creator: user._id,
        isPublic: isPublic === 'true' || isPublic === true,
        collaborative: collaborative === 'true' || collaborative === true,
        tags: processedTags
      });

      await playlist.save();

      // Update user's playlist count
      user.stats.playlistsCreated = currentPlaylistCount + 1;
      user.playlists.push(playlist._id);
      await user.save();

      // Populate the response
      await playlist.populate('creator', 'username profile.avatar');

      res.status(201).json({
        message: 'Playlist created successfully',
        playlist
      });

    } catch (error) {
      console.error('Create playlist error:', error);
      
      // Clean up uploaded file on error
      if (req.file) {
        await deleteFile(req.file.path);
      }
      
      res.status(500).json({ message: 'Server error during playlist creation' });
    }
  }
);

// @route   GET /api/playlists/:id
// @desc    Get specific playlist
// @access  Public/Private (depends on playlist privacy)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('creator', 'username profile.avatar profile.firstName profile.lastName')
      .populate('collaborators', 'username profile.avatar')
      .populate('songs.song', 'title artist coverImage duration fileUrl stats')
      .populate({
        path: 'songs.song',
        populate: {
          path: 'artist',
          select: 'name avatar verified'
        }
      });

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check access permissions
    const isOwner = req.user && playlist.creator._id.toString() === req.user._id.toString();
    const isCollaborator = req.user && playlist.collaborators.some(
      collab => collab._id.toString() === req.user._id.toString()
    );

    if (!playlist.isPublic && !isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'This playlist is private' });
    }

    // Calculate total duration
    const totalDuration = playlist.songs.reduce((total, item) => {
      return total + (item.song?.duration || 0);
    }, 0);

    res.json({
      ...playlist.toObject(),
      totalDuration,
      songsCount: playlist.songs.length,
      canEdit: isOwner || (playlist.collaborative && isCollaborator),
      isFollowing: req.user ? playlist.followers.includes(req.user._id) : false
    });

  } catch (error) {
    console.error('Get playlist details error:', error);
    res.status(500).json({ message: 'Server error while fetching playlist details' });
  }
});

// @route   PUT /api/playlists/:id
// @desc    Update playlist
// @access  Private (owner and collaborators)
router.put('/:id', 
  auth,
  coverUpload.single('coverImage'),
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title must be between 1-100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      const playlist = await Playlist.findById(req.params.id);
      
      if (!playlist) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(404).json({ message: 'Playlist not found' });
      }

      // Check permissions
      const isOwner = playlist.creator.toString() === req.user._id.toString();
      const isCollaborator = playlist.collaborators.includes(req.user._id);

      if (!isOwner && !(playlist.collaborative && isCollaborator)) {
        if (req.file) {
          await deleteFile(req.file.path);
        }
        return res.status(403).json({ message: 'Not authorized to edit this playlist' });
      }

      const { title, description, isPublic, collaborative, tags } = req.body;

      // Update fields (only owner can change privacy settings)
      if (title) playlist.title = title;
      if (description !== undefined) playlist.description = description;
      
      if (isOwner) {
        if (isPublic !== undefined) playlist.isPublic = isPublic === 'true' || isPublic === true;
        if (collaborative !== undefined) playlist.collaborative = collaborative === 'true' || collaborative === true;
      }

      // Process tags
      if (tags) {
        try {
          const tagArray = Array.isArray(tags) ? tags : JSON.parse(tags);
          playlist.tags = tagArray.map(tag => tag.trim()).filter(tag => tag.length > 0);
        } catch (e) {
          console.error('Tag processing error:', e);
        }
      }

      // Update cover image
      if (req.file) {
        // Delete old cover image
        if (playlist.coverImage) {
          await deleteFile(playlist.coverImage);
        }
        playlist.coverImage = `/uploads/images/covers/${req.file.filename}`;
      }

      await playlist.save();
      await playlist.populate('creator', 'username profile.avatar');

      res.json({
        message: 'Playlist updated successfully',
        playlist
      });

    } catch (error) {
      console.error('Update playlist error:', error);
      
      if (req.file) {
        await deleteFile(req.file.path);
      }
      
      res.status(500).json({ message: 'Server error during playlist update' });
    }
  }
);

// @route   POST /api/playlists/:id/songs
// @desc    Add song to playlist
// @access  Private (owner and collaborators)
router.post('/:id/songs', 
  auth,
  userActionLimit(50, 60 * 60 * 1000), // 50 songs per hour
  [
    body('songId')
      .notEmpty()
      .isMongoId()
      .withMessage('Valid song ID is required')
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

      const playlist = await Playlist.findById(req.params.id);
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }

      // Check permissions
      const isOwner = playlist.creator.toString() === req.user._id.toString();
      const isCollaborator = playlist.collaborators.includes(req.user._id);

      if (!isOwner && !(playlist.collaborative && isCollaborator)) {
        return res.status(403).json({ message: 'Not authorized to edit this playlist' });
      }

      const { songId } = req.body;

      // Verify song exists and is published
      const song = await Song.findById(songId);
      if (!song || !song.isPublished) {
        return res.status(404).json({ message: 'Song not found or not published' });
      }

      // Check if song is already in playlist
      const songExists = playlist.songs.some(item => 
        item.song.toString() === songId
      );

      if (songExists) {
        return res.status(400).json({ message: 'Song is already in this playlist' });
      }

      // Add song to playlist
      playlist.songs.push({
        song: songId,
        addedAt: new Date()
      });

      // Update total duration
      playlist.totalDuration = playlist.songs.reduce((total, item) => {
        return total + (song.duration || 0);
      }, 0);

      await playlist.save();

      // Populate the new song
      await playlist.populate('songs.song', 'title artist coverImage duration');
      await playlist.populate({
        path: 'songs.song',
        populate: {
          path: 'artist',
          select: 'name avatar'
        }
      });

      const addedSong = playlist.songs[playlist.songs.length - 1];

      res.json({
        message: 'Song added to playlist successfully',
        song: addedSong,
        songsCount: playlist.songs.length
      });

    } catch (error) {
      console.error('Add song to playlist error:', error);
      res.status(500).json({ message: 'Server error while adding song to playlist' });
    }
  }
);

// @route   DELETE /api/playlists/:id/songs/:songId
// @desc    Remove song from playlist
// @access  Private (owner and collaborators)
router.delete('/:id/songs/:songId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check permissions
    const isOwner = playlist.creator.toString() === req.user._id.toString();
    const isCollaborator = playlist.collaborators.includes(req.user._id);

    if (!isOwner && !(playlist.collaborative && isCollaborator)) {
      return res.status(403).json({ message: 'Not authorized to edit this playlist' });
    }

    const songId = req.params.songId;

    // Remove song from playlist
    const initialLength = playlist.songs.length;
    playlist.songs = playlist.songs.filter(item => 
      item.song.toString() !== songId
    );

    if (playlist.songs.length === initialLength) {
      return res.status(404).json({ message: 'Song not found in playlist' });
    }

    await playlist.save();

    res.json({
      message: 'Song removed from playlist successfully',
      songsCount: playlist.songs.length
    });

  } catch (error) {
    console.error('Remove song from playlist error:', error);
    res.status(500).json({ message: 'Server error while removing song from playlist' });
  }
});

// @route   POST /api/playlists/:id/follow
// @desc    Follow/unfollow playlist
// @access  Private
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist || !playlist.isPublic) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    const userId = req.user._id;
    const isFollowing = playlist.followers.includes(userId);

    if (isFollowing) {
      // Unfollow
      playlist.followers = playlist.followers.filter(
        id => id.toString() !== userId.toString()
      );
      playlist.stats.followers = Math.max(0, playlist.stats.followers - 1);
    } else {
      // Follow
      playlist.followers.push(userId);
      playlist.stats.followers += 1;
    }

    await playlist.save();

    res.json({
      message: isFollowing ? 'Playlist unfollowed' : 'Playlist followed',
      isFollowing: !isFollowing,
      followersCount: playlist.stats.followers
    });

  } catch (error) {
    console.error('Follow playlist error:', error);
    res.status(500).json({ message: 'Server error while following playlist' });
  }
});

// @route   DELETE /api/playlists/:id
// @desc    Delete playlist
// @access  Private (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if user is the owner
    if (playlist.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this playlist' });
    }

    // Delete cover image if exists
    if (playlist.coverImage) {
      await deleteFile(playlist.coverImage);
    }

    // Remove playlist from user's playlists
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { playlists: playlist._id }
    });

    // Delete playlist
    await Playlist.findByIdAndDelete(req.params.id);

    res.json({ message: 'Playlist deleted successfully' });

  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ message: 'Server error while deleting playlist' });
  }
});

// @route   GET /api/playlists/search
// @desc    Search public playlists
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20, page = 1 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const skip = (page - 1) * limit;

    const playlists = await Playlist.find({
      isPublic: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    })
      .sort({ 'stats.followers': -1, 'stats.plays': -1 })
      .limit(parseInt(limit))
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
      isPublic: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    });

    res.json({
      playlists,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + playlists.length < total
      },
      searchQuery: q
    });

  } catch (error) {
    console.error('Search playlists error:', error);
    res.status(500).json({ message: 'Server error while searching playlists' });
  }
});

module.exports = router;