import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { sessionId, message } = body;

    // Validation
    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "Session ID and message are required" },
        { status: 400 }
      );
    }

    // Check if the session exists
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!sessionData) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check permission based on role
    const userRole = session.user.role;
    const userId = session.user.id;

    // Only Company users or Admin/SuperAdmin can add comments
    if (![UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPERADMIN].includes(userRole as UserRole)) {
      return NextResponse.json(
        { error: "You don't have permission to add comments" },
        { status: 403 }
      );
    }

    // If company, ensure they are commenting on their own session
    if (userRole === UserRole.COMPANY && sessionData.companyId !== userId) {
      return NextResponse.json(
        { error: "You can only comment on your own sessions" },
        { status: 403 }
      );
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        sessionId,
        userId: session.user.id,
        message,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }
}

// Company, Admin, and SuperAdmin can add comments to sessions
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      
      const body = await req.json();
      const { sessionId, message } = body;

      // Validation
      if (!sessionId || !message) {
        return NextResponse.json(
          { error: "Session ID and message are required" },
          { status: 400 }
        );
      }

      // Check if the session exists
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!sessionData) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Check permission based on role
      const userRole = session.user.role;
      const userId = session.user.id;

      // Only Company users or Admin/SuperAdmin can add comments
      if (![UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPERADMIN].includes(userRole as UserRole)) {
        return NextResponse.json(
          { error: "You don't have permission to add comments" },
          { status: 403 }
        );
      }

      // If company, ensure they are commenting on their own session
      if (userRole === UserRole.COMPANY && sessionData.companyId !== userId) {
        return NextResponse.json(
          { error: "You can only comment on your own sessions" },
          { status: 403 }
        );
      }

      // Create the comment
      const comment = await prisma.comment.create({
        data: {
          sessionId,
          userId: session.user.id,
          message,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return NextResponse.json(comment, { status: 201 });
    } catch (error) {
      console.error("Error adding comment:", error);
      return NextResponse.json(
        { error: "Failed to add comment" },
        { status: 500 }
      );
    }
  },
  [UserRole.COMPANY, UserRole.ADMIN, UserRole.SUPERADMIN]
); 