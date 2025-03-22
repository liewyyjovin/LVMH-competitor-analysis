import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Correctly destructure and access the sessionId
    const { sessionId } = params;
    
    // Validate session ID format (basic UUID validation)
    if (!sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }
    
    // Check if the document exists
    const docPath = join(process.cwd(), 'uploads', sessionId, 'analysis.docx');
    
    if (!existsSync(docPath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Read the document
    const fileBuffer = await readFile(docPath);
    
    // Return the document as a download
    const response = new NextResponse(fileBuffer);
    
    // Set headers for file download
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    response.headers.set('Content-Disposition', `attachment; filename="LVMH_Competitor_Analysis_${sessionId}.docx"`);
    
    return response;
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
} 