================================================================================
                        MEDXPLAIN — FULL SYSTEM OVERVIEW
                     Web Application: Actors, Functions & Concept
================================================================================

Last updated: June 2026
Stack: Next.js 15 (App Router) · PostgreSQL · Prisma · Better Auth · TailwindCSS
AI Service: FastAPI (Python) · HuggingFace Transformers · Tesseract OCR

--------------------------------------------------------------------------------
SECTION 1 — CONCEPT & PURPOSE
--------------------------------------------------------------------------------

MedXplain is a full-stack hospital management platform built for Ethiopian
healthcare facilities. It digitizes and orchestrates the entire patient visit
lifecycle — from walk-in registration through triage, consultation, lab testing,
pharmacy dispensing, billing, and discharge.

The platform's defining feature is its embedded AI microservice that handles:
  - Multilingual OCR (English + Amharic) for medical documents
  - Named Entity Recognition (NER) to extract clinical entities
  - Clinical Assertion validation (PRESENT / ABSENT / POSSIBLE)
  - AI-powered summarization of medical notes and reports
  - Form digitization and patient ID auto-fill

The system serves 8 distinct roles with fully isolated dashboards, scoped data
access, and real-time workflow queues. Each actor only sees what they need.

--------------------------------------------------------------------------------
SECTION 2 — VISIT WORKFLOW (THE CORE PROCESS)
--------------------------------------------------------------------------------

Every patient interaction flows through a Visit object with the following
status transitions:

  Patient arrives
      │
      ▼
  RECEPTIONIST creates Walk-in Visit ──────────► Status: WAITING_TRIAGE
      │
      ▼
  NURSE triages (records vitals) ──────────────► Status: IN_TRIAGE
      │
      ├── Minor case ──────────────────────────► Prescribes + Discharges
      │                                          Status: COMPLETED
      │
      ├── Needs lab first ──────────────────────► Status: IN_LAB_PROCESS
      │        │
      │        └── LAB TECH uploads results ────► Status: WAITING_DOCTOR
      │
      └── Needs doctor ─────────────────────────► Status: WAITING_DOCTOR
               │
               ▼
          DOCTOR consults ─────────────────────► Status: IN_CONSULTATION
               │
               ├── Orders lab ─────────────────► Status: IN_LAB_PROCESS
               │        │
               │        └── LAB TECH uploads ──► Status: WAITING_DOCTOR (loop back)
               │
               ├── Writes prescription ─────────► Status: WAITING_PHARMACY
               │        │
               │        └── PHARMACIST dispenses► Status: COMPLETED
               │
               └── Admits patient ──────────────► Status: COMPLETED
                                                  Patient status: ADMITTED

Visit Statuses (in order):
  WAITING_TRIAGE → IN_TRIAGE → IN_LAB_PROCESS → WAITING_DOCTOR
  → IN_CONSULTATION → WAITING_PHARMACY → COMPLETED / CANCELLED

Patient Statuses:
  REGISTERED → WAITING → IN_CONSULTATION → ADMITTED → DISCHARGED

--------------------------------------------------------------------------------
SECTION 3 — ACTORS & THEIR FULL FUNCTIONS
--------------------------------------------------------------------------------

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 1: ADMIN                                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - Total Patients, Doctors, Nurses, Lab Techs, Receptionists,
    Pharmacists, Accountants, Admins (live counts)
  - Today's Appointments
  - Total Revenue (all-time)
  - Pending Lab Requests
  - Pending Prescriptions
  - Unpaid Bills
  - Available Beds

Pages & Functions:
  /dashboard               → Overview with 14 stat cards + recent appointments
  /dashboard/visits        → Full visit queue — can view, cancel any visit
  /dashboard/users         → View and manage ALL users, change roles, delete accounts
  /dashboard/patients      → View, search, create, update, delete any patient record
  /dashboard/appointments  → View, create, update, cancel any appointment
  /dashboard/medical-records → View all medical records across all doctors
  /dashboard/lab-requests  → View all lab requests, update status
  /dashboard/prescriptions → View all prescriptions system-wide
  /dashboard/billing       → View all bills, create bills, record payments
  /dashboard/departments   → Create, edit, delete hospital departments
  /dashboard/ai            → Full AI analysis panel (all document types)
  /dashboard/messages      → Send/receive messages with any user
  /dashboard/profile       → Edit own profile, change password

