# Wazuh Case Management System - Backend

A comprehensive backend API for managing security cases from Wazuh SIEM alerts with AI-powered features, SLA monitoring, and automated notifications.

## 🚀 Features

### Core Features
- **JWT Authentication** with role-based access control
- **Case Management** with full lifecycle tracking
- **Wazuh SIEM Integration** for alert ingestion and case creation
- **SLA Monitoring** with automatic escalation
- **Email Notifications** for assignments, updates, and alerts
- **Performance Analytics** with user metrics and dashboards
- **AI Assistant** powered by OpenAI for remediation suggestions
- **MITRE ATT&CK Mapping** and compliance checks
- **Geo-location Analysis** with risk assessment

### Advanced Features
- **Real-time SLA Monitoring** with cron jobs
- **Executive Summary Generation** for non-technical stakeholders  
- **Similar Case Detection** using AI analysis
- **Daily Digest Emails** with performance summaries
- **Comprehensive Audit Trail** with timeline tracking
- **Rate Limiting** and security middleware
- **Structured Logging** with Winston

## 📋 Prerequisites

- **Node.js** 18.x or higher
- **MongoDB** 6.x or higher
- **Wazuh** 4.x installation (for SIEM integration)
- **OpenAI API Key** (for AI features)
- **SMTP Server** (for email notifications)

## 🛠️ Installation

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Required Environment Variables**
   ```bash
   # Database
   MONGODB_URI=mongodb://localhost:27017/wazuh-case-management
   
   # JWT Security
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # Wazuh Integration
   WAZUH_API_URL=https://your-wazuh-server:55000
   WAZUH_API_USERNAME=wazuh-wui
   WAZUH_API_PASSWORD=your-wazuh-password
   
   # Email Service
   SMTP_HOST=smtp.gmail.com
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # AI Features
   OPENAI_API_KEY=your-openai-api-key
   ```

## 🚀 Quick Start

1. **Development Mode**
   ```bash
   npm run dev
   ```

2. **Production Mode**
   ```bash
   npm start
   ```

3. **API Health Check**
   ```bash
   curl http://localhost:5000/health
   ```

## 📚 API Documentation

### Authentication Endpoints
```
POST /api/auth/register     - Register new user
POST /api/auth/login        - User login
GET  /api/auth/me          - Get current user
PUT  /api/auth/profile     - Update profile
POST /api/auth/logout      - User logout
```

### Case Management
```
GET    /api/cases               - Get all cases (with filters)
POST   /api/cases               - Create new case
GET    /api/cases/:id           - Get single case
PUT    /api/cases/:id           - Update case
DELETE /api/cases/:id           - Delete case
POST   /api/cases/:id/comments  - Add comment to case
PUT    /api/cases/:id/assign    - Assign case to user
```

### Dashboard Analytics
```
GET /api/dashboard/overview     - Dashboard overview stats
GET /api/dashboard/performance  - Analyst performance metrics
GET /api/dashboard/trends      - Case trends and analytics
GET /api/dashboard/sla         - SLA compliance metrics
GET /api/dashboard/workload    - Workload distribution
```

### Wazuh Integration
```
GET  /api/wazuh/test                     - Test Wazuh connection
GET  /api/wazuh/alerts                   - Get Wazuh alerts
POST /api/wazuh/alerts/:id/create-case   - Create case from alert
POST /api/wazuh/sync                     - Sync new alerts
GET  /api/wazuh/agents                   - Get Wazuh agents
GET  /api/wazuh/stats                    - Integration statistics
```

### AI Assistant
```
POST /api/ai/case/:id/remediation        - Get remediation suggestions
POST /api/ai/case/:id/mitre-analysis     - MITRE ATT&CK analysis
POST /api/ai/case/:id/executive-summary  - Generate executive summary
POST /api/ai/case/:id/risk-assessment    - Risk assessment
GET  /api/ai/case/:id/similar-cases      - Find similar cases
GET  /api/ai/status                      - AI service status
```

### Notifications
```
POST /api/notifications/test-email           - Test email service
POST /api/notifications/daily-digest        - Send daily digests
GET  /api/notifications/preferences         - Get notification preferences
PUT  /api/notifications/preferences         - Update preferences
```

## 🔧 Configuration

### User Roles
- **admin**: Full system access
- **senior_analyst**: Case creation, assignment, advanced features
- **analyst**: Assigned case management
- **viewer**: Read-only access

### SLA Time Limits
- **P1 (Critical)**: 1 hour
- **P2 (High)**: 4 hours  
- **P3 (Medium)**: 24 hours

### Email Notifications
- Case assignments
- Status updates
- SLA escalations
- Daily digest (optional)
- Case closure notifications

### Cron Jobs
- **SLA Monitoring**: Every 5 minutes
- **Escalation Check**: Every 15 minutes
- **Daily Digest**: 8:00 AM daily
- **Performance Update**: Every hour
- **Health Check**: Every minute

## 🏗️ Architecture

```
src/
├── config/
│   └── database.js          # MongoDB connection
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js      # Global error handling
├── models/
│   ├── Case.js              # Case data model
│   └── User.js              # User data model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── cases.js             # Case management routes
│   ├── dashboard.js         # Analytics routes
│   ├── wazuh.js             # Wazuh integration
│   ├── ai.js                # AI assistant routes
│   ├── notifications.js     # Notification routes
│   └── users.js             # User management
├── services/
│   ├── wazuhService.js      # Wazuh API integration
│   ├── emailService.js      # Email notifications
│   ├── aiService.js         # OpenAI integration
│   └── cronService.js       # Background jobs
├── utils/
│   └── logger.js            # Winston logging
└── server.js                # Express application
```

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Password Hashing** with bcryptjs
- **Rate Limiting** per IP address
- **Input Validation** with express-validator
- **CORS Protection** with configurable origins
- **Helmet Security** headers
- **Account Lockout** after failed login attempts
- **Secure Headers** and HTTPS enforcement

## 📊 Monitoring & Logging

### Logging Levels
```bash
LOG_LEVEL=error    # Errors only
LOG_LEVEL=warn     # Warnings and errors
LOG_LEVEL=info     # Info, warnings, and errors (default)
LOG_LEVEL=debug    # All log levels
```

### Log Files
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs
- Console output in development

### Health Monitoring
- Database connectivity checks
- Active case monitoring
- Overdue case alerts
- Performance metrics tracking

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Test specific endpoint
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

## 🐳 Docker Support

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔧 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check MongoDB is running
   sudo systemctl status mongod
   
   # Verify connection string
   echo $MONGODB_URI
   ```

2. **Wazuh API Connection Failed**
   ```bash
   # Test Wazuh API
   curl -k -u wazuh-wui:password https://localhost:55000/security/user/authenticate
   ```

3. **Email Service Not Working**
   ```bash
   # Test SMTP configuration
   POST /api/notifications/test-email
   ```

4. **AI Features Not Working**
   ```bash
   # Verify OpenAI API key
   POST /api/ai/test
   ```

### Performance Optimization
- Enable MongoDB indexing
- Configure connection pooling
- Use Redis for caching (optional)
- Monitor memory usage
- Optimize database queries

## 📝 Development

### Code Structure
- Use ES6+ features
- Follow RESTful API conventions  
- Implement proper error handling
- Add comprehensive logging
- Write meaningful commit messages

### Adding New Features
1. Create route handlers in appropriate files
2. Add data models if needed
3. Implement middleware if required
4. Add proper validation
5. Update API documentation
6. Add tests

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review API documentation
- Enable debug logging for more details