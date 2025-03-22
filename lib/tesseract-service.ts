import * as nodeTesseract from 'node-tesseract-ocr';
import { setProgress, clearProgress } from '@/app/api/ocr-progress/route';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Configure Tesseract options
const config = {
  lang: 'eng', // Language
  oem: 1,      // OCR Engine Mode (1 = Neural nets LSTM engine only)
  psm: 3,      // Page Segmentation Mode (3 = Fully automatic page segmentation, but no OSD)
};

/**
 * Formats elapsed time in a human-readable format
 * @param ms Milliseconds
 * @returns Formatted string (e.g. "2m 30s")
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Estimates remaining time based on elapsed time and progress
 * @param elapsedMs Milliseconds elapsed so far
 * @param completed Number of completed items
 * @param total Total number of items
 * @returns Estimated time remaining in formatted string
 */
function estimateRemainingTime(elapsedMs: number, completed: number, total: number): string {
  if (completed === 0) return "calculating...";
  
  const msPerItem = elapsedMs / completed;
  const itemsRemaining = total - completed;
  const msRemaining = msPerItem * itemsRemaining;
  
  return formatElapsedTime(msRemaining);
}

/**
 * Processes an image file with Tesseract OCR to extract text
 * @param imageBuffer Buffer containing the image data
 * @returns Extracted text from the image
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    console.log('🔍 Starting OCR on single image...');
    const startTime = Date.now();

    // Create a temporary file path for the image
    console.log('📄 Creating temporary file...');
    const tempPath = join(process.cwd(), 'uploads', `${randomUUID()}.png`);
    
    // Write the buffer to a temporary file
    await writeFile(tempPath, imageBuffer);
    console.log('💾 Image saved to temporary file');
    
    // Process the image with Tesseract OCR
    console.log('🔍 Running OCR analysis...');
    const text = await nodeTesseract.recognize(tempPath, config);
    
    const endTime = Date.now();
    console.log(`✅ OCR completed in ${formatElapsedTime(endTime - startTime)}`);
    
    return text;
  } catch (error) {
    console.error('❌ Error during OCR processing:', error);
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process multiple images and extract text from all of them
 * @param imageBuffers Array of image buffers to process
 * @param sessionId Session ID for progress tracking
 * @returns Array of extracted text results
 */
export async function processMultipleImages(imageBuffers: Buffer[], sessionId?: string): Promise<string[]> {
  try {
    const totalImages = imageBuffers.length;
    const startTime = Date.now();
    
    console.log('');
    console.log('='.repeat(50));
    console.log(`🚀 Starting OCR processing of ${totalImages} images...`);
    console.log('='.repeat(50));
    
    // Initialize progress tracking if sessionId is provided
    if (sessionId) {
      setProgress(sessionId, 0, totalImages);
    }

    // Process each image
    const results: string[] = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const buffer = imageBuffers[i];
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;
      const remainingEstimate = estimateRemainingTime(elapsedTime, i, totalImages);
      
      // Log detailed progress
      console.log('');
      console.log(`📷 Processing image ${i + 1}/${totalImages} (${Math.round((i+1)/totalImages*100)}%)`);
      console.log(`⏱️  Elapsed time: ${formatElapsedTime(elapsedTime)}`);
      console.log(`⏳ Estimated time remaining: ${remainingEstimate}`);
      
      // Update progress if sessionId is provided
      if (sessionId) {
        setProgress(sessionId, i, totalImages);
      }
      
      // Create a temporary file path for the image
      const tempPath = join(process.cwd(), 'uploads', `${randomUUID()}.png`);
      console.log(`💾 Saving temporary file: ${tempPath.split('/').pop()}`);
      
      // Write the buffer to a temporary file
      await writeFile(tempPath, buffer);
      
      // Process the image with Tesseract OCR
      console.log('🔍 Running OCR on image...');
      const imageStartTime = Date.now();
      const text = await nodeTesseract.recognize(tempPath, config);
      const imageProcessingTime = Date.now() - imageStartTime;
      console.log(`✅ Image OCR completed in ${formatElapsedTime(imageProcessingTime)}`);
      
      results.push(text);
    }

    // Final progress update
    const totalTime = Date.now() - startTime;
    
    console.log('');
    console.log('='.repeat(50));
    console.log(`✅ OCR extraction completed for all ${totalImages} images!`);
    console.log(`⏱️  Total processing time: ${formatElapsedTime(totalTime)}`);
    console.log(`📊 Average time per image: ${formatElapsedTime(totalTime / totalImages)}`);
    console.log('='.repeat(50));
    console.log('');
    
    if (sessionId) {
      setProgress(sessionId, totalImages, totalImages);
      console.log(`📝 Saving session data for ID: ${sessionId}`);
      // Clear progress after a delay
      setTimeout(() => clearProgress(sessionId), 60000); // Clear after 1 minute
    }

    return results;
  } catch (error) {
    console.error('❌ Error during batch OCR processing:', error);
    
    // Clean up progress tracking in case of error
    if (sessionId) {
      clearProgress(sessionId);
    }
    
    throw new Error(`Batch OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 