Special Admin Capabilities:
  - Create staff accounts (RECEPTIONIST, DOCTOR, NURSE, LAB_TECHNICIAN,
    PHARMACIST, ACCOUNTANT) via /api/admin/create-staff
    → Creates both the user account AND the role profile in one operation
    → New staff are forced to change their password on first login
  - Promote/demote users to any role
  - Upsert role profiles (specialization, department, ward, etc.)
  - Bootstrap the system (first admin can be created without auth)
  - Debug doctor/profile mismatches via /api/debug/doctor

API access: All endpoints — no scoping restrictions

────────────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 2: RECEPTIONIST                                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - Today's Appointments
  - Waiting Patients (status = WAITING)
  - Total Patients registered

Pages & Functions:
  /dashboard               → Stats + quick actions + today's schedule
  /dashboard/visits        → Visit queue — create walk-in visits, assign queue numbers
  /dashboard/patients      → Register new patients (National ID / FAN as primary key)
                             Full demographics: name, DOB, gender, nationality,
                             marital status, address, blood group, allergies,
                             chronic conditions, insurance, emergency contact, next of kin
  /dashboard/appointments  → Book appointments (assigns patient to doctor + time)
                             Update/cancel appointments
  /dashboard/ai            → AI Scanner panel:
                             - Scan patient ID cards → auto-fill registration form
                             - Scan referral letters → extract patient info + diagnosis
                             - Form Digitizer → upload clinical forms → structured extraction
  /dashboard/messages      → Messaging
  /dashboard/profile       → Profile management

Quick Actions on Dashboard:
  - "Register Patient" button → /dashboard/patients
  - "Book Appointment" button → /dashboard/appointments

AI-specific capabilities:
  - Upload ID card image → AI extracts name, DOB, gender, phone → auto-fills patient form
  - Upload referral letter → AI extracts reason for referral, patient details
  - Digitize physical forms (table/grid structures) via GPU service

────────────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 3: DOCTOR                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - Today's Appointments (assigned to this doctor)
  - Lab Results Ready (completed lab requests)
  - Pending Prescriptions (awaiting dispense)

Pages & Functions:
  /dashboard               → Stats + live Patient Queue (DoctorWorkflow)
  /dashboard/visits        → Full visit queue with status filters
  /dashboard/appointments  → View own appointments, update status
  /dashboard/patients      → Browse patient records, view medical history
  /dashboard/medical-records → View own medical records; create standalone records
  /dashboard/lab-requests  → View all lab requests linked to own patients; order new ones
  /dashboard/prescriptions → View prescriptions written by self
  /dashboard/ai            → AI Analysis panel — upload clinical notes, referrals,
                             lab reports, prescriptions → NER + Assertion + Summary
  /dashboard/messages      → Message patients, nurses, other staff
  /dashboard/profile       → Profile + availability toggle

Patient Queue (DoctorWorkflow — real-time, refreshes every 20s):
  Filters visits in WAITING_DOCTOR or IN_CONSULTATION status
  For each patient card:
    - Queue number, patient name, gender, blood group, allergies (highlighted)
    - Lab status badge (Lab pending / Lab ✓)
    - Expand to open Consultation Form

Consultation Form (per patient):
  1. Past Clinical History — shows accumulated dischargeDocument (all prior visits)
     with a "Copy" button for the clipboard
  2. Nurse Triage Summary — vitals (Temp, BP, HR, O₂, Weight, Height) + triage notes
  3. Lab Results — displays completed lab results inline (result, normal range, interpretation)
  4. Consultation inputs:
     - Diagnosis (required)
     - Symptoms
     - Treatment Plan
     - Consultation Notes
  5. Discharge section:
     - Discharge Notes / Instructions (appended permanently to patient record)
     - Follow-up Date
     - "Admit patient" checkbox
  6. Quick action buttons:
     - Write Prescription → opens PrescriptionWriter panel (inline)
     - Request Lab Test → opens lab request form with LabTech picker

