# 🎵 LOVAR MUSIC Platform

<div align="center">

![LOVAR MUSIC Logo](https://via.placeholder.com/200x100/8b5cf6/ffffff?text=LOVAR+MUSIC)

**The Ultimate Music Streaming Platform with AI Recommendations & Reels**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-%5E18.2.0-blue)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/mongodb-%5E6.0-green)](https://www.mongodb.com/)

[🚀 Live Demo](#) | [📖 Documentation](#) | [🐛 Report Bug](#) | [✨ Request Feature](#)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Quick Start](#-quick-start)
- [📱 User Types & Permissions](#-user-types--permissions)
- [🎵 Music Features](#-music-features)
- [🎬 Reels & Dubsmash](#-reels--dubsmash)
- [🤖 AI Recommendations](#-ai-recommendations)
- [👥 Admin Panel](#-admin-panel)
- [📱 PWA Features](#-pwa-features)
- [🔧 API Documentation](#-api-documentation)
- [🛠️ Development](#️-development)
- [📦 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

### 🎯 Core Features
- **Multi-User System**: 4 user types with different permissions
- **Music Streaming**: High-quality audio streaming with multiple formats
- **AI Recommendations**: Personalized playlists powered by machine learning
- **Reels & Dubsmash**: Create and share short music videos
- **Admin Dashboard**: Complete platform management
- **PWA Support**: Install on mobile devices like a native app
- **Offline Mode**: Continue listening with cached music
- **Real-time Notifications**: Socket.io powered live updates

### 🎵 Music Platform
- 🎧 High-quality audio streaming (128kbps to FLAC)
- 🎨 Beautiful, modern Spotify-like interface
- 📱 Responsive design for all devices
- 🔍 Advanced search with filters
- ❤️ Like, share, and comment on tracks
- 📊 Music analytics and statistics
- 🎪 Featured tracks and trending music
- 🎭 Artist profiles and verification

### 🎬 Reels & Dubsmash
- 📹 Create short videos with music clips
- 🎵 Use any song from the platform
- ✨ Add effects and filters
- 👍 Like, share, and comment system
- 🔍 Hashtag-based discovery
- ✅ Admin approval system
- 📊 View analytics and engagement

### 🤖 AI & Personalization
- 🧠 Machine learning recommendations
- 📈 User behavior analysis
- 🎯 Personalized playlists
- 🔮 Mood-based suggestions
- 📊 Advanced analytics
- 🎪 Smart content curation

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express Server │    │   MongoDB DB    │
│                 │    │                 │    │                 │
│  - React 18     │◄──►│  - Node.js 18   │◄──►│  - Users        │
│  - Tailwind CSS │    │  - Socket.io    │    │  - Songs        │
│  - Framer Motion│    │  - JWT Auth     │    │  - Playlists    │
│  - PWA Support  │    │  - File Upload  │    │  - Reels        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        │              ┌─────────────────┐                │
        └──────────────►│  File Storage   │◄───────────────┘
                       │                 │
                       │  - Music Files  │
                       │  - Images       │
                       │  - Videos       │
                       └─────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18.0.0 or higher
- **MongoDB** 6.0 or higher
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/lovar-music.git
cd lovar-music

# Install dependencies
npm run install-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
npm run dev
```

### Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/lovar-music

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# File Upload
MAX_FILE_SIZE=50000000
UPLOAD_PATH=./uploads

# Optional: Cloud Storage
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Optional: AI Features
OPENAI_API_KEY=your-openai-key

# Admin Credentials
ADMIN_EMAIL=admin@lovarmusic.com
ADMIN_PASSWORD=change-this-password
```

---

## 📱 User Types & Permissions

| User Type | Download | Skip Limit | Playlists | Ad-Free | High Quality | Admin Access |
|-----------|----------|------------|-----------|---------|--------------|--------------|
| **NORMAL** | ❌ | 5/hour | 5 max | ❌ | ❌ | ❌ |
| **PREMIUM** | ❌ | 10/hour | 20 max | ✅ | ❌ | ❌ |
| **VIP** | ✅ | Unlimited | 100 max | ✅ | ✅ | ❌ |
| **ADMIN** | ✅ | Unlimited | Unlimited | ✅ | ✅ | ✅ |

### User Permissions

```javascript
// Example permissions object
{
  canPlay: true,
  canCreatePlaylists: true,
  canLike: true,
  canDownload: false, // Only VIP and ADMIN
  canAccessAdmin: false, // Only ADMIN
  canCreateReels: true,
  canComment: true,
  maxPlaylists: 5, // Varies by user type
  skipLimit: 5, // Per hour
  adFree: false,
  highQuality: false
}
```

---

## 🎵 Music Features

### Supported Formats
- **Audio**: MP3, WAV, FLAC, AAC, OGG
- **Quality**: 128kbps, 256kbps, 320kbps, FLAC
- **Metadata**: ID3 tags, album art, lyrics

### Music Player
- 🎵 Play, pause, skip, repeat, shuffle
- 🔊 Volume control and equalizer
- 📱 Media session API integration
- 🎨 Visualizer with animated bars
- ⏮️ Previous/Next track controls
- 🔄 Repeat modes (off, one, all)
- 🔀 Shuffle mode
- 📱 Background playback support

### Playlist Management
- ➕ Create custom playlists
- 🔄 Collaborative playlists
- 📤 Share playlists
- 🎯 Auto-generated playlists
- 🏷️ Tag-based organization
- 📊 Playlist analytics

---

## 🎬 Reels & Dubsmash

### Create Reels
1. **Select Music**: Choose from available tracks
2. **Record Video**: Up to 60 seconds
3. **Edit Content**: Add effects and filters
4. **Add Details**: Title, description, hashtags
5. **Submit**: Waits for admin approval

### Reel Features
- 🎵 Audio synchronization
- ✨ Visual effects and filters
- 🏷️ Hashtag system
- 👍 Like and share functionality
- 💬 Comment system
- 📊 View analytics
- 🔥 Trending reels

### Admin Approval System
- ✅ **Approve**: Make reel public
- ❌ **Reject**: With reason for rejection
- 🔍 **Review**: Content moderation tools
- 📊 **Analytics**: Approval rates and trends

---

## 🤖 AI Recommendations

### Recommendation Engine
- **Collaborative Filtering**: Based on user behavior
- **Content-Based**: Musical features analysis
- **Hybrid Approach**: Combines multiple algorithms
- **Real-time Learning**: Adapts to user preferences

### Personalized Features
- 🎯 **Discover Weekly**: New music every week
- 🎵 **Daily Mix**: Based on listening history
- 🌅 **Morning Boost**: Energetic morning tracks
- 🌙 **Night Vibes**: Relaxing evening music
- 🏃 **Workout Mix**: High-energy tracks
- 😌 **Chill Mode**: Calm and peaceful music

### Implementation
```javascript
// Example recommendation request
POST /api/recommendations/generate
{
  userId: "user_id",
  type: "discover_weekly", // or "daily_mix", "mood_based"
  preferences: {
    genres: ["pop", "rock"],
    mood: "energetic",
    exclude: ["explicit"]
  }
}
```

---

## 👥 Admin Panel

### Dashboard Overview
- 📊 **Analytics**: User growth, popular content
- 👥 **User Management**: View and manage all users
- 🎵 **Content Management**: Approve/reject music and reels
- 📈 **Statistics**: Platform performance metrics
- ⚙️ **Settings**: System configuration

### User Management
- 📋 **View Users**: Paginated user list with filters
- ✏️ **Edit Users**: Change user type and status
- 🗑️ **Delete Users**: Remove users and their content
- 📊 **User Analytics**: Individual user statistics

### Content Moderation
- 🎵 **Music Approval**: Review uploaded songs
- 🎬 **Reel Approval**: Moderate user-generated videos
- 🏷️ **Content Tags**: Manage tags and categories
- 🚫 **Content Removal**: Remove inappropriate content

### System Analytics
- 📈 **Growth Metrics**: User and content growth
- 🎵 **Popular Content**: Most played songs and reels
- 👥 **User Behavior**: Listening patterns and preferences
- 📊 **Performance**: Server and app performance metrics

---

## 📱 PWA Features

### Mobile App Experience
- 📱 **Install to Home Screen**: Works like a native app
- 🔄 **Offline Support**: Cache music for offline listening
- 🔔 **Push Notifications**: New music and updates
- 📱 **Native Feel**: Full-screen experience
- ⚡ **Fast Loading**: Service worker caching
- 🔧 **Background Sync**: Sync when back online

### Offline Capabilities
- 🎵 **Cached Music**: Listen to downloaded tracks offline
- 📱 **App Shell**: Core app functionality works offline
- 🔄 **Background Sync**: Upload content when back online
- 📊 **Offline Analytics**: Track usage for later sync

### Installation Guide
1. **Open in Browser**: Visit the website
2. **Install Prompt**: Click "Add to Home Screen"
3. **Confirm**: Follow browser prompts
4. **Launch**: Open from home screen like any app

---

## 🔧 API Documentation

### Authentication Endpoints
```bash
POST /api/auth/register    # Register new user
POST /api/auth/login       # User login
GET  /api/auth/me          # Get current user
PUT  /api/auth/profile     # Update profile
POST /api/auth/change-password # Change password
```

### Music Endpoints
```bash
GET  /api/music/trending   # Get trending songs
GET  /api/music/search     # Search songs
POST /api/music/upload     # Upload new song
GET  /api/music/:id        # Get song details
POST /api/music/:id/play   # Record play event
POST /api/music/:id/like   # Like/unlike song
```

### Playlist Endpoints
```bash
GET  /api/playlists        # Get user playlists
POST /api/playlists        # Create playlist
PUT  /api/playlists/:id    # Update playlist
DELETE /api/playlists/:id  # Delete playlist
POST /api/playlists/:id/songs # Add song to playlist
```

### Reels Endpoints
```bash
GET  /api/reels            # Get reels feed
POST /api/reels            # Create new reel
GET  /api/reels/:id        # Get reel details
POST /api/reels/:id/like   # Like/unlike reel
POST /api/reels/:id/comment # Add comment
```

### Admin Endpoints
```bash
GET  /api/admin/dashboard  # Dashboard stats
GET  /api/admin/users      # Manage users
GET  /api/admin/songs      # Manage songs
POST /api/admin/songs/:id/approve # Approve song
POST /api/admin/reels/:id/reject  # Reject reel
```

---

## 🛠️ Development

### Project Structure
```
lovar-music/
├── client/                 # React frontend
│   ├── public/            # Static files
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   └── utils/         # Utility functions
│   └── package.json
├── server/                # Express backend
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── middleware/       # Express middleware
│   └── index.js          # Server entry point
├── uploads/              # File uploads
├── package.json          # Root package.json
└── README.md
```

### Available Scripts
```bash
# Development
npm run dev              # Start both client and server
npm run server           # Start server only
npm run client           # Start client only

# Production
npm run build            # Build for production
npm start                # Start production server

# Utilities
npm run install-deps     # Install all dependencies
npm test                 # Run tests
npm run lint             # Lint code
```

### Database Models

#### User Model
```javascript
{
  username: String,
  email: String,
  password: String (hashed),
  userType: ['NORMAL', 'PREMIUM', 'VIP', 'ADMIN'],
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: String
  },
  playlists: [ObjectId],
  likedSongs: [ObjectId],
  stats: {
    totalListeningTime: Number,
    songsPlayed: Number
  }
}
```

#### Song Model
```javascript
{
  title: String,
  artist: ObjectId,
  album: ObjectId,
  genre: String,
  duration: Number,
  fileUrl: String,
  coverImage: String,
  stats: {
    plays: Number,
    likes: Number,
    downloads: Number
  },
  approvalStatus: ['pending', 'approved', 'rejected']
}
```

#### Reel Model
```javascript
{
  title: String,
  description: String,
  videoUrl: String,
  song: ObjectId,
  creator: ObjectId,
  duration: Number,
  hashtags: [String],
  stats: {
    views: Number,
    likes: Number,
    shares: Number
  },
  approvalStatus: ['pending', 'approved', 'rejected']
}
```

---

## 📦 Deployment

### Production Deployment

1. **Server Setup**: Ubuntu 20.04+ recommended
2. **Dependencies**: Node.js 18+, MongoDB 6+, Nginx
3. **SSL**: Let's Encrypt for HTTPS
4. **Process Manager**: PM2 for production
5. **Reverse Proxy**: Nginx configuration
6. **Domain**: Point your domain to server

See [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) for detailed deployment instructions.

### Docker Deployment (Coming Soon)
```bash
# Build and run with Docker
docker-compose up -d
```

### Deployment Checklist
- [ ] Environment variables configured
- [ ] MongoDB secured and backed up
- [ ] SSL certificate installed
- [ ] File uploads directory created
- [ ] Admin user created
- [ ] Nginx configured
- [ ] PM2 process manager setup
- [ ] Monitoring and logging enabled

---

## 🧪 Testing

### Running Tests
```bash
# Backend tests
npm run test:server

# Frontend tests
npm run test:client

# End-to-end tests
npm run test:e2e

# All tests
npm test
```

### Test Coverage
- ✅ **Authentication**: Login, register, JWT validation
- ✅ **API Endpoints**: CRUD operations, error handling
- ✅ **User Permissions**: Role-based access control
- ✅ **File Upload**: Music and image upload validation
- ✅ **Database**: Model validation and queries

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Use conventional commit messages
- Ensure responsive design

---

## 📞 Support & Community

### Get Help
- 📧 **Email**: support@lovarmusic.com
- 💬 **Discord**: [Join our community](#)
- 📖 **Documentation**: [docs.lovarmusic.com](#)
- 🐛 **Issues**: [GitHub Issues](#)

### Stay Updated
- 🌟 **Star** the repository
- 👁️ **Watch** for updates
- 🐦 **Twitter**: [@lovarmusic](#)
- 📱 **Newsletter**: Subscribe for updates

---

## 🗺️ Roadmap

### Version 2.0 (Coming Soon)
- [ ] **Live Streaming**: Artist live streams
- [ ] **Podcasts**: Podcast support and discovery
- [ ] **Social Features**: User following and social feeds
- [ ] **Advanced Analytics**: Detailed user insights
- [ ] **Mobile Apps**: Native iOS and Android apps
- [ ] **Voice Commands**: Voice control integration
- [ ] **Lyrics Display**: Synchronized lyrics
- [ ] **Collaborative Filters**: Advanced recommendation filters

### Version 3.0 (Future)
- [ ] **Blockchain Integration**: NFT music support
- [ ] **VR/AR Features**: Virtual concert experiences
- [ ] **Multi-language**: International support
- [ ] **Advanced AI**: Natural language music search
- [ ] **Cloud Sync**: Cross-device synchronization

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 LOVAR MUSIC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 🙏 Acknowledgments

- **Spotify** - UI/UX inspiration
- **React Team** - Amazing frontend framework
- **MongoDB** - Flexible database solution
- **Tailwind CSS** - Utility-first CSS framework
- **Contributors** - Everyone who helped build this platform

---

<div align="center">

**Made with ❤️ by the LOVAR MUSIC Team**

[🌐 Website](#) | [📧 Contact](#) | [🐦 Twitter](#) | [💬 Discord](#)

</div>
