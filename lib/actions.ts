"use server"

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import tesseract from 'node-tesseract-ocr'

// Add DeepSeek API client
import OpenAI from 'openai'
import { generateDocument } from './document-generator'

// Initialize the DeepSeek client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/v1',
});

// Tesseract OCR configuration
const tesseractConfig = {
  lang: "eng",
  oem: 1,  // Use LSTM OCR Engine
  psm: 3,  // Auto page segmentation with no OSD
  // Additional configuration for better accuracy
  tessjs_create_pdf: "0",
  tessjs_create_hocr: "0",
  tessjs_create_tsv: "0",
  tessjs_create_box: "0",
  tessjs_create_unlv: "0",
  tessjs_create_osd: "0",
  // Improve number recognition - removed problematic characters like quotes and brackets
  tessedit_char_whitelist: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$.,-%",
  preserve_interword_spaces: "1",
  tessedit_do_invert: "0"
}

// The prompt for DeepSeek Reasoner analysis
const ANALYSIS_PROMPT = `You are a luxury retail and duty-free sales expert. Analyze the following competitor's staff sales incentive data to help an LVMH brand compete effectively.

COMPETITOR DATA:
[EXTRACTED_TEXT]

OUTPUT REQUIREMENTS:

First, produce a table with the following:
1. Group data by incentive type and brand.
2. Include these columns:
   * Brand (name of the competitor brand)
   * Location of promotion (e.g., Terminal 1, Terminal 2, Terminal 3, Terminal 4, Wing, Arrival, etc.)
   * Eligible staff (e.g., GS BA, Shilla Payroll, GS, etc.)
   * Incentive type (e.g., Cash, Voucher, Product)
   * Incentive description (brief details of the incentive - list every permuation of the incentive)
   * List of all relevant SKUs or products tied to the incentive

Then, provide a list of recommendations & analysis with the following format:
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
* Format ONLY the table section using markdown with the | syntax for better document generation.
* For the recommendations and analysis section, use plain text without markdown formatting, don't use ** or other markdown formatting.
* Be very precise with numbers and currency values - double-check all numerical values for accuracy.`;

// Function to clean up OCR text, especially for numerical values
function cleanOcrText(text: string): string {
  // Replace common OCR errors for currency values
  let cleaned = text
    // Fix common OCR errors with dollar amounts
    .replace(/\$(\d+)O/g, '$10')  // $10 sometimes recognized as $1O
    .replace(/\$(\d+)o/g, '$10')  // $10 sometimes recognized as $1o
    .replace(/\$(\d+)l/g, '$1')   // $1 sometimes recognized as $l
    .replace(/\$l/g, '$1')        // $1 sometimes recognized as $l
    .replace(/\$I/g, '$1')        // $1 sometimes recognized as $I
    .replace(/\$(\d+)I/g, '$11')  // $11 sometimes recognized as $1I
    
    // Fix spacing issues
    .replace(/(\$\d+\.\d+)\s+/g, '$1 ')  // Normalize spacing after currency
    .replace(/\s{2,}/g, ' ');  // Replace multiple spaces with single space

  return cleaned;
}

// Function to perform OCR on an image using node-tesseract-ocr
async function performOCR(imagePath: string, imageName: string): Promise<string> {
  try {
    console.log(`Starting OCR for ${imageName}...`);
    
    // Perform OCR on the image
    let text = await tesseract.recognize(imagePath, tesseractConfig);
    
    // Clean up the OCR text
    text = cleanOcrText(text);
    
    console.log(`OCR completed for ${imageName}`);
    return text;
  } catch (error) {
    console.error(`OCR error for ${imageName}:`, error);
    return `Failed to extract text from ${imageName}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function uploadImages(formData: FormData) {
  try {
    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    // Create a unique session ID for this batch of uploads
    const sessionId = randomUUID();
    const sessionDir = join(uploadDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    
    // Process each file in the formData
    const files = [];
    const processingPromises = [];
    
    // First, save all files to disk (this is faster than processing them one by one)
    for (const [key, value] of formData.entries()) {
      // Check if the value is a file by checking for common file properties
      if (value && typeof value === 'object' && 'arrayBuffer' in value && 'name' in value && 'size' in value && 'type' in value) {
        const buffer = Buffer.from(await (value as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer());
        const filename = `${randomUUID()}-${(value as { name: string }).name}`;
        const filepath = join(sessionDir, filename);
        
        // Save the file
        await writeFile(filepath, buffer);
        const fileInfo = { name: (value as { name: string }).name, path: filepath };
        files.push(fileInfo);
        
        // Queue the OCR processing (don't await here)
        processingPromises.push(
          (async () => {
            try {
              const extractedText = await performOCR(filepath, fileInfo.name);
              const extractedTextPath = join(sessionDir, `${filename}-extracted.txt`);
              await writeFile(extractedTextPath, extractedText);
              return { name: fileInfo.name, text: extractedText };
            } catch (error: any) {
              console.error(`OCR error for ${fileInfo.name}:`, error);
              return { 
                name: fileInfo.name, 
                text: `Failed to extract text from ${fileInfo.name}: ${error.message}` 
              };
            }
          })()
        );
      }
    }
    
    // Process all images in parallel
    console.log(`Processing ${processingPromises.length} images in parallel...`);
    const extractedResults = await Promise.all(processingPromises);
    
    // Format the extracted texts
    const extractedTexts = extractedResults.map(result => 
      `## Image: ${result.name}\n\n${result.text}`
    );
    
    // Combine all extracted texts
    const combinedExtractedText = extractedTexts.join("\n\n---\n\n");
    
    // Save the combined extracted text
    const combinedExtractedTextPath = join(sessionDir, 'combined_extracted_text.txt');
    await writeFile(combinedExtractedTextPath, combinedExtractedText);
    
    // Generate the final analysis using DeepSeek Reasoner
    try {
      // Start document generation in parallel with analysis
      const analysisPromise = deepseek.chat.completions.create({
        model: "deepseek-reasoner",
        messages: [
          {
            role: "system",
            content: "You are a luxury retail and duty-free sales expert analyzing competitor data."
          },
          {
            role: "user",
            content: ANALYSIS_PROMPT.replace("[EXTRACTED_TEXT]", combinedExtractedText)
          }
        ],
        max_tokens: 4000,
      });
      
      // While waiting for the analysis, prepare the analysis data structure
      const analysisData = {
        timestamp: new Date().toISOString(),
        imageCount: files.length,
        analysis: "" // Will be filled after analysis completes
      };
      
      // Wait for analysis to complete
      const finalAnalysis = await analysisPromise;
      analysisData.analysis = finalAnalysis.choices[0]?.message?.content || "No analysis generated";
      
      // Save the analysis result
      const analysisPath = join(sessionDir, 'analysis.json');
      await writeFile(analysisPath, JSON.stringify(analysisData));
      
      // Generate Word document
      const docBuffer = await generateDocument(analysisData.analysis, sessionId, analysisData.imageCount);
      
      // Save the document to a file
      const docPath = join(sessionDir, 'analysis.docx');
      await writeFile(docPath, docBuffer);
      
      return { 
        success: true, 
        sessionId,
        analysisResult: analysisData.analysis,
        docPath
      };
    } catch (error: any) {
      console.error("Error generating analysis:", error);
      
      return {
        success: false,
        error: `Failed to generate analysis: ${error.message}`,
        extractedText: combinedExtractedText,
        sessionId
      };
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    throw new Error(`Failed to upload and process images: ${error.message}`);
  }
}

