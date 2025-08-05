const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  album: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album'
  },
  genre: {
    type: String,
    required: true
  },
  subGenre: {
    type: String
  },
  duration: {
    type: Number, // in seconds
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  coverImage: {
    type: String,
    default: ''
  },
  lyrics: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'en'
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  tags: [{
    type: String
  }],
  mood: {
    type: String,
    enum: ['Happy', 'Sad', 'Energetic', 'Calm', 'Romantic', 'Party', 'Workout', 'Chill']
  },
  bpm: {
    type: Number // beats per minute
  },
  key: {
    type: String // musical key
  },
  stats: {
    plays: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 }
  },
  isExplicit: {
    type: Boolean,
    default: false
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  quality: {
    type: String,
    enum: ['128kbps', '256kbps', '320kbps', 'FLAC'],
    default: '128kbps'
  },
  fileSize: {
    type: Number // in bytes
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String
  },
  copyright: {
    owner: { type: String },
    year: { type: Number },
    isOriginal: { type: Boolean, default: false }
  },
  metadata: {
    bitrate: { type: Number },
    sampleRate: { type: Number },
    channels: { type: Number },
    format: { type: String }
  }
}, {
  timestamps: true
});

// Indexes for better performance
songSchema.index({ title: 'text', 'artist.name': 'text' });
songSchema.index({ genre: 1 });
songSchema.index({ 'stats.plays': -1 });
songSchema.index({ releaseDate: -1 });
songSchema.index({ isPublished: 1 });

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Method to increment play count
songSchema.methods.incrementPlays = function() {
  this.stats.plays += 1;
  return this.save();
};

// Method to increment likes
songSchema.methods.incrementLikes = function() {
  this.stats.likes += 1;
  return this.save();
};

// Method to decrement likes
songSchema.methods.decrementLikes = function() {
  if (this.stats.likes > 0) {
    this.stats.likes -= 1;
  }
  return this.save();
};

// Static method to get trending songs
songSchema.statics.getTrending = function(limit = 10) {
  return this.find({ isPublished: true })
    .sort({ 'stats.plays': -1 })
    .limit(limit)
    .populate('artist', 'name avatar')
    .populate('album', 'title coverImage');
};

// Static method to get new releases
songSchema.statics.getNewReleases = function(limit = 10) {
  return this.find({ isPublished: true })
    .sort({ releaseDate: -1 })
    .limit(limit)
    .populate('artist', 'name avatar')
    .populate('album', 'title coverImage');
};

// Static method to search songs
songSchema.statics.searchSongs = function(query, limit = 20) {
  return this.find({
    $and: [
      { isPublished: true },
      {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }
    ]
  })
  .limit(limit)
  .populate('artist', 'name avatar')
  .populate('album', 'title coverImage');
};

module.exports = mongoose.model('Song', songSchema);