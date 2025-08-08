import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

const setToken = (token) => {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }
};

const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.success) {
      setToken(response.data.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.success) {
      setToken(response.data.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      removeToken();
    }
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (userData) => {
    const response = await api.put('/auth/profile', userData);
    if (response.data.success && typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.data.data));
    }
    return response.data;
  },

  updatePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/auth/updatepassword', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  updatePreferences: async (preferences) => {
    const response = await api.put('/auth/preferences', preferences);
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgotpassword', { email });
    return response.data;
  },
};

// Cases API
export const casesAPI = {
  getCases: async (params = {}) => {
    const response = await api.get('/cases', { params });
    return response.data;
  },

  getCase: async (id) => {
    const response = await api.get(`/cases/${id}`);
    return response.data;
  },

  createCase: async (caseData) => {
    const response = await api.post('/cases', caseData);
    return response.data;
  },

  updateCase: async (id, caseData) => {
    const response = await api.put(`/cases/${id}`, caseData);
    return response.data;
  },

  deleteCase: async (id) => {
    const response = await api.delete(`/cases/${id}`);
    return response.data;
  },

  assignCase: async (id, assignedTo) => {
    const response = await api.put(`/cases/${id}/assign`, { assignedTo });
    return response.data;
  },

  addComment: async (id, content, isInternal = false) => {
    const response = await api.post(`/cases/${id}/comments`, {
      content,
      isInternal,
    });
    return response.data;
  },

  getCaseStats: async () => {
    const response = await api.get('/cases/stats/overview');
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getOverview: async () => {
    const response = await api.get('/dashboard/overview');
    return response.data;
  },

  getPerformance: async (params = {}) => {
    const response = await api.get('/dashboard/performance', { params });
    return response.data;
  },

  getTrends: async (params = {}) => {
    const response = await api.get('/dashboard/trends', { params });
    return response.data;
  },

  getSLAMetrics: async (params = {}) => {
    const response = await api.get('/dashboard/sla', { params });
    return response.data;
  },

  getWorkload: async () => {
    const response = await api.get('/dashboard/workload');
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUser: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  getUserPerformance: async (id) => {
    const response = await api.get(`/users/${id}/performance`);
    return response.data;
  },

  getUserStats: async () => {
    const response = await api.get('/users/stats/overview');
    return response.data;
  },

  getWorkloadDistribution: async () => {
    const response = await api.get('/users/workload');
    return response.data;
  },
};

// Wazuh API
export const wazuhAPI = {
  testConnection: async () => {
    const response = await api.get('/wazuh/test');
    return response.data;
  },

  getAlerts: async (params = {}) => {
    const response = await api.get('/wazuh/alerts', { params });
    return response.data;
  },

  getNewAlerts: async (lastSync) => {
    const response = await api.get('/wazuh/alerts/new', {
      params: { lastSync },
    });
    return response.data;
  },

  createCaseFromAlert: async (alertId, caseData = {}) => {
    const response = await api.post(`/wazuh/alerts/${alertId}/create-case`, caseData);
    return response.data;
  },

  syncAlerts: async (params = {}) => {
    const response = await api.post('/wazuh/sync', params);
    return response.data;
  },

  getAgents: async () => {
    const response = await api.get('/wazuh/agents');
    return response.data;
  },

  getAgent: async (agentId) => {
    const response = await api.get(`/wazuh/agents/${agentId}`);
    return response.data;
  },

  getRules: async (ruleIds = []) => {
    const response = await api.get('/wazuh/rules', {
      params: { ruleIds: ruleIds.join(',') },
    });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/wazuh/stats');
    return response.data;
  },
};

// AI API
export const aiAPI = {
  getRemediationSuggestions: async (caseId, context = '') => {
    const response = await api.post(`/ai/case/${caseId}/remediation`, { context });
    return response.data;
  },

  getMitreAnalysis: async (caseId) => {
    const response = await api.post(`/ai/case/${caseId}/mitre-analysis`);
    return response.data;
  },

  getExecutiveSummary: async (caseId, options = {}) => {
    const response = await api.post(`/ai/case/${caseId}/executive-summary`, options);
    return response.data;
  },

  getRiskAssessment: async (caseId) => {
    const response = await api.post(`/ai/case/${caseId}/risk-assessment`);
    return response.data;
  },

  suggestCategorization: async (caseId) => {
    const response = await api.post(`/ai/case/${caseId}/categorize`);
    return response.data;
  },

  getSimilarCases: async (caseId, limit = 5) => {
    const response = await api.get(`/ai/case/${caseId}/similar-cases`, {
      params: { limit },
    });
    return response.data;
  },

  getStatus: async () => {
    const response = await api.get('/ai/status');
    return response.data;
  },

  testConnection: async () => {
    const response = await api.post('/ai/test');
    return response.data;
  },

  getStats: async (params = {}) => {
    const response = await api.get('/ai/stats', { params });
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  testEmail: async (email) => {
    const response = await api.post('/notifications/test-email', { email });
    return response.data;
  },

  sendCaseAssignmentNotification: async (caseId) => {
    const response = await api.post(`/notifications/case/${caseId}/assignment`);
    return response.data;
  },

  sendCaseClosureNotification: async (caseId) => {
    const response = await api.post(`/notifications/case/${caseId}/closure`);
    return response.data;
  },

  sendEscalationAlert: async (caseId, escalatedTo) => {
    const response = await api.post(`/notifications/case/${caseId}/escalation`, {
      escalatedTo,
    });
    return response.data;
  },

  sendDailyDigest: async (userIds = []) => {
    const response = await api.post('/notifications/daily-digest', { userIds });
    return response.data;
  },

  getStats: async (params = {}) => {
    const response = await api.get('/notifications/stats', { params });
    return response.data;
  },

  getPreferences: async () => {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  updatePreferences: async (preferences) => {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  },
};

// Error handling utility
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.error?.message || error.response.statusText;
    return {
      message,
      status: error.response.status,
      details: error.response.data?.error?.details || null,
    };
  } else if (error.request) {
    // Network error
    return {
      message: 'Network error. Please check your internet connection.',
      status: 0,
      details: null,
    };
  } else {
    // Other error
    return {
      message: error.message || 'An unexpected error occurred.',
      status: -1,
      details: null,
    };
  }
};

// Export utilities
export { getToken, setToken, removeToken };
export default api;