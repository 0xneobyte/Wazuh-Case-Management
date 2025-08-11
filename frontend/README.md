## SENTRYA Frontend (Next.js)

Next.js app for the SENTRYA security case management platform. It provides authentication, case management UI, AI assistant, SIEM views (Wazuh + Demo), IP analysis, and admin users management.

### Prerequisites

- Node.js 18+
- Backend API running (see project root README)

### Environment

Set the API base URL:

```bash
export NEXT_PUBLIC_API_URL="http://localhost:5000/api"
```

### Development

```bash
npm install
npm run dev
# open http://localhost:3000
```

### Available Pages

- `/auth/login` – Sign in
- `/cases` and `/cases/[id]` – Case list and details
- `/ai-assistant` – AI remediation, MITRE/compliance, executive reports
- `/siem/demo` – Demo SIEM alerts and case creation
- `/siem/wazuh` – Wazuh alerts/agents/rules (admin/senior)
- `/users` – User management (admin/senior)
- `/geo` – Geo threat analytics

### Tech

- Next.js App Router, Tailwind CSS, Shadcn UI components
- Global auth state via `providers/AuthProvider.tsx`
- API client in `src/services/api.js` (axios, auth interceptors)
