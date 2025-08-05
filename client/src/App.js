import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';

// Context providers
import { AuthProvider } from './contexts/AuthContext';
import { PlayerProvider } from './contexts/PlayerContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Components
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminRoute from './components/Auth/AdminRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Explore from './pages/Explore';
import Library from './pages/Library';
import Search from './pages/Search';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Reels from './pages/Reels';
import CreateReel from './pages/Reels/CreateReel';

// Admin Pages
import AdminDashboard from './pages/Admin/Dashboard';
import AdminUsers from './pages/Admin/Users';
import AdminMusic from './pages/Admin/Music';
import AdminReels from './pages/Admin/Reels';
import AdminAnalytics from './pages/Admin/Analytics';

// Error Pages
import NotFound from './pages/NotFound';
import ServerError from './pages/ServerError';

// Import styles
import './index.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <PlayerProvider>
              <Router>
                <div className="App min-h-screen bg-dark-900 text-white">
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    
                    {/* Protected Routes with Layout */}
                    <Route
                      path="/*"
                      element={
                        <ProtectedRoute>
                          <Layout>
                            <Routes>
                              <Route path="/" element={<Home />} />
                              <Route path="/explore" element={<Explore />} />
                              <Route path="/search" element={<Search />} />
                              <Route path="/library" element={<Library />} />
                              <Route path="/profile" element={<Profile />} />
                              <Route path="/settings" element={<Settings />} />
                              <Route path="/reels" element={<Reels />} />
                              <Route path="/reels/create" element={<CreateReel />} />
                              
                              {/* Admin Routes */}
                              <Route
                                path="/admin/*"
                                element={
                                  <AdminRoute>
                                    <Routes>
                                      <Route path="/" element={<AdminDashboard />} />
                                      <Route path="/users" element={<AdminUsers />} />
                                      <Route path="/music" element={<AdminMusic />} />
                                      <Route path="/reels" element={<AdminReels />} />
                                      <Route path="/analytics" element={<AdminAnalytics />} />
                                    </Routes>
                                  </AdminRoute>
                                }
                              />
                              
                              {/* Error Routes */}
                              <Route path="/server-error" element={<ServerError />} />
                              <Route path="/404" element={<NotFound />} />
                              <Route path="*" element={<Navigate to="/404" replace />} />
                            </Routes>
                          </Layout>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                  
                  {/* Global Toast Notifications */}
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: '#1e293b',
                        color: '#ffffff',
                        border: '1px solid #334155',
                      },
                      success: {
                        iconTheme: {
                          primary: '#10b981',
                          secondary: '#ffffff',
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: '#ef4444',
                          secondary: '#ffffff',
                        },
                      },
                    }}
                  />
                </div>
              </Router>
            </PlayerProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;