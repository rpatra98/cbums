import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import * as ExcelJS from 'exceljs';

interface TripDetails {
  transporterName: string;
  materialName: string;
  vehicleNumber: string;
  gpsImeiNumber: string;
  driverName: string;
  driverContactNumber: string;
  loaderName: string;
  loaderMobileNumber: string;
  challanRoyaltyNumber: string;
  doNumber: string;
  tpNumber: string;
  qualityOfMaterials: string;
  freight: number;
  grossWeight: number;
  tareWeight: number;
  netMaterialWeight: number;
  loadingSite: string;
  receiverPartyName: string;
}

interface ActivityLogDetails {
  tripDetails?: TripDetails;
  [key: string]: unknown;
}

// Generate Excel report for session
export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      if (!context || !context.params.id) {
        return NextResponse.json(
          { error: "Session ID is required" },
          { status: 400 }
        );
      }

      const session = await getServerSession(authOptions);
      const userRole = session?.user.role;
      const userId = session?.user.id;
      
      const sessionId = context.params.id;
      
      console.log(`[EXCEL REPORT] Starting report generation for session ${sessionId}`);
      
      // Basic authorization check
      if (
        userRole !== UserRole.SUPERADMIN && 
        userRole !== UserRole.ADMIN && 
        userRole !== UserRole.COMPANY
      ) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }
      
      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CBUMS System';
      workbook.created = new Date();
      
      // =========================================================
      // 1. CREATE BASIC SESSION INFO SHEET
      // =========================================================
      console.log(`[EXCEL REPORT] Creating basic session info sheet`);
      
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: { select: { name: true, email: true } },
          company: { select: { name: true } },
          seal: true,
        },
      });
      
      if (!sessionData) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      // COMPANY user check - can only download their own sessions
      if (userRole === UserRole.COMPANY && userId !== sessionData.companyId) {
        return NextResponse.json(
          { error: "Unauthorized - You can only download reports for your own sessions" },
          { status: 403 }
        );
      }
      
      // Create basic info sheet
      const basicSheet = workbook.addWorksheet('Session Info');
      basicSheet.columns = [
        { header: 'Property', key: 'property', width: 30 },
        { header: 'Value', key: 'value', width: 50 }
      ];
      
      // Style header row
      basicSheet.getRow(1).font = { bold: true };
      basicSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      
      // Add basic session data
      basicSheet.addRow({ property: 'Session ID', value: sessionData.id });
      basicSheet.addRow({ property: 'Status', value: sessionData.status });
      basicSheet.addRow({ property: 'Created At', value: new Date(sessionData.createdAt).toLocaleString() });
      basicSheet.addRow({ property: 'Source', value: sessionData.source });
      basicSheet.addRow({ property: 'Destination', value: sessionData.destination });
      basicSheet.addRow({ property: 'Company', value: sessionData.company.name });
      basicSheet.addRow({ property: 'Created By', value: `${sessionData.createdBy.name} (${sessionData.createdBy.email})` });
      
      // Add seal info if available
      if (sessionData.seal) {
        basicSheet.addRow({ property: 'Seal Barcode', value: sessionData.seal.barcode });
        basicSheet.addRow({ property: 'Seal Status', value: sessionData.seal.verified ? 'Verified' : 'Not Verified' });
      }
      
      // =========================================================
      // 2. CREATE TRIP DETAILS SHEET - CRITICAL!
      // =========================================================
      console.log(`[EXCEL REPORT] Creating trip details sheet - CRITICAL`);
      
      // Try to get trip details from activity log
      let tripDetails = null;
      try {
        const activityLog = await prisma.activityLog.findFirst({
          where: {
            targetResourceId: sessionId,
            targetResourceType: 'session',
            action: 'CREATE',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        if (activityLog?.details) {
          const details = activityLog.details as ActivityLogDetails;
          if (details.tripDetails) {
            tripDetails = details.tripDetails;
            console.log(`[EXCEL REPORT] Found trip details in activity log`);
          }
        }
      } catch (error: unknown) {
        console.error(`[EXCEL REPORT] Error getting trip details:`, error);
      }
      
      // GUARANTEED SAMPLE DATA - Will always be included if no trip details found
      const SAMPLE_TRIP_DETAILS: TripDetails = {
        transporterName: "SAMPLE TRANSPORTER",
        materialName: "SAMPLE MATERIAL",
        vehicleNumber: "SAMPLE-123456",
        gpsImeiNumber: "123456789012345",
        driverName: "SAMPLE DRIVER",
        driverContactNumber: "1234567890",
        loaderName: "SAMPLE LOADER",
        loaderMobileNumber: "0987654321",
        challanRoyaltyNumber: "SAMPLE-CR-12345",
        doNumber: "SAMPLE-DO-67890",
        tpNumber: "SAMPLE-TP-54321",
        qualityOfMaterials: "SAMPLE QUALITY",
        freight: 5000,
        grossWeight: 10000,
        tareWeight: 3000,
        netMaterialWeight: 7000,
        loadingSite: "SAMPLE LOADING SITE",
        receiverPartyName: "SAMPLE RECEIVER"
      };
      
      // Use the real trip details if found, otherwise use sample data
      const finalTripDetails = tripDetails || SAMPLE_TRIP_DETAILS;
      
      // Create trip details sheet
      const tripSheet = workbook.addWorksheet('Trip Details');
      
      // Add a very prominent header
      tripSheet.mergeCells('A1:C1');
      const headerCell = tripSheet.getCell('A1');
      headerCell.value = 'TRIP DETAILS';
      headerCell.font = { size: 16, bold: true, color: { argb: 'FF0000FF' } };
      headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD700' }
      };
      headerCell.alignment = { horizontal: 'center' };
      
      // Add data source info
      tripSheet.mergeCells('A2:C2');
      const sourceCell = tripSheet.getCell('A2');
      sourceCell.value = `Data Source: ${tripDetails ? 'Database' : 'SAMPLE (Due to missing data)'}`;
      sourceCell.font = { italic: true };
      
      // Add column headers in row 3
      tripSheet.columns = [
        { header: 'Field Name', key: 'field', width: 30 },
        { header: 'Value', key: 'value', width: 40 },
        { header: 'Source', key: 'source', width: 20 }
      ];
      
      // Style the column header row
      const headerRow = tripSheet.getRow(3);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }
      };
      headerRow.font.color = { argb: 'FFFFFFFF' };
      
      // Define the standard trip detail fields
      const tripFields = [
        { key: 'transporterName', label: 'Transporter Name' },
        { key: 'materialName', label: 'Material Name' },
        { key: 'vehicleNumber', label: 'Vehicle Number' },
        { key: 'gpsImeiNumber', label: 'GPS IMEI Number' },
        { key: 'driverName', label: 'Driver Name' },
        { key: 'driverContactNumber', label: 'Driver Contact Number' },
        { key: 'loaderName', label: 'Loader Name' },
        { key: 'loaderMobileNumber', label: 'Loader Mobile Number' },
        { key: 'challanRoyaltyNumber', label: 'Challan/Royalty Number' },
        { key: 'doNumber', label: 'DO Number' },
        { key: 'tpNumber', label: 'TP Number' },
        { key: 'qualityOfMaterials', label: 'Quality of Materials' },
        { key: 'freight', label: 'Freight' },
        { key: 'grossWeight', label: 'Gross Weight (kg)' },
        { key: 'tareWeight', label: 'Tare Weight (kg)' },
        { key: 'netMaterialWeight', label: 'Net Material Weight (kg)' },
        { key: 'loadingSite', label: 'Loading Site' },
        { key: 'receiverPartyName', label: 'Receiver Party Name' }
      ];
      
      // Add each trip detail field to the sheet
      console.log(`[EXCEL REPORT] Adding trip details fields to Excel`);
      let currentRow = 4;
      for (const field of tripFields) {
        const value = finalTripDetails[field.key as keyof TripDetails];
        const displayValue = value !== undefined && value !== null 
          ? String(value)
          : 'N/A';
        
        tripSheet.addRow({
          field: field.label,
          value: displayValue,
          source: tripDetails ? 'Database' : 'Sample'
        });
        
        currentRow++;
      }
      
      // =========================================================
      // 3. ADD VERIFICATION DATA IF AVAILABLE
      // =========================================================
      
      // Check for verification data
      try {
        const verificationLogs = await prisma.activityLog.findMany({
          where: {
            targetResourceId: sessionId,
            targetResourceType: 'session',
            action: 'UPDATE',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        // Look for verification data in logs
        let verificationData = null;
        for (const log of verificationLogs) {
          if (log.details && typeof log.details === 'object') {
            const details = log.details as any;
            if (details.verification) {
              verificationData = details.verification;
              break;
            }
          }
        }
        
        // If verification data exists, create a sheet for it
        if (verificationData && verificationData.fieldVerifications) {
          console.log(`[EXCEL REPORT] Adding verification data`);
          
          const verificationSheet = workbook.addWorksheet('Verification');
          
          verificationSheet.columns = [
            { header: 'Field', key: 'field', width: 30 },
            { header: 'Operator Value', key: 'operatorValue', width: 25 },
            { header: 'Guard Value', key: 'guardValue', width: 25 },
            { header: 'Match', key: 'match', width: 10 },
            { header: 'Comment', key: 'comment', width: 30 }
          ];
          
          // Style header row
          const verificationHeader = verificationSheet.getRow(1);
          verificationHeader.font = { bold: true };
          verificationHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
          
          // Add overall status
          verificationSheet.addRow({
            field: 'OVERALL STATUS',
            operatorValue: '',
            guardValue: '',
            match: verificationData.allMatch ? 'YES' : 'NO',
            comment: verificationData.allMatch ? 'All fields match' : 'Some fields do not match'
          });
          
          // Add verification for each field
          Object.entries(verificationData.fieldVerifications).forEach(([field, data]) => {
            const fieldData = data as any;
            const formattedField = field.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            const isMatch = fieldData.operatorValue === fieldData.guardValue;
            
            const row = verificationSheet.addRow({
              field: formattedField,
              operatorValue: fieldData.operatorValue,
              guardValue: fieldData.guardValue,
              match: isMatch ? 'YES' : 'NO',
              comment: fieldData.comment || ''
            });
            
            // Color the match cell based on match status
            const matchCell = row.getCell('match');
            matchCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isMatch ? 'FF92D050' : 'FFFF0000' }  // Green or Red
            };
            matchCell.font.color = { argb: 'FFFFFFFF' };
          });
        }
      } catch (error) {
        console.error(`[EXCEL REPORT] Error adding verification data:`, error);
      }
      
      // =========================================================
      // 4. ADD COMMENTS IF AVAILABLE
      // =========================================================
      
      try {
        // Get comments for this session
        const comments = await prisma.comment.findMany({
          where: { sessionId },
          include: {
            user: {
              select: { name: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        if (comments.length > 0) {
          console.log(`[EXCEL REPORT] Adding ${comments.length} comments`);
          
          const commentsSheet = workbook.addWorksheet('Comments');
          
          commentsSheet.columns = [
            { header: 'Date', key: 'date', width: 20 },
            { header: 'User', key: 'user', width: 25 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'Comment', key: 'comment', width: 50 }
          ];
          
          // Style header row
          const commentsHeader = commentsSheet.getRow(1);
          commentsHeader.font = { bold: true };
          commentsHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
          
          // Add each comment
          comments.forEach(comment => {
            commentsSheet.addRow({
              date: new Date(comment.createdAt).toLocaleString(),
              user: comment.user.name,
              role: comment.user.role,
              comment: comment.message
            });
          });
        }
      } catch (error) {
        console.error(`[EXCEL REPORT] Error adding comments:`, error);
      }
      
      // =========================================================
      // 5. GENERATE AND RETURN THE EXCEL FILE
      // =========================================================
      
      console.log(`[EXCEL REPORT] Generating Excel buffer`);
      const buffer = await workbook.xlsx.writeBuffer();
      
      console.log(`[EXCEL REPORT] Returning Excel file`);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=session-${sessionId}.xlsx`,
        },
      });
      
    } catch (error) {
      console.error("[EXCEL REPORT] Error generating report:", error);
      return NextResponse.json(
        { error: "Failed to generate Excel report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 