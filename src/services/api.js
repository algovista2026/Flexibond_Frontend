import axios from 'axios';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { toast } from 'react-toastify';

// --- Device Fingerprinting ---
let deviceId = localStorage.getItem('flexibond_device_id') || null;
let fingerprintPromise = null;

const generateFallbackId = () => {
  const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `fb-${timestamp}-${randomStr}`;
};

const initFingerprint = async () => {
  // If already calculated, return it
  if (deviceId && deviceId.length > 5) return deviceId;
  
  // If already in progress, wait for that one
  if (fingerprintPromise) return fingerprintPromise;

  fingerprintPromise = (async () => {
    try {
      const fpPromise = FingerprintJS.load();
      const fp = await fpPromise;
      const result = await fp.get();
      
      if (result && result.visitorId) {
        deviceId = result.visitorId;
      } else {
        deviceId = generateFallbackId();
      }
    } catch (err) {
      console.warn('Fingerprint failed, using fallback:', err);
      deviceId = generateFallbackId();
    }

    try {
      localStorage.setItem('flexibond_device_id', deviceId);
    } catch (e) {
      // iOS Private Mode or full storage - just keep it in memory
      console.warn('LocalStorage blocked, ID will persist for session only');
    }
    
    return deviceId;
  })();

  return fingerprintPromise;
};

// Initial trigger - don't await here, we'll await in interceptor
initFingerprint();

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isLAN = window.location.hostname.startsWith('192.168.') || 
              window.location.hostname.startsWith('10.') || 
              window.location.hostname.startsWith('172.') ||
              window.location.hostname.endsWith('.local');

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || isLAN
  ? `http://${window.location.hostname}:8080/api`
  : 'https://flexibond-backend-1.onrender.com/api').replace(/\/$/, '') + '/';

export const API_BASE_URL = API_BASE;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('flexibond_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Ensure deviceId is ready - critical for iOS/Safari reliability
  const currentId = await initFingerprint();

  if (currentId) {
    config.headers['x-device-id'] = currentId;
  }
  return config;
});