Prescription Writer:
  - Add multiple medicines: Name, Dosage, Frequency, Duration, Instructions
  - Pharmacy notes
  - "Send to Pharmacy" → creates prescription with unique RX code (e.g. RX-A3F9)
  - Toast confirms: "Prescription sent to pharmacy — Code: RX-A3F9"

Lab Request Form:
  - Test Name, Test Type, Urgency (ROUTINE / URGENT / STAT)
  - Lab Technician picker — shows all techs with AVAILABLE / BUSY status
    and "results today" count; busy techs are greyed out
  - Optional assignment to specific technician

Complete Consultation:
  - Creates MedicalRecord (diagnosis, symptoms, treatment, notes)
  - Appends a full discharge summary to patient.dischargeDocument (permanent record)
  - Updates visit status to COMPLETED
  - If "Admit patient": sets patient status to ADMITTED
  - If discharge notes provided: creates a Discharge record with follow-up date

────────────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 4: NURSE                                                               ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - Waiting for Triage (patient status = WAITING)
  - Admitted Patients

Pages & Functions:
  /dashboard               → Stats + Triage Queue (NurseWorkflow)
  /dashboard/visits        → Full visit queue
  /dashboard/patients      → View patient records
  /dashboard/vitals        → Standalone vitals logging for any patient
  /dashboard/ai            → AI Triage panel — analyze symptom notes, risk flagging,
                             view active triage patients
  /dashboard/messages      → Messaging
  /dashboard/profile       → Profile + availability toggle

Triage Queue (NurseWorkflow — real-time, refreshes every 20s):
  Filters visits in WAITING_TRIAGE or IN_TRIAGE status
  For each patient card:
    - Queue number, patient name, gender, blood group, allergies (highlighted)
    - Expand to open TriageForm

Triage Form (per patient):
  Vitals section:
    - Temperature, Blood Pressure, Heart Rate, O₂ Saturation, Weight, Height
  Triage Notes (free text)
  Triage Decision (two options):

  OPTION A — Minor Case:
    → Opens MinorCaseFlow
    → Nurse writes prescription directly (medicine list)
    → Adds discharge instructions / summary
    → Submits triage + prescription atomically
    → Visit → COMPLETED; prescription → pharmacy queue

  OPTION B — Needs Doctor:
    → Opens DoctorAssignFlow
    → Shows all doctors with AVAILABLE / BUSY (In Consult) status
    → Department filter dropdown
    → AI suggestion: "Based on complaint X, suggested department: Cardiology"
    → Recommended doctor highlighted with ⭐
    → Select doctor → Assign
    → Visit → IN_CONSULTATION; patient assigned to selected doctor

Standalone Vitals (/dashboard/vitals):
  - Record vitals for any patient outside of a visit
  - Temperature, BP, HR, O₂, Weight, Height, Notes
  - Creates a Vitals record linked to the patient

────────────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 5: LAB TECHNICIAN                                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - Pending Requests (awaiting processing)
  - Completed Today

Pages & Functions:
  /dashboard               → Stats + Pending Lab Queue (LabWorkflow)
  /dashboard/lab-requests  → Full lab request list with filters
  /dashboard/ai            → AI Summary panel — upload lab reports → structured summary
  /dashboard/messages      → Messaging
  /dashboard/profile       → Profile + availability toggle

Lab Queue (LabWorkflow — real-time, refreshes every 20s):
  Filters lab requests in PENDING status
  For each request card:
    - Test name, test type
    - Urgency badge (STAT = red, URGENT = orange, ROUTINE = grey)
    - Patient name, requesting doctor, creation time
    - Expand to open ResultForm

Result Upload Form:
  - Result (required, free text)
  - Normal Range (e.g. "4.5–11.0 × 10⁹/L")
  - Interpretation (e.g. "Elevated — possible infection")
  - "Upload Result" → marks request as IN_PROGRESS then COMPLETED
  - Side effect: if all lab requests for a visit are now COMPLETED,
    visit status automatically moves back to WAITING_DOCTOR

Availability Toggle:
  - /api/staff/availability → PATCH to toggle isAvailable
  - When BUSY: shown as red "In Consult" badge in Doctor's lab tech picker

────────────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 6: PHARMACIST                                                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - Pending Prescriptions (awaiting dispense)
  - Dispensed Today

