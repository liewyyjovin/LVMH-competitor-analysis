"use server"

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'

// Add DeepSeek API client
import OpenAI from 'openai'
import { generateWordDocument } from './document-generator'
import { processMultipleImages } from './tesseract-service'

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

// Initialize the DeepSeek client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/v1',
});

// The prompt for DeepSeek Reasoner
const ANALYSIS_PROMPT = `You are a luxury retail and duty-free sales expert. Analyze the following competitor's staff sales incentive data to help an LVMH brand compete effectively. 

COMPETITOR DATA:
[Structured data extracted from images provided by the user]

OUTPUT REQUIREMENTS:
Produce a table with the following:
1. Group data by incentive type and brand.
2. Include these columns:
    * Brand (name of the competitor brand)
    * Location of promotion (e.g., Terminal 1, Terminal 2, Terminal 3, Terminal 4, Wing, Arrival, etc.)
    * Eligible staff (e.g., GS BA, Shilla Payroll, GS, etc.)
    * Incentive type (e.g., Cash, Voucher, Product)
    * Incentive description (brief details of the incentive)
    * List of all relevant SKUs or products tied to the incentive

After producing the table, come up with a list of recommendations & analysis with the following format:
1. Which are the top 3 most attractive incentives across all brands?
2. What are the top 3 best strategies to compete against the top incentives?
3. How do make sure these 3 strategies are easy to explain and convincing for general sales staff to choose against the other incentives?

DATA RULES:
1. Classify incentive types as: cash, voucher, product, or other identifiable types from the data.
2. Sort the table by brand name alphabetically (A-Z).
3. Ensure each row represents a unique incentive type per brand (no duplicate incentive types within the same brand).

ADDITIONAL INSTRUCTIONS:
* If the data is incomplete or unclear, make reasonable assumptions based on luxury retail norms and note them.
* If SKUs/products are not explicitly listed, infer relevant product categories from the context where possible.
* Format your response using markdown, with tables using the | syntax for better document generation.`;

export async function uploadImages(formData: FormData) {
  try {
    console.log('');
    console.log('='.repeat(60));
    console.log('🚀 STARTING NEW COMPETITOR ANALYSIS SESSION');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    // Create uploads directory if it doesn't exist
    console.log('📁 Setting up directories...');
    const uploadDir = join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    // Create a unique session ID for this batch of uploads
    const sessionId = randomUUID();
    console.log(`📊 Session ID: ${sessionId}`);
    
    const sessionDir = join(uploadDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    console.log(`📁 Created session directory: ${sessionDir}`);
    
    // Process each file in the formData
    const files = [];
    const imageBuffers: Buffer[] = [];
    const fileNames: string[] = [];
    
    console.log('🔍 Reading uploaded files...');
    
    // First, collect all image files and buffers
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const filename = `${randomUUID()}-${value.name}`;
        const filepath = join(sessionDir, filename);
        
        console.log(`📄 Processing file: ${value.name} (${Math.round(buffer.length / 1024)} KB)`);
        
        // Save the file
        await writeFile(filepath, buffer);
        files.push({ name: value.name, path: filepath });
        
        // Store buffer for OCR processing
        imageBuffers.push(buffer);
        fileNames.push(value.name);
      }
    }
    
    console.log(`📊 Total files: ${files.length}`);
    
    // Process all images with Tesseract OCR
    console.log('');
    console.log('='.repeat(60));
    console.log(`🔍 STARTING OCR PROCESSING PHASE (${imageBuffers.length} images)`);
    console.log('='.repeat(60));
    
    const ocrStartTime = Date.now();
    const extractedTexts = await processMultipleImages(imageBuffers, sessionId);
    const ocrEndTime = Date.now();
    
    console.log(`⏱️  OCR processing completed in ${formatElapsedTime(ocrEndTime - ocrStartTime)}`);
    
    // Format the extracted texts
    console.log('📝 Formatting extracted text data...');
    const combinedData = extractedTexts.map((text, index) => {
      return `## Image: ${fileNames[index]}\n\n${text.trim()}`;
    }).join("\n\n---\n\n");
    
    // Save the extracted data
    const extractedDataPath = join(sessionDir, 'extracted_data.txt');
    await writeFile(extractedDataPath, combinedData);
    console.log(`💾 Extracted text data saved to: ${extractedDataPath}`);
    
    // Generate the final analysis using DeepSeek
    console.log('');
    console.log('='.repeat(60));
    console.log('🧠 STARTING AI ANALYSIS PHASE');
    console.log('='.repeat(60));
    
    try {
      console.log('🧠 Sending data to DeepSeek AI for analysis...');
      const analysisStartTime = Date.now();
      
      const finalAnalysis = await deepseek.chat.completions.create({
        model: "deepseek-reasoner",
        messages: [
          {
            role: "user",
            content: ANALYSIS_PROMPT.replace("[Structured data extracted from images provided by the user]", combinedData)
          }
        ],
        max_tokens: 4000,
      });
      
      const analysisEndTime = Date.now();
      console.log(`⏱️  AI analysis completed in ${formatElapsedTime(analysisEndTime - analysisStartTime)}`);
      
      const analysisResult = finalAnalysis.choices[0]?.message?.content || "No analysis generated";
      console.log('✅ Analysis successfully generated');
      
      // Save the analysis result
      const analysisData = {
        timestamp: new Date().toISOString(),
        imageCount: files.length,
        analysis: analysisResult
      };
      
      console.log('💾 Saving analysis results...');
      const analysisPath = join(sessionDir, 'analysis.json');
      await writeFile(analysisPath, JSON.stringify(analysisData));
      console.log(`💾 Analysis saved to: ${analysisPath}`);
      
      // Generate Word document
      console.log('');
      console.log('='.repeat(60));
      console.log('📄 STARTING DOCUMENT GENERATION PHASE');
      console.log('='.repeat(60));
      
      const docPath = await generateWordDocument(sessionId, analysisData);
      
      const completionTime = Date.now();
      const totalProcessingTime = completionTime - startTime;
      
      console.log('');
      console.log('='.repeat(60));
      console.log('✅ PROCESS COMPLETED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log(`⏱️  Total processing time: ${formatElapsedTime(totalProcessingTime)}`);
      console.log(`📊 Images processed: ${files.length}`);
      console.log(`📄 Final document: ${docPath}`);
      console.log('='.repeat(60));
      console.log('');
      
      return { 
        success: true, 
        sessionId,
        analysisResult,
        docPath,
        processingTimeMs: totalProcessingTime
      };
    } catch (error: any) {
      console.error('❌ Error generating analysis:', error);
      
      // Fallback to returning just the extracted data
      return {
        success: false,
        error: `Failed to generate analysis: ${error.message}`,
        extractedData: combinedData,
        sessionId
      };
    }
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    throw new Error(`Failed to upload and process images: ${error.message}`);
  }
}

