import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { messageSchema } from "@/lib/validations";

// GET /api/messages?withUserId=xxx  — get conversation with a specific user
// GET /api/messages?inbox=true      — get all conversations (inbox)
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const withUserId = searchParams.get("withUserId");
  const inbox = searchParams.get("inbox") === "true";

  if (withUserId) {
    // Full conversation between current user and withUserId
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: withUserId },
          { senderId: withUserId, receiverId: session.user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });

    // Mark received messages as read
    await prisma.message.updateMany({
      where: { senderId: withUserId, receiverId: session.user.id, read: false },
      data: { read: true },
    });

    return NextResponse.json({ messages });
  }

  if (inbox) {
    // Get unique conversation partners with latest message
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });

    // Deduplicate by conversation partner
    const seen = new Set<string>();
    const conversations: any[] = [];
    for (const msg of messages) {
      const partnerId = msg.senderId === session.user.id ? msg.receiverId : msg.senderId;
      if (!seen.has(partnerId)) {
        seen.add(partnerId);
        const partner = msg.senderId === session.user.id ? msg.receiver : msg.sender;
        const unread = await prisma.message.count({
          where: { senderId: partnerId, receiverId: session.user.id, read: false },
        });
        conversations.push({ partner, lastMessage: msg, unread });
      }
    }

    return NextResponse.json({ conversations });
  }

  return NextResponse.json({ error: "Missing query param" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify receiver exists
  const receiver = await prisma.user.findUnique({ where: { id: parsed.data.receiverId } });
  if (!receiver) return NextResponse.json({ error: "Receiver not found" }, { status: 404 });

  // Patients can only message doctors, doctors can message patients/admins
  if (session.user.role === "PATIENT" && receiver.role !== "DOCTOR") {
    return NextResponse.json({ error: "Patients can only message doctors" }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: {
      senderId: session.user.id,
      receiverId: parsed.data.receiverId,
      content: parsed.data.content,
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
      receiver: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
