import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import JSZip from 'jszip';

// Separate handler function to process the request
async function handleDownload(sessionId: string) {
  try {
    // Validate session ID format (basic UUID validation)
    if (!sessionId || !sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }
    
    // Check if the document exists
    const sessionDir = join(process.cwd(), 'uploads', sessionId);
    const docPath = join(sessionDir, 'analysis.docx');
    const htmlPath = join(sessionDir, 'embedded_images.html');
    
    if (!existsSync(docPath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Create a zip file containing the document and HTML file
    const zip = new JSZip();
    
    // Read the document
    console.log(`Reading document: ${docPath}`);
    const docBuffer = await readFile(docPath);
    zip.file("LVMH_Competitor_Analysis.docx", docBuffer);
    
    // Check if HTML file exists and add it to the zip
    if (existsSync(htmlPath)) {
      console.log(`Reading HTML file: ${htmlPath}`);
      const htmlBuffer = await readFile(htmlPath);
      zip.file("Source_Images.html", htmlBuffer);
    }
    
    // Generate zip file
    console.log('Generating ZIP file...');
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6 // Medium compression
      }
    });
    
    // Return the zip file as a download
    console.log('Sending ZIP file to client...');
    const response = new NextResponse(zipBuffer);
    
    // Set headers for file download
    response.headers.set('Content-Type', 'application/zip');
    response.headers.set('Content-Disposition', `attachment; filename="LVMH_Competitor_Analysis_${sessionId}.zip"`);
    
    return response;
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}

// Route handler
export async function GET(
  request: NextRequest, 
  context: { params: { sessionId: string } }
) {
  const { sessionId } = context.params;
  // Call the handler with the sessionId
  return handleDownload(sessionId);
} 