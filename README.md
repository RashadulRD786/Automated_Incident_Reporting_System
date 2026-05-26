<div align="center">

#  DHL Incident Management System

###  AI-Enhanced Incident Reporting & Resolution System

[![Live Backend](https://img.shields.io/badge/Backend-Live%20on%20Render-46E3B7?style=flat-square&logo=render)](https://dhl-incident-backend.onrender.com)
[![Node.js](https://img.shields.io/badge/Node.js-v20-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-v18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=flat-square&logo=postgresql)](https://supabase.com)
[![UiPath](https://img.shields.io/badge/RPA-UiPath%20Studio%20Web-FA4616?style=flat-square&logo=uipath)](https://cloud.uipath.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

<br/>

>  **Upload** a raw incident fragment →  **AI pipeline** extracts, classifies & assigns →  **Dashboard** tracks SLA in real time

<br/>

</div>

A fully integrated, production-deployed system that automates the complete lifecycle of a DHL logistics incident — from the moment a raw, unstructured input arrives from any channel (email, WhatsApp note, PDF, handwritten image), through an AI-powered processing pipeline running on UiPath Studio Web cloud robots, to a clean, classified, SLA-monitored incident record delivered to the right department and visible in a real-time operational command centre.

---

##  Table of Contents

- [ Project Overview](#project-overview)
- [ System Architecture](#system-architecture)
- [ Key Features](#key-features)
- [ Tech Stack](#tech-stack)
- [ Database Schema](#database-schema)
- [ Live Demo](#live-demo)
- [ Getting Started](#getting-started)
- [ Project Structure](#project-structure)
- [ API Endpoints](#api-endpoints)
- [ RPA Automation Pipeline](#rpa-automation-pipeline)
- [ Incident Lifecycle](#incident-lifecycle)
- [ AI Models Used](#ai-models-used)
- [ Environment Variables](#environment-variables)
- [ Architectural Decisions](#architectural-decisions)
- [ Author & Competition](#author--competition)

---

##  Project Overview

### The Problem

DHL's Customer Support and Logistics Operations teams handle a high volume of incident reports daily — spanning late deliveries, COD disputes, damaged parcels, missing packages, incorrect addresses, system errors, and customer complaints. The core challenge is not the volume but how incidents arrive: simultaneously across multiple disconnected channels — WhatsApp messages, email threads, phone call notes, images of handwritten warehouse documents, and screenshots — each fragment incomplete and unconnected to the others.

The consequences are systemic:

- **Misidentification** — Incomplete, single-channel inputs lead to incorrect or missing responses
- **Duplicate tickets** — Separate agents log the same incident independently, creating wasted effort
- **Incorrect routing** — Without full context at intake, department assignment becomes a manual guess
- **No prioritisation** — Urgent incidents sit in the same queue as low-priority ones with no automatic SLA flagging
- **No unified visibility** — Departments work in isolation with no shared view of resolution progress
- **No reliable reporting** — Manual compilation produces inconsistent and time-consuming management reports

### The Solution

This system intercepts every raw input, understands it semantically, determines the nature of the issue, assesses severity, connects related information, classifies it intelligently, and delivers a clean, actionable incident record to the right team — automatically, and typically within 30 seconds of upload.

### Competition Context

Submitted for **DHL APSSC Digital Automation Challenge 3.0** — Scenario 2: AI-Enhanced Incident Reporting & Resolution System, in partnership with **Universiti Teknologi Malaysia (UTM)**, Faculty of Malaysia-Japan International Institute of Technology (MJIIT). Assignment: SECJ 3483 – Web Technology (20% of final grade).

---

##  System Architecture

The system is built on four tightly integrated layers: a React-based frontend serving as the operational command centre, a Node.js + Express backend enforcing all business logic and SLA management, a PostgreSQL database on Supabase for persistent structured storage, and a UiPath Studio Web cloud robot operating as a fully independent automated pipeline. The database is never accessed directly from the frontend or the RPA layer — all data operations pass through the backend, which enforces validation, authorisation, and business rules consistently.

![DHL Incident Management System — Architecture Overview](Diagrams/System_Architecture.png)

---

## Key Features

### Web Application Features

- ✅ JWT-secured login with 8-hour token expiry, DHL brand colours (red `#D40511`, yellow `#FFCC00`)
- ✅ Token-based password reset flow delivered via Nodemailer Gmail SMTP
- ✅ Dashboard with 4 live metric cards (Total Today, Pending, Resolved Today, Overdue), auto-refreshing every 60 seconds
- ✅ Critical Watch List showing all BREACHED and CRITICAL incidents with department and remaining SLA time
- ✅ Real-time Recent Activity feed from the audit trail, including UiPath-automated entries
- ✅ Weekly incident volume stacked bar chart by category (Recharts)
- ✅ Upload Console accepting PDF, DOCX, JPG, PNG, and plain text with live processing queue (10-second refresh)
- ✅ Incidents list with colour-coded severity badges, 5-state SLA indicators, and filters for Status, Severity, Category, SLA State, and free-text search
- ✅ Four-tab incident detail view: Overview (AI analysis, confidence scores), Source Inputs (raw extracted text), Departments (task assignments), Audit Trail (tamper-proof history with CSV export)
- ✅ Status management with enforced state machine transitions and full audit logging on every change
- ✅ Reports page with Daily Operational Summary, SLA Performance by severity and department, Pipeline Health, and Weekly Trend Intelligence
- ✅ Notifications bell with live unread badge, 60-second SLA alert polling, and mark-all-read

### AI Intelligence Features

- ✅ Language detection on every uploaded fragment using Claude Haiku
- ✅ PII filtering for compliance — redacted text stored separately, original text used for AI processing
- ✅ Named Entity Recognition extracting 14 entity types (tracking numbers, amounts, locations, urgency indicators, escalation threats, and more)
- ✅ Sentiment analysis scoring each input to inform severity assessment
- ✅ Content rewriting — messy, informal, multi-language fragments rewritten as clean professional English
- ✅ 80-word summarisation preserving all tracking numbers, financial amounts, and dates
- ✅ Semantic duplicate detection comparing each new summary against recent incidents
- ✅ Incident categorisation across 8 DHL-specific categories
- ✅ Full structured incident card generation with root cause hypothesis, evidence, confidence score, and per-department task assignments (Claude Sonnet)
- ✅ Rule-based fallback pipeline that activates when any AI step returns null — every record is processed regardless of AI availability

### RPA Automation Features

- ✅ Cloud robot triggered every 60 seconds with no dependency on any local machine
- ✅ Multi-format content extraction: plain text, PDF, DOCX, and base64-encoded image files
- ✅ GPT-4o image analysis for handwritten warehouse notes and damaged parcel photographs
- ✅ Seven-stage AI processing pipeline with null-check Boolean flag at each stage
- ✅ Seven-step rule-based fallback with keyword matching, urgency detection, and department routing
- ✅ Structured incident card POSTed directly to the backend REST API after processing
- ✅ Automated Gmail HTML summary email after each batch: Incidents Created, Duplicates Detected, Processed via Fallback, Failed

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite 5 | Single-page application, component-based UI |
| Styling | Tailwind CSS 3 | Utility-first CSS, DHL brand colours |
| HTTP Client | Axios | REST API calls, Bearer token interceptor, 401 redirect |
| Charts | Recharts | Dashboard and reports stacked bar charts |
| Backend | Node.js 20 + Express | REST API, business logic, SLA management |
| Authentication | JWT + bcryptjs | 8-hour tokens, secure password hashing |
| File Processing | Multer v2 | PDF, DOCX, JPG, PNG, TXT upload handling |
| Text Extraction | pdf-parse + Mammoth | PDF and DOCX text extraction at upload time |
| Email | Nodemailer (Gmail SMTP) | Password reset delivery |
| Database | PostgreSQL (Supabase) | Cloud-hosted, SSL connection pooling, Singapore region |
| Deployment | Render (backend) | Cloud-hosted backend, auto-deploy from `deploy` branch |
| RPA | UiPath Studio Web | Cloud robot, time trigger every 60 seconds |
| AI — NLP Tasks | Claude Haiku (Anthropic) | Language detection, NER, sentiment, rewrite, summarise, categorise |
| AI — Generation | Claude Sonnet (Anthropic) | Full structured incident card generation |
| AI — Vision | GPT-4o (OpenAI via UiPath) | Handwritten note and image analysis |
| Email (RPA) | Gmail via UiPath connector | Automated batch summary email |
| Version Control | Git / GitHub | `main` branch for development, `deploy` branch watched by Render |

---

## Database Schema

The database contains six tables. All five supporting tables link back to `incidents` via `incident_id`, forming a clean hub-and-spoke one-to-many structure.

### `users`
Stores agent credentials and JWT password reset tokens.

| Column | Type | Description | Constraints |
|---|---|---|---|
| id | INTEGER | Primary key | PK, AUTO |
| email | TEXT | Agent login email | NN, UNIQUE |
| password_hash | TEXT | bcryptjs password hash | NN |
| name | TEXT | Display name | NN |
| reset_token | TEXT | Password reset token | — |
| reset_token_expiry | INTEGER | Token expiry (Unix timestamp) | — |
| created_at | INTEGER | Account creation timestamp | — |

### `incidents`
Central hub — 25 columns covering AI output, classification, SLA state, and lifecycle timestamps.

| Column | Type | Description | Constraints |
|---|---|---|---|
| id | INTEGER | Primary key | PK, AUTO |
| incident_ref | TEXT | Human-readable ref (INC-2026-XXXX) | NN |
| title | TEXT | Short incident title | NN |
| summary | TEXT | AI-generated 80-word summary | NN |
| category | TEXT | DHL incident category | NN |
| severity | TEXT | Critical / High / Medium / Low | NN |
| status | TEXT | Current lifecycle status | NN |
| primary_department | TEXT | Owning department | NN |
| root_cause_suggestion | TEXT | Recommended resolution action | — |
| root_cause_hypothesis | TEXT | AI root cause hypothesis | — |
| root_cause_evidence | TEXT | Supporting evidence from input | — |
| root_cause_confidence | REAL | Root cause confidence (0–1) | — |
| llm_confidence | REAL | LLM overall confidence (0–1) | — |
| sentiment_score | TEXT | Sentiment label from analysis | — |
| is_duplicate | BOOLEAN | Duplicate flag | — |
| duplicate_reason | TEXT | Similarity explanation | — |
| processed_via_fallback | BOOLEAN | True if rule-based fallback used | — |
| sla_hours | INTEGER | SLA window in hours | NN |
| sla_deadline | INTEGER | SLA deadline (Unix timestamp) | — |
| sla_state | TEXT | ON_TRACK / AT_RISK / CRITICAL / BREACHED / COMPLETED | — |
| is_overdue | BOOLEAN | Legacy overdue flag | — |
| first_response_at | INTEGER | First response timestamp | — |
| created_at | INTEGER | Incident creation timestamp | — |
| updated_at | INTEGER | Last update timestamp | — |
| resolved_at | INTEGER | Resolution timestamp | — |
| closed_at | INTEGER | Closure timestamp | — |

### `raw_inputs`
Uploaded file metadata, extracted text content, and queue processing state.

| Column | Type | Description | Constraints |
|---|---|---|---|
| id | INTEGER | Primary key | PK, AUTO |
| filename | TEXT | Original uploaded filename | — |
| file_path | TEXT | Server-side storage path | — |
| source_type | TEXT | Channel type (file, text) | NN |
| content_type | TEXT | text / pdf / docx / image | — |
| raw_text | TEXT | Extracted text content | — |
| ocr_confidence | REAL | OCR confidence score | — |
| detected_language | TEXT | Language detected from content | — |
| missing_fields | TEXT | Fields absent from extraction | — |
| processing_status | TEXT | pending / processing / processed / failed | NN |
| incident_id | INTEGER | FK to incidents | FK |
| error_message | TEXT | Processing error detail | — |
| queue_item_id | TEXT | UiPath queue reference | — |
| uploaded_at | INTEGER | Upload timestamp | — |
| processed_at | INTEGER | Processing completion timestamp | — |

### `department_tasks`
Per-department task assignments generated by AI for each incident.

| Column | Type | Description | Constraints |
|---|---|---|---|
| id | INTEGER | Primary key | PK, AUTO |
| incident_id | INTEGER | FK to incidents | FK, NN |
| department | TEXT | Department name | NN |
| role | TEXT | Role within this incident | NN |
| task_description | TEXT | General task description | — |
| problem_statement | TEXT | Department-specific problem | — |
| action_required | TEXT | Specific action to take | — |
| expected_output | TEXT | Required deliverable | — |
| task_status | TEXT | Task completion state | — |
| assigned_at | INTEGER | Assignment timestamp | — |
| updated_at | INTEGER | Last update timestamp | — |

### `audit_trail`
Immutable log of every status change, actor, and value transition for every incident.

| Column | Type | Description | Constraints |
|---|---|---|---|
| id | INTEGER | Primary key | PK, AUTO |
| incident_id | INTEGER | FK to incidents | FK, NN |
| actor | TEXT | Who performed the action | NN |
| action | TEXT | Action description | NN |
| previous_value | TEXT | State before the change | — |
| new_value | TEXT | State after the change | — |
| notes | TEXT | Additional context | — |
| created_at | INTEGER | Action timestamp | — |

### `notifications`
SLA-triggered alerts with read/unread state, auto-deleted after 7 days.

| Column | Type | Description | Constraints |
|---|---|---|---|
| id | INTEGER | Primary key | PK, AUTO |
| incident_id | INTEGER | FK to incidents | FK |
| incident_ref | TEXT | Human-readable incident reference | — |
| message | TEXT | Alert message text | — |
| type | TEXT | AT_RISK / CRITICAL / BREACHED | — |
| category | TEXT | Incident category | — |
| primary_department | TEXT | Owning department | — |
| is_read | BOOLEAN | Read state | DEFAULT FALSE |
| created_at | INTEGER | Alert creation timestamp | — |

---

## Live Demo

| Item | Detail |
|---|---|
| **Frontend URL** | https://automated-incident-reporting-system.vercel.app/ |
| **Backend URL** | https://dhl-incident-backend.onrender.com |
| **Admin Email** | admin@dhl.com |
| **Admin Password** | Admin@1234 |
| **Cold Start** | Render free tier sleeps after inactivity — first request takes 50–90 seconds |

**Before any demo session**, wake up the backend by visiting the URL below and waiting for a JSON response:

```
https://dhl-incident-backend.onrender.com/api/reports/dashboard
```

### Demo Walkthrough

1. Open https://automated-incident-reporting-system.vercel.app or run locally at `http://localhost:3000` and log in with the admin credentials
2. Check the **Dashboard** — live metrics, Critical Watch List, Weekly Trend chart
3. Go to **Upload** — upload a PDF, DOCX, image, or paste raw text
4. Watch the Processing Queue update to `Pending`; with UiPath running, the status changes to `Processed` within 60 seconds
5. Go to **Incidents** — the new record appears with AI-assigned category, severity, SLA state, and department
6. Open the incident and explore all four tabs: Overview, Source Inputs, Departments, Audit Trail
7. Update the status using the dropdown — the Audit Trail logs the change immediately
8. Go to **Reports** — review Daily Summary, SLA Performance, Pipeline Health, and Weekly Trends
9. Click the **bell icon** — SLA notifications appear within 60 seconds of any state change
10. View **INC-2026-0020** to see the fallback mechanism in action (amber banner, 0% LLM confidence)

---

## Getting Started

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20 or above | `node --version` |
| npm | 9 or above | `npm --version` |
| Git | Any recent | `git --version` |

### Clone the Repository

```bash
git clone -b deploy https://github.com/RashadulRD786/Automated_Incident_Reporting_System.git
cd Automated_Incident_Reporting_System
```

### Frontend Setup

```bash
cd frontend
npm install
```

Verify the environment file exists:

```bash
cat .env
```

If missing, create it:

```bash
echo "VITE_API_URL=https://dhl-incident-backend.onrender.com" > .env
```

Start the development server:

```bash
npm run dev
```

The frontend runs at `http://localhost:3000`.

### `.env.example`

```env
VITE_API_URL=https://dhl-incident-backend.onrender.com
```


> **Note:** The frontend is deployed on Vercel and accessible 
> at https://automated-incident-reporting-system.vercel.app — 
> no local setup required to use the system. The backend is 
> deployed on Render and the database is hosted on Supabase. 
> The UiPath automation runs in UiPath Studio Web and must be 
> started manually by clicking Run before each session.
---

## Project Structure

```
dhl-incident-system/
│
├── backend/                          # Node.js + Express application
│   ├── database/
│   │   ├── db.js                     # PostgreSQL pool, ? → $N placeholder converter
│   │   └── schema.sql                # Table definitions
│   ├── middleware/
│   │   └── authMiddleware.js         # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js                   # Login, forgot/reset password
│   │   ├── incidents.js              # CRUD, status updates, state machine
│   │   ├── uploads.js                # File upload, UiPath queue, incident creation
│   │   ├── reports.js                # Dashboard metrics, operational summary
│   │   └── notifications.js          # SLA alerts, read state management
│   ├── services/
│   │   └── emailService.js           # Nodemailer Gmail SMTP for password reset
│   ├── uploads/                      # Uploaded file storage (ephemeral on Render)
│   ├── seed.js                       # Database seeder (8 demo incidents)
│   ├── server.js                     # Express app, SLA background job (5-min interval)
│   ├── render.yaml                   # Render deployment configuration
│   └── .env.example                  # Backend environment variable template
│
├── frontend/                         # React 18 + Vite 5 application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # Navigation, notifications bell, polling
│   │   │   ├── MetricCard.jsx        # Dashboard KPI cards
│   │   │   ├── SLATimer.jsx          # Live SLA countdown display
│   │   │   ├── SeverityBadge.jsx     # Colour-coded severity indicator
│   │   │   ├── StatusBadge.jsx       # Status chip with colour coding
│   │   │   └── ProtectedRoute.jsx    # JWT guard for authenticated routes
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx         # Authentication with DHL branding
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── ResetPasswordPage.jsx
│   │   │   ├── DashboardPage.jsx     # Metrics, Watch List, chart, activity feed
│   │   │   ├── UploadPage.jsx        # File upload console + processing queue
│   │   │   ├── IncidentPage.jsx      # List view + four-tab detail view
│   │   │   └── ReportsPage.jsx       # Full operational reporting suite
│   │   ├── utils/
│   │   │   └── api.js                # Axios instance with interceptors
│   │   ├── App.jsx                   # Route definitions, ProtectedRoute wrappers
│   │   └── main.jsx                  # React entry point
│   ├── tailwind.config.js            # DHL colour palette configuration
│   └── vite.config.js
│
├── Diagrams/                         # Architecture and workflow diagrams
│   ├── System_Architecture.png
│   ├── UIPath_Pipeline.png
│   └── state_machine_diagram .png
│
├── files/                            # Project documentation
│   ├── Instructions.docx             # Step-by-step run instructions
│   └── Report-DHL Incident Reporting System.pdf
│
├── database_schema.html              # Interactive SVG database schema diagram
├── start.sh                          # Local development startup script
└── .gitignore
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Purpose | Auth Required | Consumer |
|---|---|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT (8h) | No | Frontend |
| POST | `/api/auth/forgot-password` | Send password reset email | No | Frontend |
| POST | `/api/auth/reset-password` | Reset password with token | No | Frontend |

### Incidents

| Method | Endpoint | Purpose | Auth Required | Consumer |
|---|---|---|---|---|
| GET | `/api/incidents` | List all incidents with filters (status, severity, category, sla_state, search, page, limit) | Yes | Frontend |
| GET | `/api/incidents/:id` | Get single incident with all tabs data | Yes | Frontend |
| PATCH | `/api/incidents/:id/status` | Update status (validates state machine transitions) | Yes | Frontend |
| GET | `/api/incidents/recent-summaries` | Get recent incident summaries for duplicate check | **No** | UiPath |

### Uploads (UiPath-facing — no auth middleware)

| Method | Endpoint | Purpose | Auth Required | Consumer |
|---|---|---|---|---|
| POST | `/api/uploads` | Upload file from frontend, extract text immediately | Yes | Frontend |
| GET | `/api/uploads/queue` | Poll for records with given processing status | **No** | UiPath |
| PATCH | `/api/uploads/:id/status` | Mark record as processing | **No** | UiPath |
| GET | `/api/uploads/:id/content` | Get extracted text for a record | **No** | UiPath |
| GET | `/api/uploads/:id/file` | Get image file as base64 | **No** | UiPath |
| POST | `/api/uploads/uipath` | Submit structured incident card — creates incident, tasks, audit entry | **No** | UiPath |

### Reports

| Method | Endpoint | Purpose | Auth Required | Consumer |
|---|---|---|---|---|
| GET | `/api/reports/dashboard` | Dashboard KPIs, Watch List, recent activity, weekly chart | Yes | Frontend |
| GET | `/api/reports/summary` | Full operational report (5 sections) | Yes | Frontend |

### Notifications

| Method | Endpoint | Purpose | Auth Required | Consumer |
|---|---|---|---|---|
| GET | `/api/notifications` | Get last 7 days of notifications (max 20) | Yes | Frontend |
| PATCH | `/api/notifications/:id/read` | Mark single notification as read | Yes | Frontend |
| PATCH | `/api/notifications/read-all` | Mark all notifications as read | Yes | Frontend |

---

## RPA Automation Pipeline

The UiPath Studio Web cloud robot runs on UiPath Orchestrator with a time trigger firing every 60 seconds. It operates as a fully independent layer, communicating with the system exclusively through the same REST API used by the frontend. No local machine is required — the robot runs on UiPath's cloud infrastructure and is accessible from anywhere.

![UiPath AI Pipeline Flow](Diagrams/UIPath_Pipeline.png)

### Stage 1 — Initialisation
The trigger fires and resets all batch counters (`countCreated`, `countDuplicate`, `countFallback`, `countFailed`). The robot calls `GET /api/uploads/queue?status=pending` and iterates over each returned record in a For Each loop.

### Stage 2 — Content Extraction
For each record, the robot marks the record as `processing` via `PATCH /api/uploads/:id/status`, then branches on `content_type`: text, PDF, and DOCX records call `GET /api/uploads/:id/content` to retrieve the stored extracted text. Image records call `GET /api/uploads/:id/file` to retrieve the base64 payload, then pass it to UiPath's native Image Analysis activity (GPT-4o) using a `data:image/png;base64,` data URI to transcribe handwritten notes and describe visual damage evidence.

### Stage 3 — AI Processing Pipeline
Seven sequential GenAI activities process the extracted text using Claude Haiku: language detection, PII filtering (for compliance storage only — original text is used for all subsequent AI steps), named entity recognition (14 entity types), sentiment analysis, content rewriting, 80-word summarisation, semantic duplicate detection against recent incidents, and incident categorisation across 8 DHL categories. Each activity is followed by a null check — a null response sets `fallbackActivated = True`.

### Stage 4 — Fallback Decision
If `incidentCardJson` is null or `fallbackActivated` is True, the pipeline switches to a seven-step rule-based fallback: keyword matching for category, urgency pattern matching for severity, a routing table for department assignment, text truncation for summary, supporting department construction, evidence and hypothesis assembly, and final JSON assembly with `processed_via_fallback: true` and `llm_confidence: 0.0`. If GenAI succeeded, Claude Sonnet synthesises all NLP outputs into a full structured incident card JSON.

### Stage 5 — Output and Email Summary
The robot POSTs the incident card to `POST /api/uploads/uipath`, which creates the incident record, department task assignments, and the first audit trail entry. After the For Each loop completes, if any records were processed or failed, an HTML summary email is sent via Gmail reporting: Incidents Created, Duplicates Detected, Processed via Fallback, and Failed counts.

---

## Incident Lifecycle

Every incident progresses through a defined six-state lifecycle enforced by the backend state machine. Incidents are never deleted — every transition is recorded in the audit trail with actor, timestamp, previous value, and new value. Once an incident reaches Closed, no further transitions are permitted.

![Incident Status State Machine](Diagrams/state_machine_diagram%20.png)

```
New → Assigned → In Progress → Pending → Resolved → Closed
```

Cancel is available from New, Assigned, In Progress, and Pending. Once an incident reaches Resolved or Closed, no further transitions including Cancel are permitted.

### SLA Framework

| Severity | SLA Hours |
|---|---|
| Critical | 6 hours |
| High | 24 hours |
| Medium | 48 hours |
| Low | 72 hours |

### SLA State Progression

```
ON_TRACK → AT_RISK (>50% elapsed) → CRITICAL (>80% elapsed) → BREACHED → COMPLETED
```

The backend evaluates all active incidents every 5 minutes and updates SLA states accordingly. Every state transition inserts a notification record. The frontend polls notifications every 60 seconds and displays them in the bell panel. SLA state is visible on every incident row in the list and on the dashboard Critical Watch List.

---

## AI Models Used

| Model | Provider | Role | Tasks |
|---|---|---|---|
| Claude Haiku | Anthropic (via UiPath GenAI) | NLP pipeline — speed-optimised | Language detection, PII filtering, Named Entity Recognition (14 types), sentiment analysis, content rewriting, 80-word summarisation, semantic duplicate detection, incident categorisation (8 categories) |
| Claude Sonnet | Anthropic (via UiPath GenAI) | Reasoning and generation | Full structured incident card generation — synthesises all NLP outputs into title, summary, severity, root cause hypothesis, root cause evidence, confidence scores, and per-department task assignments |
| GPT-4o | OpenAI (via UiPath Image Analysis) | Computer vision | Processes base64-encoded images: transcribes handwritten warehouse notes, extracts text from damaged parcel photographs, describes visual evidence relevant to logistics incident classification |

---

## Environment Variables

Copy `.env.example` to `.env` in the backend directory and populate all values before running locally.

| Variable | Description | Example Value |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string | `postgresql://user:pass@pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secret-key-here` |
| `JWT_EXPIRES_IN` | Token expiry duration | `8h` |
| `PORT` | Backend server port | `10000` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `GMAIL_USER` | Gmail address for password reset | `your-gmail@gmail.com` |
| `GMAIL_PASS` | Gmail app password (not account password) | `xxxx xxxx xxxx xxxx` |

Frontend `.env`:

| Variable | Description | Example Value |
|---|---|---|
| `VITE_API_URL` | Backend base URL | `https://dhl-incident-backend.onrender.com` |

---

## Architectural Decisions

All decisions below were made deliberately in response to specific technical or operational constraints. None represent limitations of the solution — each represents the optimal choice for the given environment.

| Decision | Reason |
|---|---|
| **Time trigger over queue trigger** | A 60-second poll is simpler, more predictable, and requires no additional queue infrastructure. Fully supported by UiPath Studio Web with no configuration overhead. |
| **Text extraction at upload time, not processing time** | Render's ephemeral filesystem cannot guarantee file persistence after a request completes. Extracting and storing raw text in the database immediately ensures the RPA pipeline always has content to process, regardless of server restarts. |
| **PostgreSQL over SQLite** | PostgreSQL supports concurrent connections, is production-grade, and is natively hosted on Supabase with automatic backups. SQLite was used in early development but replaced to meet the requirements of a cloud-deployed, multi-user system. |
| **Cloud robot over local robot** | UiPath Studio Web eliminates any dependency on a local machine being online. The automation runs reliably on UiPath's cloud infrastructure, accessible from anywhere, with no installation required. |
| **Boolean flag over Try/Catch** | UiPath Studio Web does not support Try/Catch reliably in nested activities. The `fallbackActivated` Boolean flag achieves equivalent resilience — any failure at any stage propagates gracefully through the pipeline and triggers the fallback without crashing execution. |
| **Single `Main.xaml` workflow** | All pipeline logic in one file makes debugging straightforward and keeps execution context consistent across all processing steps. |
| **`extractedText` used for GenAI, not `filteredText`** | PII-filtered text strips semantic meaning needed for accurate classification. The original extracted text preserves all tracking numbers, amounts, and context. `filteredText` is stored for compliance records only. |
| **Web Upload Console over Google Drive ingestion** | The Upload Console provides more controlled, secure ingestion — agents submit files directly with explicit intent. Google Drive ingestion was evaluated but introduced uncontrolled file discovery and access management complexity. |
| **Boolean flag over Try/Catch for error handling** | UiPath Studio Web cloud robots do not support screenshot capture or reliable Try/Catch propagation from nested activities. The Boolean flag achieves the same resilience outcome with full compatibility. |
| **Counter summary email over log file attachment** | Cloud robot filesystem is ephemeral and cannot guarantee log file persistence across trigger cycles. The HTML summary email with four counters (Created, Duplicate, Fallback, Failed) delivers equivalent operational visibility without filesystem dependency. |
| **No incident deletion — Cancelled status only** | Every incident, including erroneously created ones, is preserved in the audit trail. Using Cancelled status ensures full traceability and prevents data loss from accidental deletions. |

---

## Author & Competition

| Field | Detail |
|---|---|
| **Name** | Rashadul Nafis Riyad |
| **University** | Universiti Teknologi Malaysia (UTM) |
| **Faculty** | Malaysia-Japan International Institute of Technology (MJIIT) |
| **Competition** | DHL APSSC Digital Automation Challenge 3.0 — "Turn Chaos into Genius" |
| **Scenario** | Scenario 2 — AI-Enhanced Incident Reporting & Resolution System |
| **GitHub** | [RashadulRD786/Automated_Incident_Reporting_System](https://github.com/RashadulRD786/Automated_Incident_Reporting_System) |
