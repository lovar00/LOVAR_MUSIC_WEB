const express = require('express');
const { body, validationResult } = require('express-validator');
const path = require('path');

// Models
const Song = require('../models/Song');
const Artist = require('../models/Artist');
const User = require('../models/User');

// Middleware
const { auth, optionalAuth, userActionLimit } = require('../middleware/auth');
const { 
  musicUpload, 
  coverUpload, 
  multipleUpload,
  processMusicFile,
  processImageFile,
  deleteFile,
  getFileSize,
  formatFileSize
} = require('../middleware/upload');

const router = express.Router();

// @route   GET /api/music/trending
// @desc    Get trending songs
// @access  Public
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const songs = await Song.find({ 
      isPublished: true,
      approvalStatus: 'approved' 
    })
      .sort({ 'stats.plays': -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('artist', 'name avatar verified')
      .populate('album', 'title coverImage')
      .select('-rejectionReason');

    const total = await Song.countDocuments({ 
      isPublished: true,
      approvalStatus: 'approved' 
    });

    res.json({
      songs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + songs.length < total
      }
    });

  } catch (error) {
    console.error('Get trending songs error:', error);
    res.status(500).json({ message: 'Server error while fetching trending songs' });
  }
});

// @route   GET /api/music/new-releases
// @desc    Get new release songs
// @access  Public
router.get('/new-releases', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const songs = await Song.find({ 
      isPublished: true,
      approvalStatus: 'approved' 
    })
      .sort({ releaseDate: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('artist', 'name avatar verified')
      .populate('album', 'title coverImage')
      .select('-rejectionReason');

    const total = await Song.countDocuments({ 
      isPublished: true,
      approvalStatus: 'approved' 
    });

    res.json({
      songs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + songs.length < total
      }
    });

  } catch (error) {
    console.error('Get new releases error:', error);
    res.status(500).json({ message: 'Server error while fetching new releases' });
  }
});

// @route   GET /api/music/search
// @desc    Search songs
// @access  Public
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q, genre, artist, limit = 20, page = 1 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const skip = (page - 1) * limit;
    
    // Build search query
    let searchQuery = {
      isPublished: true,
      approvalStatus: 'approved',
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    if (genre) {
      searchQuery.genre = { $regex: genre, $options: 'i' };
    }

    const songs = await Song.find(searchQuery)
      .sort({ 'stats.plays': -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('artist', 'name avatar verified')
      .populate('album', 'title coverImage')
      .select('-rejectionReason');

    // Also search artists if no specific filters
    let artists = [];
    if (!genre && !artist) {
      artists = await Artist.find({
        name: { $regex: q, $options: 'i' }
      })
      .limit(10)
      .select('name avatar verified genres');
    }

    const total = await Song.countDocuments(searchQuery);

    res.json({
      songs,
      artists,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        hasMore: skip + songs.length < total
      },
      searchQuery: q
    });

  } catch (error) {
    console.error('Search songs error:', error);
    res.status(500).json({ message: 'Server error while searching songs' });
  }
});

