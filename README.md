# MedXplain — Hospital Management System

A full-stack, role-based hospital management system built with Next.js 15, React 19, PostgreSQL, and a Python AI microservice. Covers the complete patient journey from registration through discharge, with an integrated AI pipeline for clinical document analysis in both English and Amharic.

---

## Tech Stack

**Frontend & Backend**
- Next.js 15 (App Router) — Server Components + API Routes
- React 19, TypeScript
- Tailwind CSS, Framer Motion, Lucide React
- TanStack Query, React Hook Form, Zod

**Database & Auth**
- PostgreSQL + Prisma ORM
- Better Auth (session-based, role-aware)

**AI Service (Python)**
- FastAPI + Uvicorn
- PyTorch, Hugging Face Transformers (TrOCR fine-tuned for Amharic)
- Tesseract OCR (English), OpenCV, Pillow

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/medxplain"
BETTER_AUTH_SECRET="your-secret-key-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AI_SERVICE_URL="https://your-ngrok-url.ngrok-free.app"
DIGITIZATION_SERVICE_URL="https://your-ngrok-url.ngrok-free.app"
LOCAL_AI_SERVICE_URL="http://localhost:8000"
```

### 3. Set up the database

```bash
npm run db:push       # push schema to database
npm run db:generate   # generate Prisma client
npm run db:seed       # seed departments + demo users
```

### 4. Start the web app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Start the AI service (optional)

The AI features require a separate Python service. See [`ai_service/README.md`](ai_service/README.md) for setup.

```bash
# Quick start (Windows)
ai_service\start.bat
```

---

## Roles & Access

| Role           | Patients | Appointments | Visits/Queue | Vitals | Lab | Prescriptions | Billing | Reports | Users | AI Panel          |
|----------------|----------|--------------|--------------|--------|-----|---------------|---------|---------|-------|-------------------|
| ADMIN          | ✅       | ✅           | ✅           | ✅     | ✅  | ✅            | ✅      | ✅      | ✅    | Full pipeline     |
| DOCTOR         | ✅       | ✅ (own)     | ✅           | view   | ✅  | ✅            | view    | ✅      | ❌    | Full pipeline     |
| NURSE          | ✅       | ✅           | ✅ (triage)  | ✅     | ❌  | view          | ❌      | ❌      | ❌    | Triage assistant  |
| RECEPTIONIST   | ✅       | ✅           | ✅ (check-in)| ❌     | ❌  | ❌            | ❌      | ❌      | ❌    | Document scanner  |
| LAB_TECHNICIAN | ❌       | ❌           | ❌           | ❌     | ✅  | ❌            | ❌      | ✅      | ❌    | Lab summary       |
| PHARMACIST     | ❌       | ❌           | ❌           | ❌     | ❌  | ✅            | ❌      | ❌      | ❌    | Prescription check|
| ACCOUNTANT     | ❌       | ❌           | ❌           | ❌     | ❌  | ❌            | ✅      | ✅      | ❌    | Billing extractor |

---

## Features

**Patient Management** — register patients with full demographic, medical history, insurance, and emergency contact info. Search, paginate, and view per-patient visit history.

**Appointments** — book and manage appointments, assign staff inline, track status through the full lifecycle.

**Visit Queue & Workflow** — models the full patient flow:
1. Receptionist creates visit → queue ticket generated
2. Nurse triages → records vitals, triage notes, routes to doctor or lab
3. Doctor consults → writes notes, prescription, lab requests
4. Pharmacist dispenses → prescription marked complete
5. Accountant bills → payment recorded
6. Doctor discharges

**Vitals** — nurses record temperature, BP, HR, SpO₂, weight, height per visit.

**Medical Records** — clinical notes and diagnosis tied to each visit, accessible to doctors and nurses.

**Lab Requests** — doctors raise requests; lab techs process and return results which flow back to the doctor's view.

**Prescriptions** — doctors write prescriptions per visit with per-medicine dosage and duration; pharmacists dispense.

**Billing** — invoices auto-generated per visit with line items; supports cash, card, insurance, and bank transfer payments.

**Departments** — manage hospital departments; doctors and nurses are assigned to departments.

**Messages** — internal staff-to-staff messaging.

**Reports** — aggregated operational stats for admins.

**AI Module** — role-specific AI panels:
- Upload clinical documents (images or text)
- OCR extracts text — auto-routes between Tesseract (English) and TrOCR (Amharic)
- NER identifies medical entities: diseases, symptoms, medications, lab results
- Assertion validates each entity as present / absent / possible / historical
- Summarization generates bilingual English + Amharic summaries
- Inline translation of Amharic OCR output to English
- Receptionist panel auto-fills patient registration forms from scanned ID/referral documents

---

## Project Structure

```
medxplain/
├── app/
│   ├── api/              # API routes (auth, patients, visits, billing, ai, ...)
│   ├── dashboard/        # Protected dashboard pages per module
│   ├── login/
│   ├── signup/
│   └── home/
├── components/
│   ├── ai/               # AI upload panel, result viewer, role panels
│   ├── dashboard/        # Role-based dashboard widgets
│   ├── layout/           # Sidebar, Header
│   ├── ui/               # Reusable UI primitives
│   └── [module]/         # patients, visits, billing, lab, etc.
├── lib/
│   ├── auth.ts           # Better Auth config
│   ├── prisma.ts         # Prisma client singleton
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── ai_service/           # Python FastAPI AI microservice
│   ├── main.py
│   ├── ocr/              # TrOCR Amharic + Tesseract English pipeline
│   └── requirements.txt
└── tools/                # Dev/research scripts (model conversion, data generation)
```

---

## Notes

- Model weights (`OCR_MODEL/`, `ASSERTION/`, `NER/`, `SUMMARAZATION/`) are excluded from the repository due to size. The AI service will not start without them.
- The AI service connects to a GPU server via ngrok tunnel (Kaggle/Colab). Set `AI_SERVICE_URL` to your tunnel URL.
- For local-only English OCR, set `LOCAL_AI_SERVICE_URL=http://localhost:8000` and ensure Tesseract is installed.
