const mongoose = require('mongoose');

const artistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  bio: {
    type: String,
    maxlength: 1000
  },
  avatar: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  genres: [{
    type: String
  }],
  country: {
    type: String
  },
  verified: {
    type: Boolean,
    default: false
  },
  socialLinks: {
    website: { type: String },
    facebook: { type: String },
    twitter: { type: String },
    instagram: { type: String },
    youtube: { type: String }
  },
  stats: {
    followers: { type: Number, default: 0 },
    monthlyListeners: { type: Number, default: 0 },
    totalPlays: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Artist', artistSchema);