Pages & Functions:
  /dashboard               → Stats + PharmacistWorkflow
  /dashboard/prescriptions → Full prescription list with filters
  /dashboard/ai            → AI Checker panel — upload prescriptions → entity extraction
                             and drug validation
  /dashboard/messages      → Messaging
  /dashboard/profile       → Profile + availability toggle

Pharmacist Workflow (PharmacistWorkflow):

  Code Scanner (primary interface):
    - Input field pre-focused with monospace font
    - Type or scan RX-XXXX code → Enter or "Look up" button
    - Fetches prescription by code
    - Error shown inline if not found

  Prescription Detail Card (shown after lookup):
    - Patient name, phone, gender, blood group
    - Allergy warning (highlighted in red with triangle icon)
    - RX code + status badge + queue number
    - Prescribed by Dr. X · timestamp
    - Medicine list: Name, Dosage, Frequency, Duration, Instructions
    - Doctor's notes
    - Dispensing notes input (optional)
    - "Confirm Dispensed" button → marks prescription as DISPENSED
      → linked visit automatically moves to COMPLETED

  Pending Queue (collapsible panel):
    - Shows all PENDING prescriptions with patient name, RX code, medicine count
    - Click any row → loads it into the detail panel
    - Auto-refreshes every 30s

────────────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 7: ACCOUNTANT                                                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - Unpaid Bills (ISSUED + PARTIALLY_PAID)
  - Payments Today
  - Total Revenue (all-time sum of all payments)

Pages & Functions:
  /dashboard               → Stats + recent bills table + quick actions
  /dashboard/billing       → Full billing management
  /dashboard/patients      → View patient records (for billing context)
  /dashboard/ai            → AI Extractor panel — extract billing details
                             from scanned invoices / documents
  /dashboard/messages      → Messaging
  /dashboard/profile       → Profile management

Quick Actions on Dashboard:
  - "Create Bill" → /dashboard/billing
  - "Record Payment" → /dashboard/billing

Billing Functions (/dashboard/billing):
  Create Bill:
    - Select patient
    - Add line items: Description, Category (CONSULTATION/LAB/MEDICINE/ADMISSION/OTHER),
      Quantity, Unit Price
    - Apply discount and tax
    - System auto-calculates subtotal and total
    - Save as DRAFT or publish as ISSUED

  Record Payment:
    - Select bill
    - Enter amount, payment method (CASH / CARD / INSURANCE / BANK_TRANSFER)
    - Add reference number and notes
    - System auto-updates bill status:
      → If amount_paid >= total → PAID
      → If amount_paid < total → PARTIALLY_PAID

  Bill Statuses: DRAFT → ISSUED → PARTIALLY_PAID → PAID / CANCELLED

────────────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════════╗
║  ROLE 8: PATIENT                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

Dashboard Stats:
  - My Appointments (total booked)
  - Unpaid Bills
  - Unread Messages

Pages & Functions:
  /dashboard               → Stats + quick actions
  /dashboard/visits/book   → Self-book a visit (walk-in or online)
                             Select chief complaint, preferred department,
                             optional scheduled date
  /dashboard/appointments  → View own appointment history + status
  /dashboard/doctors       → Browse all doctors by name/specialization/department
  /dashboard/billing       → View own bills and payment history (read-only)
  /dashboard/messages      → Message doctors directly
                             (Patients can ONLY message doctors)
  /dashboard/profile       → Edit own profile information

Quick Actions on Dashboard:
  - "Find a Doctor" → /dashboard/doctors
  - "Message Doctor" → /dashboard/messages

Data scoping (patient sees only their own data):
  - Visits: only own visits
  - Appointments: only own appointments
  - Bills: only own bills
  - Vitals: only own vitals
  - Medical records: none (not exposed to patient directly)
  - Messages: only own conversations

--------------------------------------------------------------------------------
SECTION 4 — ALL PAGES IN THE APPLICATION
--------------------------------------------------------------------------------

PUBLIC PAGES (no authentication required):
  /                        → Redirects to /home
  /home                    → Marketing landing page (features, roles, testimonials, CTA)
  /login                   → Email + password sign-in
  /signup                  → Patient self-registration
  /change-password         → Forced password change (staff accounts flagged by admin)

