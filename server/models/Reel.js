const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  videoUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  song: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    required: true
  },
  audioStartTime: {
    type: Number, // in seconds - where the audio clip starts in the original song
    default: 0
  },
  audioEndTime: {
    type: Number, // in seconds - where the audio clip ends
    required: true
  },
  duration: {
    type: Number, // total video duration in seconds
    required: true,
    max: 60 // maximum 60 seconds
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    maxlength: 30
  }],
  hashtags: [{
    type: String,
    maxlength: 50
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  rejectedAt: {
    type: Date
  },
  stats: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 }
  },
  interactions: {
    likedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      likedAt: { type: Date, default: Date.now }
    }],
    sharedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sharedAt: { type: Date, default: Date.now },
      platform: { type: String } // 'internal', 'facebook', 'twitter', etc.
    }]
  },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 },
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String, maxlength: 300 },
      createdAt: { type: Date, default: Date.now }
    }]
  }],
  metadata: {
    fileSize: { type: Number },
    resolution: { type: String }, // e.g., "1080x1920"
    format: { type: String }, // e.g., "mp4"
    quality: { type: String } // e.g., "HD", "FHD"
  },
  effects: [{
    name: { type: String },
    settings: { type: mongoose.Schema.Types.Mixed }
  }],
  filters: [{
    name: { type: String },
    intensity: { type: Number, min: 0, max: 100 }
  }],
  isOriginalContent: {
    type: Boolean,
    default: true
  },
  copyrightClaim: {
    hasClaim: { type: Boolean, default: false },
    claimant: { type: String },
    description: { type: String }
  },
  reportCount: {
    type: Number,
    default: 0
  },
  reports: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { 
      type: String,
      enum: ['inappropriate', 'copyright', 'spam', 'harassment', 'violence', 'other']
    },
    description: { type: String },
    reportedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
reelSchema.index({ approvalStatus: 1 });
reelSchema.index({ creator: 1 });
reelSchema.index({ song: 1 });
reelSchema.index({ 'stats.views': -1 });
reelSchema.index({ 'stats.likes': -1 });
reelSchema.index({ createdAt: -1 });
reelSchema.index({ tags: 1 });
reelSchema.index({ hashtags: 1 });

// Virtual for formatted duration
reelSchema.virtual('formattedDuration').get(function() {
  return `${this.duration}s`;
});

// Method to increment views
reelSchema.methods.incrementViews = function() {
  this.stats.views += 1;
  return this.save();
};

// Method to toggle like
reelSchema.methods.toggleLike = function(userId) {
  const existingLike = this.interactions.likedBy.find(like => 
    like.user.toString() === userId.toString()
  );

  if (existingLike) {
    // Remove like
    this.interactions.likedBy = this.interactions.likedBy.filter(like => 
      like.user.toString() !== userId.toString()
    );
    this.stats.likes = Math.max(0, this.stats.likes - 1);
  } else {
    // Add like
    this.interactions.likedBy.push({ user: userId });
    this.stats.likes += 1;
  }

  return this.save();
};

// Method to add comment
reelSchema.methods.addComment = function(userId, text) {
  this.comments.push({
    user: userId,
    text: text
  });
  this.stats.comments += 1;
  return this.save();
};

// Method to approve reel
reelSchema.methods.approve = function(adminId) {
  this.approvalStatus = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

// Method to reject reel
reelSchema.methods.reject = function(adminId, reason) {
  this.approvalStatus = 'rejected';
  this.approvedBy = adminId;
  this.rejectionReason = reason;
  this.rejectedAt = new Date();
  return this.save();
};

// Static method to get trending reels
reelSchema.statics.getTrending = function(limit = 20) {
  return this.find({ 
    approvalStatus: 'approved',
    isActive: true,
    isPublic: true 
  })
  .sort({ 'stats.views': -1, 'stats.likes': -1 })
  .limit(limit)
  .populate('creator', 'username profile.avatar')
  .populate('song', 'title artist coverImage');
};

// Static method to get reels by hashtag
reelSchema.statics.getByHashtag = function(hashtag, limit = 20) {
  return this.find({
    hashtags: { $in: [hashtag] },
    approvalStatus: 'approved',
    isActive: true,
    isPublic: true
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('creator', 'username profile.avatar')
  .populate('song', 'title artist coverImage');
};

// Static method to get pending reels for admin approval
reelSchema.statics.getPendingApproval = function() {
  return this.find({ approvalStatus: 'pending' })
    .sort({ createdAt: 1 })
    .populate('creator', 'username email profile.avatar')
    .populate('song', 'title artist coverImage');
};

module.exports = mongoose.model('Reel', reelSchema);