// @route   POST /api/music/upload
// @desc    Upload new song
// @access  Private
router.post('/upload', 
  auth,
  userActionLimit(5, 60 * 60 * 1000), // 5 uploads per hour
  multipleUpload.fields([
    { name: 'musicFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
  ]),
  [
    body('title')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title is required and must be between 1-100 characters'),
    body('artistId')
      .notEmpty()
      .isMongoId()
      .withMessage('Valid artist ID is required'),
    body('genre')
      .notEmpty()
      .trim()
      .withMessage('Genre is required'),
    body('lyrics')
      .optional()
      .isLength({ max: 5000 })
      .withMessage('Lyrics must be less than 5000 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Clean up uploaded files if validation fails
        if (req.files) {
          if (req.files.musicFile) await deleteFile(req.files.musicFile[0].path);
          if (req.files.coverImage) await deleteFile(req.files.coverImage[0].path);
        }
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      // Check if music file was uploaded
      if (!req.files || !req.files.musicFile) {
        return res.status(400).json({ message: 'Music file is required' });
      }

      const { title, artistId, albumId, genre, subGenre, lyrics, tags, mood, language = 'en' } = req.body;
      
      // Verify artist exists
      const artist = await Artist.findById(artistId);
      if (!artist) {
        // Clean up uploaded files
        await deleteFile(req.files.musicFile[0].path);
        if (req.files.coverImage) await deleteFile(req.files.coverImage[0].path);
        return res.status(404).json({ message: 'Artist not found' });
      }

      // Process music file
      const musicFile = req.files.musicFile[0];
      const musicPath = musicFile.path;
      
      // Get audio metadata using our middleware function
      const { getAudioMetadata } = require('../middleware/upload');
      const audioMetadata = await getAudioMetadata(musicPath);

      // Process cover image
      let coverImageUrl = '';
      if (req.files.coverImage) {
        const coverFile = req.files.coverImage[0];
        coverImageUrl = `/uploads/images/covers/${coverFile.filename}`;
      }

      // Create song object
      const songData = {
        title,
        artist: artistId,
        genre,
        duration: audioMetadata.duration,
        fileUrl: `/uploads/music/${musicFile.filename}`,
        coverImage: coverImageUrl,
        lyrics: lyrics || '',
        language,
        uploadedBy: req.user._id,
        fileSize: musicFile.size,
        metadata: {
          bitrate: audioMetadata.bitrate,
          sampleRate: audioMetadata.sampleRate,
          channels: audioMetadata.channels,
          format: audioMetadata.format
        }
      };

      // Optional fields
      if (albumId) songData.album = albumId;
      if (subGenre) songData.subGenre = subGenre;
      if (mood) songData.mood = mood;
      if (tags) songData.tags = JSON.parse(tags);

      // Auto-populate from metadata if available
      if (!title && audioMetadata.title) songData.title = audioMetadata.title;

      const song = new Song(songData);
      await song.save();

      // Populate the response
      await song.populate('artist', 'name avatar verified');
      if (albumId) await song.populate('album', 'title coverImage');

      res.status(201).json({
        message: 'Song uploaded successfully and is pending approval',
        song: {
          ...song.toObject(),
          formattedFileSize: formatFileSize(song.fileSize),
          formattedDuration: song.formattedDuration
        }
      });

    } catch (error) {
      console.error('Song upload error:', error);
      
      // Clean up uploaded files on error
      if (req.files) {
        if (req.files.musicFile) await deleteFile(req.files.musicFile[0].path);
        if (req.files.coverImage) await deleteFile(req.files.coverImage[0].path);
      }
      
      res.status(500).json({ message: 'Server error during song upload' });
    }
  }
);

// @route   GET /api/music/:id
// @desc    Get song details
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .populate('artist', 'name avatar verified bio')
      .populate('album', 'title coverImage releaseDate')
      .populate('uploadedBy', 'username');

    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Only show published songs to non-uploaders
    if (!song.isPublished && (!req.user || song.uploadedBy._id.toString() !== req.user._id.toString())) {
      return res.status(404).json({ message: 'Song not found' });
    }

    res.json({
      ...song.toObject(),
      formattedFileSize: formatFileSize(song.fileSize),
      formattedDuration: song.formattedDuration
    });

  } catch (error) {
    console.error('Get song details error:', error);
    res.status(500).json({ message: 'Server error while fetching song details' });
  }
});

