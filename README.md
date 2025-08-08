# Wazuh Case Management System

## Architecture Overview

A third-party case management system that integrates with Wazuh SIEM to provide comprehensive incident lifecycle management.

### Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT
- **Integration**: Wazuh REST API
- **Notifications**: NodeMailer (SMTP)
- **Maps**: Leaflet/Mapbox for geo-mapping
- **AI**: OpenAI API for remediation guidance

### Project Structure
```
case-management-system/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── utils/
│   ├── config/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── utils/
│   ├── public/
│   └── package.json
├── shared/
│   └── types/
└── docker-compose.yml
```

## System Design

### Database Schema
- **Cases**: Case tracking with status, priority, assignments
- **Users**: Analysts and admin users with roles
- **Alerts**: Wazuh alerts mapped to cases
- **Notifications**: Email and system notifications
- **Performance**: Analyst metrics and SLA tracking

### Key Features
1. **Case Management**: Create, assign, track, close cases
2. **Priority & SLA**: P1/P2/P3 with time limits and escalation
3. **Notifications**: Email alerts for assignments and deadlines
4. **Performance Tracking**: Analyst metrics and dashboards
5. **AI Assistant**: MITRE ATT&CK remediation guidance
6. **Geo-mapping**: Alert source visualization
7. **Executive Reports**: Auto-generated summaries

### Integration Flow
```
Wazuh SIEM → REST API → Alert Ingestion → Case Creation → Analyst Assignment → Resolution → Metrics
```