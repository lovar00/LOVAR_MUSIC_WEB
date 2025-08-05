import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
  permissions: {}
};

// Action types
const AUTH_ACTIONS = {
  AUTH_START: 'AUTH_START',
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAIL: 'AUTH_FAIL',
  LOGOUT: 'LOGOUT',
  UPDATE_USER: 'UPDATE_USER',
  SET_LOADING: 'SET_LOADING'
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.AUTH_START:
      return {
        ...state,
        isLoading: true
      };
    
    case AUTH_ACTIONS.AUTH_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        permissions: action.payload.user?.permissions || {}
      };
    
    case AUTH_ACTIONS.AUTH_FAIL:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        permissions: {}
      };
    
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        permissions: {}
      };
    
    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
        permissions: action.payload.permissions || state.permissions
      };
    
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };
    
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set up axios interceptors
  useEffect(() => {
    // Request interceptor to add token
    const requestIntercept = axios.interceptors.request.use(
      (config) => {
        if (state.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    const responseIntercept = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
          toast.error('Session expired. Please login again.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestIntercept);
      axios.interceptors.response.eject(responseIntercept);
    };
  }, [state.token]);

  // Load user on mount
  useEffect(() => {
    if (state.token) {
      loadUser();
    } else {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
    }
  }, []);

  // Load user from token
  const loadUser = async () => {
    try {
      dispatch({ type: AUTH_ACTIONS.AUTH_START });
      
      const response = await axios.get('/api/auth/me');
      
      dispatch({
        type: AUTH_ACTIONS.AUTH_SUCCESS,
        payload: {
          user: response.data.user,
          token: state.token
        }
      });
    } catch (error) {
      console.error('Load user error:', error);
      dispatch({ type: AUTH_ACTIONS.AUTH_FAIL });
      localStorage.removeItem('token');
    }
  };

  // Login function
  const login = async (identifier, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.AUTH_START });
      
      const response = await axios.post('/api/auth/login', {
        identifier,
        password
      });

      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      
      dispatch({
        type: AUTH_ACTIONS.AUTH_SUCCESS,
        payload: { user, token }
      });

      toast.success(`Welcome back, ${user.username}!`);
      
      return { success: true, user };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.AUTH_FAIL });
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.AUTH_START });
      
      const response = await axios.post('/api/auth/register', userData);
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      
      dispatch({
        type: AUTH_ACTIONS.AUTH_SUCCESS,
        payload: { user, token }
      });

      toast.success(`Welcome to LOVAR MUSIC, ${user.username}!`);
      
      return { success: true, user };
    } catch (error) {
      dispatch({ type: AUTH_ACTIONS.AUTH_FAIL });
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    dispatch({ type: AUTH_ACTIONS.LOGOUT });
    toast.success('Logged out successfully');
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/api/auth/profile', profileData);
      
      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: response.data.user
      });

      toast.success('Profile updated successfully');
      
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      toast.success('Password changed successfully');
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      toast.error(message);
      
      return { success: false, message };
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return state.permissions[permission] || false;
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return state.user?.userType === role;
  };

  // Check if user is admin
  const isAdmin = () => {
    return state.user?.userType === 'ADMIN';
  };

  // Check if user can download
  const canDownload = () => {
    return state.permissions.canDownload || false;
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    hasPermission,
    hasRole,
    isAdmin,
    canDownload,
    loadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};