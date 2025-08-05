const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  userType: {
    type: String,
    enum: ['NORMAL', 'PREMIUM', 'VIP', 'ADMIN'],
    default: 'NORMAL'
  },
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    avatar: { type: String, default: '' },
    bio: { type: String, maxlength: 500 },
    dateOfBirth: { type: Date },
    country: { type: String },
    phone: { type: String }
  },
  subscription: {
    type: {
      type: String,
      enum: ['FREE', 'PREMIUM', 'VIP'],
      default: 'FREE'
    },
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: false }
  },
  preferences: {
    favoriteGenres: [{ type: String }],
    language: { type: String, default: 'en' },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  stats: {
    totalListeningTime: { type: Number, default: 0 },
    songsPlayed: { type: Number, default: 0 },
    playlistsCreated: { type: Number, default: 0 }
  },
  playlists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist'
  }],
  likedSongs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  followedArtists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist'
  }],
  recentlyPlayed: [{
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song'
    },
    playedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user can download songs
userSchema.methods.canDownload = function() {
  return this.userType === 'VIP' || this.userType === 'ADMIN';
};

// Check if user has admin access
userSchema.methods.isAdmin = function() {
  return this.userType === 'ADMIN';
};

// Get user permissions
userSchema.methods.getPermissions = function() {
  const permissions = {
    canPlay: true,
    canCreatePlaylists: true,
    canLike: true,
    canDownload: this.canDownload(),
    canAccessAdmin: this.isAdmin(),
    canCreateReels: true,
    canComment: true
  };

  switch (this.userType) {
    case 'NORMAL':
      permissions.maxPlaylists = 5;
      permissions.skipLimit = 5; // per hour
      break;
    case 'PREMIUM':
      permissions.maxPlaylists = 20;
      permissions.skipLimit = 10;
      permissions.adFree = true;
      break;
    case 'VIP':
      permissions.maxPlaylists = 100;
      permissions.skipLimit = -1; // unlimited
      permissions.adFree = true;
      permissions.highQuality = true;
      break;
    case 'ADMIN':
      permissions.maxPlaylists = -1; // unlimited
      permissions.skipLimit = -1;
      permissions.adFree = true;
      permissions.highQuality = true;
      permissions.canManageUsers = true;
      permissions.canManageContent = true;
      permissions.canViewAnalytics = true;
      break;
  }

  return permissions;
};

// Update listening stats
userSchema.methods.updateStats = function(duration) {
  this.stats.totalListeningTime += duration;
  this.stats.songsPlayed += 1;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);