AUTHENTICATED PAGES (redirect to /login if not signed in):
  /dashboard               → Role-specific dashboard (8 variants)
  /dashboard/visits        → Visit queue (Admin, Receptionist, Doctor, Nurse, Patient)
  /dashboard/visits/book   → Book a visit (Patient only)
  /dashboard/patients      → Patient management (Admin, Receptionist, Doctor, Nurse, Accountant)
  /dashboard/appointments  → Appointment management (Admin, Receptionist, Doctor, Patient)
  /dashboard/medical-records → Medical records (Admin, Doctor)
  /dashboard/lab-requests  → Lab request management (Admin, Doctor, Lab Technician)
  /dashboard/prescriptions → Prescription management (Admin, Doctor, Pharmacist)
  /dashboard/billing       → Billing (Admin, Accountant, Patient)
  /dashboard/departments   → Department management (Admin)
  /dashboard/users         → User management (Admin only)
  /dashboard/doctors       → Doctor browser (Patient)
  /dashboard/vitals        → Vitals log (Nurse)
  /dashboard/reports       → Reports (Admin, Doctor, Lab Technician)
  /dashboard/messages      → Internal messaging (all roles)
  /dashboard/ai            → AI Analysis panel (all roles except none — varies by role)
  /dashboard/profile       → My Profile (all roles — sidebar bottom link)

--------------------------------------------------------------------------------
SECTION 5 — ALL API ROUTES
--------------------------------------------------------------------------------

AUTH
  /api/auth/[...all]                    ALL    Better Auth handler (sign-in, sign-up,
                                               session management, sign-out, password reset)

ADMIN
  /api/admin/create-staff               POST   Create staff account + role profile;
                                               allows unauthenticated bootstrap when
                                               no users exist yet

VISITS (core workflow)
  /api/visits                           GET    List visits (role-scoped)
  /api/visits                           POST   Create visit (assigns queue number)
  /api/visits/[id]                      GET    Get visit with all relations
  /api/visits/[id]                      DELETE Cancel visit (ADMIN/RECEPTIONIST)
  /api/visits/[id]/triage               POST   NURSE: record vitals + triage decision
  /api/visits/[id]/consult              POST   DOCTOR: diagnosis + complete consultation
  /api/visits/[id]/assign-doctor        POST   Assign doctor → IN_CONSULTATION
  /api/visits/[id]/assign-nurse         POST   Assign nurse → IN_TRIAGE
  /api/visits/[id]/minor-case           POST   NURSE: minor case atomic tx
                                               (vitals + prescribe + discharge)

APPOINTMENTS
  /api/appointments                     GET    List (role-scoped)
  /api/appointments                     POST   Create (ADMIN/RECEPTIONIST)
  /api/appointments/[id]                GET    Get single appointment
  /api/appointments/[id]                PATCH  Update appointment
  /api/appointments/[id]                DELETE Cancel appointment

PATIENTS
  /api/patients                         GET    List patients (patient sees only self)
  /api/patients                         POST   Register new patient (National ID primary key)
  /api/patients/[id]                    GET    Get patient + full history
  /api/patients/[id]                    PATCH  Update patient record
  /api/patients/[id]                    DELETE Delete patient (ADMIN only)

DOCTORS
  /api/doctors                          GET    List doctors with availability + busy flag
  /api/doctors/available                GET    Available doctors (for nurse triage picker)
  /api/doctors/[id]                     GET    Get doctor profile
  /api/doctors/[id]                     PATCH  Update doctor profile

MEDICAL RECORDS
  /api/medical-records                  GET    List (doctor-scoped)
  /api/medical-records                  POST   Create medical record (ADMIN/DOCTOR)

VITALS
  /api/vitals                           GET    List vitals for a patient
  /api/vitals                           POST   Record vitals (ADMIN/NURSE)

LAB REQUESTS
  /api/lab-requests                     GET    List (doctor-scoped or all for admin/lab)
  /api/lab-requests                     POST   Create lab request (ADMIN/DOCTOR/NURSE)
  /api/lab-requests/[id]                GET    Get lab request
  /api/lab-requests/[id]                PATCH  Update status (IN_PROGRESS/CANCELLED)
  /api/lab-requests/[id]                POST   Upload lab result → auto-advances visit

