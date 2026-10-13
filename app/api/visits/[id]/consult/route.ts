import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { consultationSchema } from "@/lib/validations";

// POST /api/visits/:id/consult — doctor adds diagnosis and closes visit
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "DOCTOR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Only doctors can complete consultation" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = consultationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
  if (!doctor && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Doctor profile not found" }, { status: 404 });
  }

  const visit = await prisma.visit.findUnique({
    where: { id },
    include: {
      patient: true,
      vitals: true,
      nurse: { include: { user: { select: { name: true } } } },
    },
  });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const effectiveDoctorId = doctor?.id ?? visit.doctorId!;
  const { diagnosis, symptoms, treatment, consultationNotes, dischargeNotes, followUpDate, admitPatient } = parsed.data;

  // Build discharge summary text to append to patient.dischargeDocument
  const now = new Date();
  const summaryLines = [
    `=== DOCTOR CONSULTATION DISCHARGE SUMMARY ===`,
    `Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
    `Doctor: ${session.user.name}`,
    visit.nurse ? `Nurse: ${visit.nurse.user.name}` : "",
    `Queue #: ${visit.queueNumber ?? "—"}`,
    ``,
    `DIAGNOSIS: ${diagnosis}`,
    symptoms    ? `SYMPTOMS: ${symptoms}` : "",
    treatment   ? `TREATMENT: ${treatment}` : "",
    consultationNotes ? `CONSULTATION NOTES: ${consultationNotes}` : "",
    ``,
    // Vitals if available
    visit.vitals ? [
      `VITALS AT VISIT:`,
      visit.vitals.bloodPressure   ? `  Blood Pressure: ${visit.vitals.bloodPressure}` : "",
      visit.vitals.heartRate       ? `  Heart Rate: ${visit.vitals.heartRate} bpm` : "",
      visit.vitals.temperature     ? `  Temperature: ${visit.vitals.temperature} °C` : "",
      visit.vitals.oxygenSat       ? `  O₂ Saturation: ${visit.vitals.oxygenSat}%` : "",
      visit.vitals.weight          ? `  Weight: ${visit.vitals.weight} kg` : "",
      visit.vitals.height          ? `  Height: ${visit.vitals.height} cm` : "",
    ].filter(Boolean).join("\n") : "",
    ``,
    dischargeNotes ? `DISCHARGE NOTES:\n${dischargeNotes}` : "",
    followUpDate   ? `FOLLOW-UP DATE: ${new Date(followUpDate).toLocaleDateString()}` : "",
    admitPatient   ? `STATUS: Patient admitted to hospital` : `STATUS: Discharged`,
  ].filter(l => l !== "").join("\n");

  const existingDoc = visit.patient.dischargeDocument ?? "";
  const separator = existingDoc ? "\n\n---\n\n" : "";
  const updatedDoc = existingDoc + separator + summaryLines;

  const [updatedVisit, medicalRecord] = await prisma.$transaction([
    prisma.visit.update({
      where: { id },
      data: {
        status: "COMPLETED",
        consultationNotes,
        consultationCompletedAt: now,
        completedAt: now,
      },
    }),
    prisma.medicalRecord.upsert({
      where: { visitId: id },
      update: {
        diagnosis,
        symptoms,
        treatment,
        notes: consultationNotes,
        admitPatient,
      },
      create: {
        patientId: visit.patientId,
        doctorId: effectiveDoctorId,
        visitId: id,
        diagnosis,
        symptoms,
        treatment,
        notes: consultationNotes,
        admitPatient,
      },
    }),
  ]);

  // Update patient status + append discharge summary
  const newPatientStatus = admitPatient ? "ADMITTED" : "REGISTERED";
  await prisma.patient.update({
    where: { id: visit.patientId },
    data: {
      status: newPatientStatus,
      dischargeDocument: updatedDoc,
    },
  });

  // Create discharge record if discharge notes provided
  if (dischargeNotes && effectiveDoctorId) {
    await prisma.discharge.create({
      data: {
        patientId: visit.patientId,
        doctorId: effectiveDoctorId,
        dischargeNotes,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      },
    }).catch(() => {}); // non-fatal
  }

  return NextResponse.json({ visit: updatedVisit, medicalRecord });
}
