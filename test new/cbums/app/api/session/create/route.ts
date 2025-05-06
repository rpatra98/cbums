import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ActivityAction, EmployeeSubrole, SessionStatus, TransactionReason, UserRole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { source, destination, barcode } = body;

    // Validation
    if (!source || !destination || !barcode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Only operators can create sessions
    if (session?.user.subrole !== EmployeeSubrole.OPERATOR) {
      return NextResponse.json(
        { error: "Only operators can create sessions" },
        { status: 403 }
      );
    }

    // Get operator details
    const operator = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    });

    if (!operator || !operator.companyId) {
      return NextResponse.json(
        { error: "Operator must belong to a company" },
        { status: 400 }
      );
    }

    // Check if operator has enough coins (minimum 1 coin needed)
    const operatorCoins = operator.coins ?? 0;
    if (operatorCoins < 1) {
      return NextResponse.json(
        { error: "Insufficient coins. You need at least 1 coin to create a session." },
        { status: 400 }
      );
    }

    // Use a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Deduct coin from operator
      await tx.user.update({
        where: { id: session.user.id },
        data: { coins: { decrement: 1 } }
      });

      // Create the session first to get its ID
      const newSession = await tx.session.create({
        data: {
          createdById: session.user.id,
          companyId: operator.companyId as string,
          source,
          destination,
          status: SessionStatus.PENDING,
          seal: {
            create: {
              barcode
            }
          }
        },
        include: { seal: true }
      });

      // Create coin transaction record with session reference - coin is spent, not transferred
      const coinTransaction = await tx.coinTransaction.create({
        data: {
          fromUserId: session.user.id,
          toUserId: session.user.id, // Operator spends the coin (not transferred to another user)
          amount: 1,
          reason: TransactionReason.SESSION_CREATION as any,
          reasonText: `Session ID: ${newSession.id} - From ${source} to ${destination} with barcode ${barcode}`
        }
      });

      // Log the activity
      await addActivityLog({
        userId: session.user.id,
        action: ActivityAction.CREATE,
        details: {
          entityType: "SESSION",
          sessionId: newSession.id,
          source,
          destination,
          barcode,
          cost: "1 coin"
        },
        targetResourceId: newSession.id,
        targetResourceType: "SESSION"
      });

      // Create activity log for session creation
      await tx.activityLog.create({
        data: {
          action: 'CREATE',
          targetResourceType: 'session',
          targetResourceId: newSession.id,
          userId: session.user.id,
          details: {
            tripDetails: {
              transporterName: body.transporterName,
              materialName: body.materialName,
              vehicleNumber: body.vehicleNumber,
              gpsImeiNumber: body.gpsImeiNumber,
              driverName: body.driverName,
              driverContactNumber: body.driverContactNumber,
              loaderName: body.loaderName,
              loaderMobileNumber: body.loaderMobileNumber,
              challanRoyaltyNumber: body.challanRoyaltyNumber,
              doNumber: body.doNumber,
              tpNumber: body.tpNumber,
              qualityOfMaterials: body.qualityOfMaterials,
              freight: body.freight,
              grossWeight: body.grossWeight,
              tareWeight: body.tareWeight,
              netMaterialWeight: body.netMaterialWeight,
              loadingSite: body.loadingSite,
              receiverPartyName: body.receiverPartyName
            }
          }
        }
      });

      return { 
        session: newSession, 
        transaction: coinTransaction,
        operator: {
          id: operator.id,
          remainingCoins: operator.coins! - 1
        }
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    
    // Check for specific error types
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: "Duplicate barcode detected" },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// Only employees with OPERATOR subrole can create sessions
export const POST = withAuth(handler, [UserRole.EMPLOYEE]); 