// @route   POST /api/music/:id/play
// @desc    Record a play for analytics
// @access  Public (with optional auth)
router.post('/:id/play', optionalAuth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song || !song.isPublished) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Increment play count
    await song.incrementPlays();

    // Update user stats if authenticated
    if (req.user) {
      await req.user.updateStats(song.duration);
      
      // Add to recently played
      const recentIndex = req.user.recentlyPlayed.findIndex(
        item => item.song.toString() === song._id.toString()
      );
      
      if (recentIndex > -1) {
        // Remove existing entry
        req.user.recentlyPlayed.splice(recentIndex, 1);
      }
      
      // Add to beginning
      req.user.recentlyPlayed.unshift({
        song: song._id,
        playedAt: new Date()
      });
      
      // Keep only last 50 tracks
      if (req.user.recentlyPlayed.length > 50) {
        req.user.recentlyPlayed = req.user.recentlyPlayed.slice(0, 50);
      }
      
      await req.user.save();
    }

    res.json({ message: 'Play recorded successfully' });

  } catch (error) {
    console.error('Record play error:', error);
    res.status(500).json({ message: 'Server error while recording play' });
  }
});

// @route   POST /api/music/:id/like
// @desc    Like/unlike a song
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song || !song.isPublished) {
      return res.status(404).json({ message: 'Song not found' });
    }

    const user = req.user;
    const isLiked = user.likedSongs.includes(song._id);

    if (isLiked) {
      // Unlike
      user.likedSongs = user.likedSongs.filter(
        id => id.toString() !== song._id.toString()
      );
      await song.decrementLikes();
    } else {
      // Like
      user.likedSongs.push(song._id);
      await song.incrementLikes();
    }

    await user.save();

    res.json({ 
      message: isLiked ? 'Song unliked' : 'Song liked',
      isLiked: !isLiked,
      likesCount: song.stats.likes + (isLiked ? -1 : 1)
    });

  } catch (error) {
    console.error('Like song error:', error);
    res.status(500).json({ message: 'Server error while liking song' });
  }
});

// @route   GET /api/music/:id/download
// @desc    Download song (VIP and ADMIN only)
// @access  Private (VIP/ADMIN)
router.get('/:id/download', auth, async (req, res) => {
  try {
    // Check if user can download
    if (!req.user.canDownload()) {
      return res.status(403).json({ 
        message: 'Download feature requires VIP or ADMIN subscription' 
      });
    }

    const song = await Song.findById(req.params.id);
    
    if (!song || !song.isPublished) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Increment download count
    song.stats.downloads += 1;
    await song.save();

    // Set download headers
    const filePath = path.join(process.cwd(), song.fileUrl);
    const fileName = `${song.title} - ${song.artist.name}.${path.extname(song.fileUrl)}`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ message: 'Error downloading file' });
      }
    });

  } catch (error) {
    console.error('Download song error:', error);
    res.status(500).json({ message: 'Server error while downloading song' });
  }
});

// @route   GET /api/music/genres
// @desc    Get all available genres
// @access  Public
router.get('/genres', async (req, res) => {
  try {
    const genres = await Song.distinct('genre', { 
      isPublished: true,
      approvalStatus: 'approved' 
    });
    
    res.json({ genres: genres.filter(genre => genre) });

  } catch (error) {
    console.error('Get genres error:', error);
    res.status(500).json({ message: 'Server error while fetching genres' });
  }
});

// @route   DELETE /api/music/:id
// @desc    Delete own uploaded song
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Check if user owns the song or is admin
    if (song.uploadedBy.toString() !== req.user._id.toString() && !req.user.isAdmin()) {
      return res.status(403).json({ message: 'Not authorized to delete this song' });
    }

    // Delete files from server
    if (song.fileUrl) {
      await deleteFile(song.fileUrl);
    }
    if (song.coverImage) {
      await deleteFile(song.coverImage);
    }

    // Remove song from database
    await Song.findByIdAndDelete(req.params.id);

    // Remove from user's liked songs
    await User.updateMany(
      { likedSongs: song._id },
      { $pull: { likedSongs: song._id } }
    );

    res.json({ message: 'Song deleted successfully' });

  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ message: 'Server error while deleting song' });
  }
});

module.exports = router;