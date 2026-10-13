import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

const minorCaseSchema = z.object({
  // Vitals (optional — may already be recorded)
  temperature:   z.string().optional(),
  bloodPressure: z.string().optional(),
  heartRate:     z.string().optional(),
  oxygenSat:     z.string().optional(),
  weight:        z.string().optional(),
  height:        z.string().optional(),
  triageNotes:   z.string().optional(),

  // Diagnosis / discharge summary
  diagnosis:       z.string().min(1, "Diagnosis is required"),
  treatment:       z.string().optional(),
  dischargeSummary: z.string().optional(), // saved to patient.dischargeDocument

  // Medicines
  medicines: z.array(z.object({
    name:         z.string().min(1, "Medicine name required"),
    dosage:       z.string().min(1, "Dosage required"),
    frequency:    z.string().min(1, "Frequency required"),
    duration:     z.string().min(1, "Duration required"),
    instructions: z.string().optional(),
  })).min(1, "At least one medicine required"),
});

/** Generate a short unique prescription code like RX-A3F9 */
function generateRxCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RX-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/visits/:id/minor-case
// Nurse handles a minor case: records vitals, prescribes medicine, discharges patient
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "NURSE"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only nurses can handle minor cases" }, { status: 403 });
  }

  const { id: visitId } = await params;
  const body = await req.json();
  const parsed = minorCaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Get visit with patient info
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      patient: true,
      nurse: { include: { user: { select: { name: true } } } },
    },
  });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  // Get nurse profile
  const nurse = await prisma.nurse.findUnique({ where: { userId: session.user.id } });
  if (!nurse && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nurse profile not found" }, { status: 404 });
  }

  // We need a doctorId for the prescription.
  // Priority: visit's assigned doctor → explicitly passed doctorId in body → error.
  // We never silently pick a random doctor, as that creates prescriptions
  // attributed to the wrong clinician.
  let doctorId = visit.doctorId;
  if (!doctorId) {
    if (body.doctorId) {
      doctorId = body.doctorId as string;
    } else {
      return NextResponse.json({
        error: "No doctor is assigned to this visit. Provide a doctorId in the request body to attribute the prescription to a supervising doctor.",
      }, { status: 400 });
    }
  }

  const {
    diagnosis, treatment, dischargeSummary, medicines,
    temperature, bloodPressure, heartRate, oxygenSat, weight, height, triageNotes,
  } = parsed.data;

  // Generate unique Rx code
  let code = generateRxCode();
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.prescription.findUnique({ where: { code } });
    if (!existing) break;
    code = generateRxCode();
  }

  // Build discharge summary text
  const now = new Date();
  const summaryText = [
    `=== MINOR CASE DISCHARGE SUMMARY ===`,
    `Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
    `Nurse: ${visit.nurse?.user?.name ?? session.user.name}`,
    ``,
    `DIAGNOSIS: ${diagnosis}`,
    treatment ? `TREATMENT: ${treatment}` : "",
    triageNotes ? `TRIAGE NOTES: ${triageNotes}` : "",
    ``,
    `PRESCRIBED MEDICINES:`,
    ...medicines.map((m, i) =>
      `  ${i + 1}. ${m.name} — ${m.dosage} · ${m.frequency} · ${m.duration}${m.instructions ? ` (${m.instructions})` : ""}`
    ),
    ``,
    dischargeSummary ? `ADDITIONAL NOTES:\n${dischargeSummary}` : "",
    ``,
    `Rx Code: ${code}`,
  ].filter(Boolean).join("\n");

  // Run everything in a transaction
  const [prescription, updatedVisit] = await prisma.$transaction(async (tx) => {
    // 1. Upsert vitals
    const vitalsData = { temperature, bloodPressure, heartRate, oxygenSat, weight, height, notes: triageNotes };
    await tx.visitVitals.upsert({
      where: { visitId },
      update: { ...vitalsData, nurseId: nurse?.id ?? "" },
      create: { visitId, nurseId: nurse?.id ?? "", ...vitalsData },
    });

    // 2. Create prescription
    const rx = await tx.prescription.create({
      data: {
        patientId: visit.patientId,
        doctorId,
        visitId,
        code,
        notes: `Minor case — handled by nurse. Diagnosis: ${diagnosis}`,
        medicines: { create: medicines },
      },
      include: { medicines: true },
    });

    // 3. Update visit — complete it
    const v = await tx.visit.update({
      where: { id: visitId },
      data: {
        status: "COMPLETED",
        requiresDoctor: false,
        triageNotes: triageNotes ?? visit.triageNotes,
        triageCompletedAt: new Date(),
        completedAt: new Date(),
      },
      include: {
        patient: true,
        nurse: { include: { user: { select: { name: true } } } },
      },
    });

    // 4. Append discharge summary to patient.dischargeDocument
    const existingDoc = visit.patient.dischargeDocument ?? "";
    const separator = existingDoc ? "\n\n---\n\n" : "";
    await tx.patient.update({
      where: { id: visit.patientId },
      data: {
        status: "DISCHARGED",
        dischargeDocument: existingDoc + separator + summaryText,
      },
    });

    return [rx, v];
  });

  return NextResponse.json({
    prescription,
    visit: updatedVisit,
    summaryText,
    rxCode: code,
  }, { status: 201 });
}
