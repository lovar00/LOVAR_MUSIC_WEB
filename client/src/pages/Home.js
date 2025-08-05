import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Play, Heart, MoreHorizontal, TrendingUp, Clock, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

// Sample data - in real app this would come from API
const featuredTrack = {
  id: 1,
  title: "Escape Plan",
  artist: "Travis Scott", 
  coverImage: "/api/placeholder/600/400",
  isPlaying: false
};

const playlists = [
  {
    id: 1,
    title: "Make some noise",
    description: "Energetic tracks to get you pumped",
    coverImage: "/api/placeholder/300/300",
    tracks: 25
  },
  {
    id: 2,
    title: "Relax pill",
    description: "Chill vibes for relaxation",
    coverImage: "/api/placeholder/300/300", 
    tracks: 18
  },
  {
    id: 3,
    title: "Fresh Finds",
    description: "New music discoveries",
    coverImage: "/api/placeholder/300/300",
    tracks: 30
  },
  {
    id: 4,
    title: "Monster beats",
    description: "Heavy bass and beats",
    coverImage: "/api/placeholder/300/300",
    tracks: 22
  }
];

const topArtists = [
  { id: 1, name: "Billie Eilish", avatar: "/api/placeholder/100/100", followers: "65M" },
  { id: 2, name: "Travis Scott", avatar: "/api/placeholder/100/100", followers: "45M" },
  { id: 3, name: "Doja Cat", avatar: "/api/placeholder/100/100", followers: "38M" },
  { id: 4, name: "Adele", avatar: "/api/placeholder/100/100", followers: "52M" },
  { id: 5, name: "Lil X Nas", avatar: "/api/placeholder/100/100", followers: "28M" },
  { id: 6, name: "Oliver Tree", avatar: "/api/placeholder/100/100", followers: "15M" }
];

const hotBoosts = [
  { id: 1, title: "Candy", artist: "ROSALÍA", percentage: "37%", trend: "up", cover: "/api/placeholder/60/60" },
  { id: 2, title: "CRASH", artist: "Charli XCX", percentage: "32%", trend: "up", cover: "/api/placeholder/60/60" },
  { id: 3, title: "Heat Waves", artist: "Glass Animals", percentage: "15%", trend: "down", cover: "/api/placeholder/60/60" },
  { id: 4, title: "My Love", artist: "Florence + The Machine", percentage: "23%", trend: "up", cover: "/api/placeholder/60/60" },
  { id: 5, title: "Woman", artist: "Doja Cat", percentage: "7%", trend: "down", cover: "/api/placeholder/60/60" }
];

const Home = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <Helmet>
        <title>LOVAR MUSIC - Your Music, Your Vibe</title>
        <meta name="description" content="Discover, stream, and enjoy your favorite music on LOVAR MUSIC" />
      </Helmet>

      {/* Main Content */}
      <div className="flex-1 p-6 lg:p-8">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gradient">
                {getGreeting()}, {user?.username || 'Music Lover'}!
              </h1>
              <p className="text-dark-400 mt-2">Ready to discover amazing music?</p>
            </div>
            
            {/* Wallet Address */}
            <div className="hidden lg:flex items-center bg-dark-800 rounded-full px-4 py-2 border border-dark-600">
              <div className="w-2 h-2 bg-accent-green rounded-full mr-2"></div>
              <span className="text-sm text-dark-300">0x2748493938334l254</span>
            </div>
          </div>
        </motion.div>

        {/* Featured Track Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl overflow-hidden p-8 lg:p-12">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-4 right-4 text-6xl">⭐</div>
              <div className="absolute bottom-8 left-8 text-4xl">✈️</div>
              <div className="absolute top-1/2 right-1/3 text-5xl">👑</div>
            </div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between">
              <div className="flex-1 mb-6 lg:mb-0">
                <div className="flex items-center mb-4">
                  <TrendingUp className="w-5 h-5 mr-2 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Trending now</span>
                </div>
                
                <h2 className="text-4xl lg:text-6xl font-bold mb-2">{featuredTrack.title}</h2>
                <p className="text-xl lg:text-2xl text-blue-200 mb-6">{featuredTrack.artist}</p>
                
                <button className="btn-primary inline-flex items-center">
                  <Play className="w-5 h-5 mr-2" />
                  LISTEN NOW
                </button>
              </div>
              
              <div className="lg:ml-8">
                <div className="relative">
                  <img
                    src={featuredTrack.coverImage}
                    alt={featuredTrack.title}
                    className="w-48 h-48 lg:w-64 lg:h-64 rounded-2xl shadow-2xl"
                  />
                  <div className="absolute -top-2 -right-2 bg-white text-black rounded-full p-2">
                    <Heart className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Playlists */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Playlists for you</h3>
                <button className="text-accent-purple hover:text-accent-pink transition-colors">
                  All playlists →
                </button>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {playlists.map((playlist, index) => (
                  <motion.div
                    key={playlist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="group cursor-pointer"
                  >
                    <div className="relative bg-dark-800 rounded-xl p-4 hover:bg-dark-700 transition-all duration-300 card-hover">
                      <div className="relative mb-4">
                        <img
                          src={playlist.coverImage}
                          alt={playlist.title}
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 rounded-lg flex items-center justify-center">
                          <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100" />
                        </div>
                      </div>
                      
                      <h4 className="font-semibold text-white mb-1 truncate">{playlist.title}</h4>
                      <p className="text-sm text-dark-400 mb-2 line-clamp-2">{playlist.description}</p>
                      <p className="text-xs text-dark-500">{playlist.tracks} tracks</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Top Artists */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Top artists</h3>
                <button className="text-accent-purple hover:text-accent-pink transition-colors">
                  All artists →
                </button>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {topArtists.map((artist, index) => (
                  <motion.div
                    key={artist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="text-center group cursor-pointer"
                  >
                    <div className="relative mb-3">
                      <img
                        src={artist.avatar}
                        alt={artist.name}
                        className="w-20 h-20 lg:w-24 lg:h-24 rounded-full mx-auto object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-full"></div>
                    </div>
                    <h4 className="font-medium text-white text-sm truncate">{artist.name}</h4>
                    <p className="text-xs text-dark-400">{artist.followers} followers</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Hot Boosts */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-dark-800 rounded-xl p-6 border border-dark-700"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                Hot boosts
              </h3>
              
              <div className="space-y-4">
                {hotBoosts.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-dark-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center flex-1">
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-12 h-12 rounded-lg object-cover mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white text-sm truncate">{track.title}</h4>
                        <p className="text-xs text-dark-400 truncate">{track.artist}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center ml-2">
                      <span className={`text-sm font-medium mr-1 ${
                        track.trend === 'up' ? 'text-accent-green' : 'text-accent-red'
                      }`}>
                        {track.percentage}
                      </span>
                      <div className={`w-0 h-0 border-l-2 border-r-2 border-transparent ${
                        track.trend === 'up' 
                          ? 'border-b-4 border-b-accent-green' 
                          : 'border-t-4 border-t-accent-red'
                      }`}></div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;