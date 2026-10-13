import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ─────────────────────────────────────────────────────────────────────────────
  // RECEPTIONIST
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "RECEPTIONIST") {
    const [todayAppointments, waitingPatients, totalPatients, recentAppointments] = await Promise.all([
      prisma.appointment.count({ where: { scheduledAt: { gte: today, lt: tomorrow } } }),
      prisma.patient.count({ where: { status: "WAITING" } }),
      prisma.patient.count(),
      prisma.appointment.findMany({
        take: 5,
        orderBy: { scheduledAt: "asc" },
        where: { scheduledAt: { gte: today, lt: tomorrow } },
        include: {
          patient: { select: { name: true } },
          doctor: { include: { user: { select: { name: true } } } },
        },
      }),
    ]);
    return NextResponse.json({ todayAppointments, waitingPatients, totalPatients, recentAppointments });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOCTOR
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: session.user.id } });
    if (!doctor) {
      // Doctor profile not yet created — return safe defaults so the dashboard still loads
      return NextResponse.json({
        todayAppointments: 0,
        pendingLabRequests: 0,
        pendingPrescriptions: 0,
        recentAppointments: [],
      });
    }

    const [todayAppointments, pendingLabRequests, pendingPrescriptions, recentAppointments] = await Promise.all([
      prisma.appointment.count({ where: { doctorId: doctor.id, scheduledAt: { gte: today, lt: tomorrow } } }),
      prisma.labRequest.count({ where: { doctorId: doctor.id, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      prisma.prescription.count({ where: { doctorId: doctor.id, status: "PENDING" } }),
      prisma.appointment.findMany({
        take: 5,
        orderBy: { scheduledAt: "asc" },
        where: { doctorId: doctor.id, scheduledAt: { gte: today, lt: tomorrow } },
        include: { patient: { select: { name: true, status: true } } },
      }),
    ]);
    return NextResponse.json({ todayAppointments, pendingLabRequests, pendingPrescriptions, recentAppointments });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NURSE
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "NURSE") {
    const [waitingPatients, admittedPatients, recentVitals] = await Promise.all([
      prisma.patient.count({ where: { status: "WAITING" } }),
      prisma.patient.count({ where: { status: "ADMITTED" } }),
      prisma.vitals.findMany({
        take: 5,
        orderBy: { recordedAt: "desc" },
        include: { patient: { select: { name: true } } },
      }),
    ]);
    return NextResponse.json({ waitingPatients, admittedPatients, recentVitals });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LAB TECHNICIAN
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "LAB_TECHNICIAN") {
    const [pendingRequests, completedToday, recentRequests] = await Promise.all([
      prisma.labRequest.count({ where: { status: "PENDING" } }),
      prisma.labRequest.count({ where: { status: "COMPLETED", updatedAt: { gte: today } } }),
      prisma.labRequest.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        where: { status: "PENDING" },
        include: {
          patient: { select: { name: true } },
          doctor: { include: { user: { select: { name: true } } } },
        },
      }),
    ]);
    return NextResponse.json({ pendingRequests, completedToday, recentRequests });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHARMACIST
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "PHARMACIST") {
    const [pendingPrescriptions, dispensedToday, recentPrescriptions] = await Promise.all([
      prisma.prescription.count({ where: { status: "PENDING" } }),
      prisma.dispensation.count({ where: { dispensedAt: { gte: today } } }),
      prisma.prescription.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        where: { status: "PENDING" },
        include: {
          patient: { select: { name: true } },
          medicines: true,
          doctor: { include: { user: { select: { name: true } } } },
        },
      }),
    ]);
    return NextResponse.json({ pendingPrescriptions, dispensedToday, recentPrescriptions });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCOUNTANT
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "ACCOUNTANT") {
    const [unpaidBills, paidToday, totalRevenue, recentBills] = await Promise.all([
      prisma.bill.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
      prisma.payment.count({ where: { paidAt: { gte: today } } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.bill.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { patient: { select: { name: true } }, payments: true },
      }),
    ]);
    return NextResponse.json({
      unpaidBills,
      paidToday,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      recentBills,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATIENT
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId: session.user.id } });
    if (!patient) {
      return NextResponse.json({ myAppointments: 0, unpaidBills: 0, unreadMessages: 0 });
    }
    const [myAppointments, unpaidBills, unreadMessages] = await Promise.all([
      prisma.appointment.count({ where: { patientId: patient.id } }),
      prisma.bill.count({ where: { patientId: patient.id, status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
      prisma.message.count({ where: { receiverId: session.user.id, read: false } }),
    ]);
    return NextResponse.json({ myAppointments, unpaidBills, unreadMessages, patient });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────────────────────────────────────
  if (role === "ADMIN") {
    const [
      totalPatients,
      totalDoctors,
      totalNurses,
      totalLabTechs,
      totalPharmacists,
      totalReceptionists,
      totalDepartments,
      todayAppointments,
      pendingLabRequests,
      pendingPrescriptions,
      unpaidBills,
      totalRevenueAgg,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.nurse.count(),
      prisma.labTechnician.count(),
      prisma.pharmacist.count(),
      prisma.user.count({ where: { role: "RECEPTIONIST" } }),
      prisma.department.count(),
      prisma.appointment.count({ where: { scheduledAt: { gte: today, lt: tomorrow } } }),
      prisma.labRequest.count({ where: { status: "PENDING" } }),
      prisma.prescription.count({ where: { status: "PENDING" } }),
      prisma.bill.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
    ]);

    const recentAppointments = await prisma.appointment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { name: true } },
        doctor: { include: { user: { select: { name: true } } } },
      },
    });

    return NextResponse.json({
      totalPatients,
      totalDoctors,
      totalNurses,
      totalLabTechs,
      totalLabTechnicians: totalLabTechs,
      totalPharmacists,
      totalReceptionists,
      totalDepartments,
      todayAppointments,
      pendingLabRequests,
      pendingPrescriptions,
      unpaidBills,
      totalRevenue: totalRevenueAgg._sum.amount ?? 0,
      recentAppointments,
    });
  }

  // Fallback for unknown role
  return NextResponse.json({ error: "Invalid role" }, { status: 403 });
}