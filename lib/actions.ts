"use server"

import { writeFile } from 'fs/promises'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'

// Add DeepSeek API client
import OpenAI from 'openai'
import { generateWordDocument } from './document-generator'

// Initialize the DeepSeek client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/v1',
});

// The prompt for DeepSeek R1
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
    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    // Create a unique session ID for this batch of uploads
    const sessionId = randomUUID();
    const sessionDir = join(uploadDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    
    // Process each file in the formData
    const files = [];
    const imageDescriptions = [];
    
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const filename = `${randomUUID()}-${value.name}`;
        const filepath = join(sessionDir, filename);
        
        // Save the file
        await writeFile(filepath, buffer);
        files.push({ name: value.name, path: filepath });
        
        // Get image description using DeepSeek's vision capabilities
        try {
          const response = await deepseek.chat.completions.create({
            model: "deepseek-reasoner",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract all text and structured data from this image about sales incentives and promotions. Include brand names, promotion details, incentive types, eligible staff, and any product SKUs." },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${value.type};base64,${buffer.toString('base64')}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 4000,
          });
          
          imageDescriptions.push(response.choices[0]?.message?.content || "No data extracted");
        } catch (error) {
          console.error("Error analyzing image with DeepSeek:", error);
          imageDescriptions.push(`Image: ${value.name} (Unable to extract text - please review manually)`);
        }
      }
    }
    
    // Combine all image descriptions and generate the final analysis
    const combinedData = imageDescriptions.join("\n\n");
    
    // Generate the final analysis using DeepSeek
    try {
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
      
      const analysisResult = finalAnalysis.choices[0]?.message?.content || "No analysis generated";
      
      // Save the analysis result
      const analysisData = {
        timestamp: new Date().toISOString(),
        imageCount: files.length,
        analysis: analysisResult
      };
      
      const analysisPath = join(sessionDir, 'analysis.json');
      await writeFile(analysisPath, JSON.stringify(analysisData));
      
      // Generate Word document
      const docPath = await generateWordDocument(sessionId, analysisData);
      
      return { 
        success: true, 
        sessionId,
        analysisResult,
        docPath
      };
    } catch (error: any) {
      console.error("Error generating analysis:", error);
      
      // Fallback to returning just the extracted data
      return {
        success: false,
        error: `Failed to generate analysis: ${error.message}`,
        extractedData: combinedData,
        sessionId
      };
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    throw new Error(`Failed to upload and process images: ${error.message}`);
  }
}