// Handle 401/403 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('flexibond_token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Check for Device Revocation
    if (error.response && error.response.status === 403 && error.response.data?.message === 'DEVICE_UNAUTHORIZED') {
      localStorage.removeItem('flexibond_token');
      localStorage.removeItem('flexibond_user');
      toast.error('Access revoked for this device. Please contact Admin.');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth
export const login = (username, password, nickname) => {
  // Use nickname if provided, otherwise auto-detect
  let deviceName = nickname;
  if (!deviceName) {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows PC';
    if (ua.indexOf('Mac') !== -1) os = 'Mac';
    if (ua.indexOf('X11') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('iPhone') !== -1) os = 'iPhone';

    let browser = 'Browser';
    if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
    else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
    else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
    else if (ua.indexOf('Edge') !== -1) browser = 'Edge';
    
    deviceName = `${os} (${browser})`;
  } else {
    // If nickname is provided, combine it with auto-detection for maximum info
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows PC';
    if (ua.indexOf('Mac') !== -1) os = 'Mac';
    if (ua.indexOf('X11') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('iPhone') !== -1) os = 'iPhone';

    let browser = 'Browser';
    if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
    else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
    else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
    else if (ua.indexOf('Edge') !== -1) browser = 'Edge';
    
    deviceName = `${os} (${browser}) [${nickname}]`;
  }

  return api.post('auth/login', { username, password }, {
    headers: { 'x-device-name': deviceName }
  });
};
export const verify2FA = (token, tempToken) => api.post('auth/verify-2fa', { token, tempToken });
export const getProfile = () => api.get('auth/me');

// 2FA Management
export const setup2FA = () => api.post('auth/2fa/setup');
export const activate2FA = (token) => api.post('auth/2fa/activate', { token });
export const disable2FA = () => api.post('auth/2fa/disable');

// Device Management
export const getAllDevices = () => api.get('auth/devices');
export const getPendingDevices = () => api.get('auth/devices/pending');
export const approveDevice = (id) => api.post(`auth/devices/${id}/approve`);
export const revokeDevice = (id) => api.delete(`auth/devices/${id}`);

// Upload
export const uploadFile = (file, onProgress, sessionId) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`upload${sessionId ? `?sessionId=${sessionId}` : ''}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  });
};
export const getUploadHistory = () => api.get('upload/history');
export const deleteUpload = (uploadId) => api.delete(`upload/${uploadId}`);
export const purgeAllData = (type) => api.delete(`upload/purge/${type}`);

// Dashboard
export const getDashboardSummary = (params) => api.get('dashboard/summary', { params });
export const getRevenueTrend = (params) => api.get('dashboard/revenue-trend', { params });
export const getTopProducts = (params) => api.get('dashboard/top-products', { params });
export const getTopCustomers = (params) => api.get('dashboard/top-customers', { params });
export const getCategoryBreakdown = (params) => api.get('dashboard/category-breakdown', { params });
export const getGradeBreakdown = (params) => api.get('dashboard/grade-breakdown', { params });
export const getGroupBreakdown = (params) => api.get('dashboard/group-breakdown', { params });
export const getMasterBreakdown = (params) => api.get('dashboard/master-breakdown', { params });
export const getZoneAnalysis = (params) => api.get('dashboard/zone-analysis', { params });
export const getGeographic = (params) => api.get('dashboard/geographic', { params });
export const getColourAnalysis = (params) => api.get('dashboard/colour-analysis', { params });
export const getSizeAnalysis = (params) => api.get('dashboard/size-analysis', { params });
// Pass the current filters to get cascading (faceted) option lists; omit for the full set.
export const getFilters = (params) => api.get('dashboard/filters', { params });
export const getProductComparison = (params) => api.get('dashboard/product-comparison', { params });
export const getCompanyTarget = (params) => api.get('dashboard/company-target', { params });
export const setCompanyTarget = (payload) => api.put('dashboard/company-target', payload);

// Clients (Account-level analytics)
export const getClients = (params) => api.get('clients', { params });
export const getClientOrders = (name, params) => api.get(`clients/${encodeURIComponent(name)}/orders`, { params });
export const getClientAnalysis = (name, params) => api.get(`clients/${encodeURIComponent(name)}/analysis`, { params });

// Salesperson
export const getSalespersonList = (params) => api.get('salesperson/list', { params });
export const getGeoAnalytics = (params) => api.get('salesperson/geo-analytics', { params });
export const getSalespersonPerformance = (name, params) =>
  api.get(`salesperson/${encodeURIComponent(name)}/performance`, { params });
export const getSalespersonComparison = (params) => api.get('salesperson/compare/all', { params });

// Salesperson Targets
export const getSalespersonTargets = (params) => api.get('salesperson/targets', { params });
export const setSalespersonTarget = (payload) => api.put('salesperson/target', payload);

// Channel (B2B vs B2C)
export const getChannelSummary = (params) => api.get('channel/summary', { params });
export const getChannelTrend = (params) => api.get('channel/trend', { params });
export const getChannelTopCustomers = (params) => api.get('channel/top-customers', { params });
export const getChannelStateBreakdown = (params) => api.get('channel/state-breakdown', { params });
export const getChannelProductBreakdown = (params) => api.get('channel/product-breakdown', { params });
export const getChannelCategoryBreakdown = (params) => api.get('channel/category-breakdown', { params });

// Financials
export const getFinancialSummary = (params) => api.get('financials/summary', { params });
export const getFinancialTaxTrend = (params) => api.get('financials/tax-trend', { params });
export const getFinancialStateWiseTax = (params) => api.get('financials/state-wise-tax', { params });
export const getFinancialGSTTypeSplit = (params) => api.get('financials/gst-type-split', { params });
export const getFinancialInvoices = (params) => api.get('financials/invoices', { params });
export const getFinancialInvoicesAll = (params) => api.get('financials/invoices/all', { params });
export const getFinancialFilters = () => api.get('financials/filters');

// AI Insights
export const getAIInsights = (context, contextType) => api.post('ai/insights', { context, contextType });

// User Management & Logs (Admin Only)
export const adminGetUsers = () => api.get('auth/users');
export const adminCreateUser = (userData) => api.post('auth/users', userData);
export const adminUpdateUser = (userId, userData) => api.put(`auth/users/${userId}`, userData);
export const adminDeleteUser = (userId) => api.delete(`auth/users/${userId}`);
export const adminReset2FA = (userId) => api.post(`auth/users/${userId}/disable-2fa`);
export const adminGetLogs = () => api.get('auth/logs');

export default api;