LAB TECHNICIANS
  /api/lab-technicians                  GET    List techs with busy flag + resultsToday count

PRESCRIPTIONS
  /api/prescriptions                    GET    List (doctor-scoped) or lookup by ?code=RX-XXXX
  /api/prescriptions                    POST   Create prescription with unique RX code
                                               → moves visit to WAITING_PHARMACY
  /api/prescriptions/[id]/dispense      POST   PHARMACIST: dispense → DISPENSED
                                               → moves visit to COMPLETED

BILLING
  /api/billing                          GET    List bills (patient sees own)
  /api/billing                          POST   Create bill (ADMIN/ACCOUNTANT)
  /api/billing/[id]/pay                 POST   Record payment → auto-calculates status

DISCHARGE
  /api/discharge                        POST   DOCTOR: formally discharge patient

DEPARTMENTS
  /api/departments                      GET    List departments with counts
  /api/departments                      POST   Create department (ADMIN)
  /api/departments/[id]                 GET    Get department
  /api/departments/[id]                 PATCH  Update department
  /api/departments/[id]                 DELETE Delete department (ADMIN)

USERS
  /api/users                            GET    List all users (ADMIN only)
  /api/users/[id]                       GET    Get user
  /api/users/[id]                       PATCH  Update user
  /api/users/[id]                       DELETE Delete user (ADMIN)
  /api/users/[id]/promote               POST   Change role + upsert profile (ADMIN)
  /api/users/[id]/promote               DELETE Demote to PATIENT (ADMIN)

NURSES
  /api/nurses                           GET    List nurses with availability

MESSAGES
  /api/messages                         GET    Conversation (?withUserId=) or inbox (?inbox=true)
  /api/messages                         POST   Send message (patients → doctors only)

PROFILE
  /api/profile                          GET    Get own profile
  /api/profile                          PATCH  Update own profile
  /api/profile/change-password          POST   Change own password

STAFF AVAILABILITY
  /api/staff/availability               GET    Get own availability status
  /api/staff/availability               PATCH  Toggle isAvailable

DASHBOARD STATS
  /api/dashboard/stats                  GET    Role-scoped metrics (each role gets
                                               different stats tailored to their work)

REPORTS
  /api/reports                          GET    List lab/medical reports
  /api/reports                          POST   Create report

DEBUG
  /api/debug/doctor                     GET    Removed — was a dev diagnostic tool

--------------------------------------------------------------------------------
SECTION 6 — AI SERVICE API ROUTES
--------------------------------------------------------------------------------

The Next.js server proxies requests to a FastAPI Python microservice.
Default URL: http://localhost:8000 (configurable via AI_SERVICE_URL env var)
Digitization service: http://localhost:8001 (DIGITIZATION_SERVICE_URL)

All AI routes require authentication (session checked before proxying).
Long timeouts are set: OCR/process = 5–10 minutes (GPU inference can be slow).

  /api/ai/health                        GET    Ping AI service health check

  /api/ai/ocr                           GET    Health check (pings Python /health)
  /api/ai/ocr                           POST   OCR a document image → extracted text
                                               Forwards to Python /ocr/document

  /api/ai/ocr/smart                     POST   Smart OCR with auto language detection

  /api/ai/ocr/english                   POST   English-only OCR path (Tesseract)

  /api/ai/ocr/detect-language           POST   Detect language of text input

  /api/ai/ocr/detect-language-image     POST   Detect language from image (before OCR)

  /api/ai/ner                           POST   Named Entity Recognition
                                               Model: BertForTokenClassification
                                               Checkpoint: checkpoint-48561
                                               Extracts: Symptom, Disease, Medication,
                                               Lab_Result (with confidence scores ≥80%)

  /api/ai/assertion                     POST   Clinical Assertion Classification
                                               Model: BertForSequenceClassification
                                               Checkpoint: checkpoint-104652
                                               Labels each entity: PRESENT / ABSENT / POSSIBLE
                                               Returns per-entity scores and overall status

  /api/ai/summarization                 POST   English clinical summarization
                                               Model: BartForConditionalGeneration
                                               Checkpoint: checkpoint-115620

  /api/ai/summarization/amharic         POST   Amharic summarization endpoint
                                               (Amharic output not yet enabled — placeholder)

  /api/ai/translate                     POST   Amharic → English translation
                                               Uses Google Translate unofficial API (no key)

  /api/ai/process                       POST   FULL PIPELINE in one call:
                                               OCR text → NER → Assertion → Summarization
                                               Has mock fallback when AI service is offline
                                               Timeout: 10 minutes
                                               Returns: entities, validated (per-entity
                                               assertion), summary_en, model metadata

  /api/ai/digitize                      GET    Ping digitization service health
  /api/ai/digitize                      POST   Form digitization (RECEPTIONIST/ADMIN only)
                                               Forwards image to GPU digitization service
                                               Extracts table/grid structure from clinical forms

