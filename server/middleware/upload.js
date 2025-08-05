const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

// Create upload directories if they don't exist
const createUploadDirs = async () => {
  const dirs = [
    'uploads',
    'uploads/music',
    'uploads/images',
    'uploads/images/avatars',
    'uploads/images/covers',
    'uploads/images/albums',
    'uploads/videos',
    'uploads/videos/reels',
    'uploads/videos/thumbnails'
  ];

  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
};

// Initialize upload directories
createUploadDirs();

// Generate unique filename
const generateUniqueFilename = (originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(16).toString('hex');
  const extension = path.extname(originalname);
  const baseName = path.basename(originalname, extension);
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  
  return `${sanitizedBaseName}_${timestamp}_${randomString}${extension}`;
};

// Storage configuration for different file types
const createStorage = (subfolder) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadPath = path.join('uploads', subfolder);
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueName = generateUniqueFilename(file.originalname);
      cb(null, uniqueName);
    }
  });
};

// File filter for different types
const createFileFilter = (allowedTypes) => {
  return (req, file, cb) => {
    if (allowedTypes.some(type => file.mimetype.startsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error(`Only ${allowedTypes.join(', ')} files are allowed`), false);
    }
  };
};

// Music upload configuration
const musicUpload = multer({
  storage: createStorage('music'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for music files
  },
  fileFilter: createFileFilter(['audio/']),
});

// Image upload configuration
const imageUpload = multer({
  storage: createStorage('images'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
  },
  fileFilter: createFileFilter(['image/']),
});

// Avatar upload configuration
const avatarUpload = multer({
  storage: createStorage('images/avatars'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for avatars
  },
  fileFilter: createFileFilter(['image/']),
});

// Cover image upload configuration
const coverUpload = multer({
  storage: createStorage('images/covers'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for cover images
  },
  fileFilter: createFileFilter(['image/']),
});

// Video upload configuration (for reels)
const videoUpload = multer({
  storage: createStorage('videos/reels'),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB for videos
  },
  fileFilter: createFileFilter(['video/']),
});

// Multiple files upload configuration
const multipleUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      let subfolder = 'images';
      
      if (file.fieldname === 'musicFile') {
        subfolder = 'music';
      } else if (file.fieldname === 'videoFile') {
        subfolder = 'videos/reels';
      } else if (file.fieldname === 'avatar') {
        subfolder = 'images/avatars';
      } else if (file.fieldname === 'coverImage') {
        subfolder = 'images/covers';
      }
      
      const uploadPath = path.join('uploads', subfolder);
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueName = generateUniqueFilename(file.originalname);
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max
  },
  fileFilter: function (req, file, cb) {
    const allowedMimeTypes = [
      'audio/',
      'video/',
      'image/'
    ];
    
    if (allowedMimeTypes.some(type => file.mimetype.startsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Get file metadata using ffprobe
const getAudioMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        const format = metadata.format;
        
        resolve({
          duration: Math.round(format.duration),
          bitrate: format.bit_rate,
          sampleRate: audioStream?.sample_rate,
          channels: audioStream?.channels,
          format: format.format_name,
          size: format.size,
          title: format.tags?.title || '',
          artist: format.tags?.artist || '',
          album: format.tags?.album || '',
          year: format.tags?.date || format.tags?.year || ''
        });
      }
    });
  });
};

// Get video metadata
const getVideoMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        const format = metadata.format;
        
        resolve({
          duration: Math.round(format.duration),
          width: videoStream?.width,
          height: videoStream?.height,
          fps: eval(videoStream?.r_frame_rate),
          videoBitrate: videoStream?.bit_rate,
          audioBitrate: audioStream?.bit_rate,
          format: format.format_name,
          size: format.size,
          hasAudio: !!audioStream
        });
      }
    });
  });
};

// Generate video thumbnail
const generateVideoThumbnail = (videoPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:02'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '640x360'
      })
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
};

// Process uploaded music file
const processMusicFile = async (req, res, next) => {
  if (!req.file || !req.file.filename) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const metadata = await getAudioMetadata(filePath);
    
    // Add metadata to request
    req.audioMetadata = metadata;
    req.fileUrl = `/uploads/music/${req.file.filename}`;
    
    next();
  } catch (error) {
    console.error('Error processing audio file:', error);
    // Delete the uploaded file if processing fails
    try {
      await fs.unlink(req.file.path);
    } catch {}
    
    res.status(400).json({ 
      message: 'Invalid audio file or processing failed',
      error: error.message 
    });
  }
};

// Process uploaded video file
const processVideoFile = async (req, res, next) => {
  if (!req.file || !req.file.filename) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const metadata = await getVideoMetadata(filePath);
    
    // Check video duration (max 60 seconds for reels)
    if (metadata.duration > 60) {
      await fs.unlink(filePath);
      return res.status(400).json({ 
        message: 'Video duration must be 60 seconds or less' 
      });
    }
    
    // Generate thumbnail
    const thumbnailName = `thumb_${req.file.filename.replace(/\.[^/.]+$/, '.jpg')}`;
    const thumbnailPath = path.join('uploads/videos/thumbnails', thumbnailName);
    
    await generateVideoThumbnail(filePath, thumbnailPath);
    
    // Add metadata to request
    req.videoMetadata = metadata;
    req.fileUrl = `/uploads/videos/reels/${req.file.filename}`;
    req.thumbnailUrl = `/uploads/videos/thumbnails/${thumbnailName}`;
    
    next();
  } catch (error) {
    console.error('Error processing video file:', error);
    // Delete the uploaded file if processing fails
    try {
      await fs.unlink(req.file.path);
    } catch {}
    
    res.status(400).json({ 
      message: 'Invalid video file or processing failed',
      error: error.message 
    });
  }
};

// Process uploaded image file
const processImageFile = async (req, res, next) => {
  if (!req.file || !req.file.filename) {
    return next();
  }

  try {
    const subfolder = req.file.destination.split('/').pop();
    req.fileUrl = `/uploads/images/${subfolder}/${req.file.filename}`;
    next();
  } catch (error) {
    console.error('Error processing image file:', error);
    res.status(400).json({ 
      message: 'Invalid image file or processing failed',
      error: error.message 
    });
  }
};

// Clean up old files (run periodically)
const cleanupOldFiles = async (days = 30) => {
  const directories = [
    'uploads/music',
    'uploads/images',
    'uploads/videos'
  ];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  for (const dir of directories) {
    try {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old file: ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`Error cleaning up directory ${dir}:`, error);
    }
  }
};

// Delete file helper
const deleteFile = async (filePath) => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    await fs.unlink(fullPath);
    console.log(`File deleted: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
  }
};

// Get file size helper
const getFileSize = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    return 0;
  }
};

// Format file size helper
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = {
  musicUpload,
  imageUpload,
  avatarUpload,
  coverUpload,
  videoUpload,
  multipleUpload,
  processMusicFile,
  processVideoFile,
  processImageFile,
  getAudioMetadata,
  getVideoMetadata,
  generateVideoThumbnail,
  cleanupOldFiles,
  deleteFile,
  getFileSize,
  formatFileSize,
  generateUniqueFilename
};