Python AI Service Endpoints (direct, not proxied — for reference):
  POST /ocr/document        OCR document → text
  POST /ner                 NER on text → entity list
  POST /assertion           Assertion on entities → labels
  POST /summarization       Summarize text → summary
  GET  /health              Service health

--------------------------------------------------------------------------------
SECTION 7 — AI PANELS BY ROLE
--------------------------------------------------------------------------------

All authenticated staff roles have access to /dashboard/ai with a role-specific
panel variant:

  DOCTOR / ADMIN → DoctorAIPanel
    Document types: Clinical Note, Referral Letter, Lab Report, Prescription
    Features:
      - Upload image or paste text
      - Run full pipeline (OCR → NER → Assertion → Summary)
      - View extracted entities with color-coded labels
        (Disease=blue, Symptom=green, Medication=orange, Lab_Result=cyan)
      - Assertion badges: PRESENT (green) / ABSENT (red) / POSSIBLE (yellow)
      - English summary card
      - NER confidence scores per entity

  RECEPTIONIST → ReceptionistAIPanel
    Tab 1 — ID/Referral Scanner:
      - Scan patient ID card → auto-fill patient registration form
      - Scan referral letter → extract patient + clinical details
      - Document type: ID Card or Referral Letter
    Tab 2 — Form Digitizer (FormDigitizer component):
      - Upload physical forms → GPU service extracts structured data
      - Supports table/grid formats used in Ethiopian hospital documents

  NURSE → NurseAIPanel
    - Upload symptom description or triage notes
    - AI flags risk level, suggests department routing
    - Shows active triage patient list from current queue

  LAB_TECHNICIAN → ViewOnlyAIPanel (Lab Report mode)
    - Upload lab report image/text
    - AI summarizes findings, highlights abnormal values
    - Entity extraction for lab results

  PHARMACIST → ViewOnlyAIPanel (Prescription Checker mode)
    - Upload prescription
    - AI extracts medicine names, dosages, frequencies
    - Basic drug entity validation

  ACCOUNTANT → ViewOnlyAIPanel (Billing Extractor mode)
    - Upload receipts or billing documents
    - AI extracts billable items and amounts

--------------------------------------------------------------------------------
SECTION 8 — DATA MODEL SUMMARY
--------------------------------------------------------------------------------

Core entities and relationships:

User (id: cuid)
  ├── role: ADMIN | RECEPTIONIST | DOCTOR | NURSE | LAB_TECHNICIAN
  │          | PHARMACIST | ACCOUNTANT | PATIENT
  ├── mustChangePassword: Boolean (set true for admin-created staff)
  ├── Optional profiles: Doctor, Nurse, LabTechnician, Pharmacist, Patient
  └── Relations: sessions, accounts, sent/received messages

Patient (id: National ID / FAN — explicit, not cuid)
  ├── Full demographics (name, DOB, gender, phone, address, etc.)
  ├── Medical info (blood group, allergies, chronic conditions, medications)
  ├── Insurance info (provider, policy number)
  ├── Emergency contact + next of kin
  ├── dischargeDocument: String — CUMULATIVE field, every consultation
  │   discharge summary is APPENDED here (permanent clinical history)
  └── Relations: appointments, visits, medical records, prescriptions,
                 lab requests, vitals, bills, discharges

Visit (the core workflow object)
  ├── status: VisitStatus enum (workflow states)
  ├── visitType: WALK_IN | ONLINE
  ├── queueNumber: Int (auto-assigned at creation)
  ├── chiefComplaint, triageNotes, consultationNotes
  ├── Assigned: nurseId, doctorId, departmentId
  └── Relations: VisitVitals, LabRequests[], Prescriptions[],
                 MedicalRecord, Patient, Nurse, Doctor

Doctor (role profile)
  ├── userId (1:1 with User)
  ├── specialization, departmentId
  ├── isAvailable, availability schedule, bio
  └── busy flag computed at query time (is there an IN_CONSULTATION visit?)

Prescription
  ├── code: String unique — human-readable RX-XXXX format
  ├── status: PENDING | DISPENSED | CANCELLED
  ├── medicines: PrescribedMedicine[] (name, dosage, frequency, duration)
  └── dispensation: Dispensation (pharmacist + timestamp)

Bill
  ├── items: BillItem[] (description, category, quantity, unit price)
  ├── subtotal, tax, discount, total
  ├── status: DRAFT | ISSUED | PARTIALLY_PAID | PAID | CANCELLED
  └── payments: Payment[] (amount, method, reference, paidAt)

Message
  ├── senderId, receiverId (both User)
  ├── content, read: Boolean
  └── Patients can only message Doctors (enforced in API)

--------------------------------------------------------------------------------
SECTION 9 — SIDEBAR NAVIGATION BY ROLE
--------------------------------------------------------------------------------

ADMIN:        Dashboard, Visit Queue, Users, Patients, Appointments,
              Medical Records, Lab Requests, Prescriptions, Billing,
              Departments, AI Analysis, Messages, (Profile)

RECEPTIONIST: Dashboard, Visit Queue, Patients, Appointments,
              AI Scanner, Messages, (Profile)

DOCTOR:       Dashboard, Visit Queue, Appointments, Patients,
              Medical Records, Lab Requests, Prescriptions,
              AI Analysis, Messages, (Profile)

NURSE:        Dashboard, Visit Queue, Patients, Vitals,
              AI Triage, Messages, (Profile)

LAB_TECHNICIAN: Dashboard, Lab Requests, AI Summary, Messages, (Profile)

PHARMACIST:   Dashboard, Prescriptions, AI Checker, Messages, (Profile)

ACCOUNTANT:   Dashboard, Billing, Patients, AI Extractor, Messages, (Profile)

PATIENT:      Dashboard, Book a Visit, My Appointments, Find Doctors,
              My Bills, Messages, (Profile)

--------------------------------------------------------------------------------
SECTION 10 — ENVIRONMENT VARIABLES
--------------------------------------------------------------------------------

DATABASE_URL              PostgreSQL connection string
AI_SERVICE_URL            FastAPI AI service URL (default: http://localhost:8000)
LOCAL_AI_SERVICE_URL      Local NER/assertion/summarization service URL
DIGITIZATION_SERVICE_URL  GPU form digitization service URL (default: http://localhost:8001)
BETTER_AUTH_SECRET        Auth signing secret
NEXT_PUBLIC_APP_URL       Public base URL for the web app

--------------------------------------------------------------------------------
SECTION 11 — TECHNOLOGY STACK
--------------------------------------------------------------------------------

Frontend:
  - Next.js 14 (App Router, Server + Client Components)
  - TypeScript
  - TailwindCSS
  - Framer Motion (animations)
  - TanStack Query (React Query — data fetching, caching, real-time refresh)
  - Lucide React (icons)

Backend:
  - Next.js API Routes (server-side)
  - Better Auth (session-based authentication, JWT)
  - Prisma ORM
  - PostgreSQL

AI Microservice (separate process):
  - Python 3.12
  - FastAPI + Uvicorn
  - HuggingFace Transformers
    · BertForTokenClassification (NER — medical entity extraction)
    · BertForSequenceClassification (Assertion — PRESENT/ABSENT/POSSIBLE)
    · BartForConditionalGeneration (Summarization — English)
  - Tesseract OCR (English document scanning)
  - Custom Amharic OCR pipeline (preprocessing + segmentation + recognition)
  - NumPy, SciPy, PIL (image preprocessing)

Language Support:
  - English (full feature support)
  - Amharic (OCR + translation; summarization in progress)

Target Environment:
  - Ethiopian hospitals
  - Supports Ethiopian National ID (FAN) format as patient primary key

================================================================================
END OF DOCUMENT
================================================================================
