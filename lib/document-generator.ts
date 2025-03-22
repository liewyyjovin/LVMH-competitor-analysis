import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, HeadingLevel, convertInchesToTwip, LevelFormat, UnderlineType } from 'docx';
import { writeFile, readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';
import * as fs from 'fs';

interface AnalysisData {
  timestamp: string;
  imageCount: number;
  analysis: string;
}

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
 * Convert image to base64 for embedding in HTML
 * @param file Path to the image file
 * @returns Promise with base64 data URL
 */
function imageToBase64(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(file, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const ext = extname(file).slice(1).toLowerCase();
        resolve(`data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data.toString('base64')}`);
      }
    });
  });
}

/**
 * Generates a Word document from the analysis result
 * @param sessionId The session ID
 * @param analysisData The analysis data
 * @returns The path to the generated document
 */
export async function generateWordDocument(sessionId: string, analysisData: AnalysisData): Promise<string> {
  try {
    console.log('');
    console.log('='.repeat(50));
    console.log('📝 STARTING DOCUMENT GENERATION');
    console.log('='.repeat(50));
    console.log(`📊 Session ID: ${sessionId}`);
    console.log(`📊 Images analyzed: ${analysisData.imageCount}`);
    console.log(`📊 Timestamp: ${analysisData.timestamp}`);
    console.log('');
    
    const startTime = Date.now();
    console.log('🔍 Parsing analysis content...');
    
    // Parse the analysis content
    const { analysis } = analysisData;
    
    // Split the content into sections
    const lines = analysis.split('\n');
    console.log(`📊 Analysis content: ${lines.length} lines`);
    const children = [];
    
    console.log('📄 Creating document structure...');
    
    // Add title and header
    children.push(
      new Paragraph({
        text: "LVMH Competitor Analysis Report",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 400,
        },
        border: {
          bottom: {
            color: "3366CC",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Add metadata
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated on: ${new Date(analysisData.timestamp).toLocaleString()}`,
            size: 20,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          after: 200,
        },
      })
    );
    
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Number of images analyzed: ${analysisData.imageCount}`,
            size: 20,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: {
          after: 400,
        },
      })
    );
    
    // Process the content
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    
    console.log('🔍 Processing content structure...');
    
    let headingCount = 0;
    let subheadingCount = 0;
    let paragraphCount = 0;
    let tableCount = 0;
    let bulletPointCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('# ')) {
        // Main heading
        headingCount++;
        children.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200,
            },
          })
        );
      } else if (line.startsWith('## ')) {
        // Subheading
        subheadingCount++;
        children.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
            spacing: {
              before: 300,
              after: 200,
            },
          })
        );
      } else if (line.startsWith('### ')) {
        // Sub-subheading
        subheadingCount++;
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.substring(4),
                bold: true,
                size: 24,
              }),
            ],
            spacing: {
              before: 200,
              after: 100,
            },
          })
        );
      } else if (line.startsWith('|') && line.endsWith('|')) {
        // Table row
        if (!inTable) {
          inTable = true;
          tableCount++;
          console.log(`📊 Processing table #${tableCount}...`);
          // Extract headers
          tableHeaders = line
            .split('|')
            .filter(cell => cell.trim() !== '')
            .map(cell => cell.trim());
        } else if (line.includes('---')) {
          // Separator row, skip
          continue;
        } else {
          // Data row
          const rowData = line
            .split('|')
            .filter(cell => cell.trim() !== '')
            .map(cell => cell.trim());
          
          tableRows.push(rowData);
        }
      } else if (inTable && !line.startsWith('|')) {
        // End of table
        inTable = false;
        
        if (tableHeaders.length > 0 && tableRows.length > 0) {
          // Create table
          console.log(`📊 Creating table with ${tableRows.length} rows and ${tableHeaders.length} columns`);
          const table = createTable(tableHeaders, tableRows);
          children.push(table);
          
          // Reset table data
          tableHeaders = [];
          tableRows = [];
        }
        
        // Process the current line if not empty
        if (line) {
          paragraphCount++;
          children.push(createParagraphFromLine(line));
        }
      } else if (line.startsWith('- ')) {
        // Bullet point
        bulletPointCount++;
        children.push(
          new Paragraph({
            text: line.substring(2),
            bullet: {
              level: 0,
            },
            spacing: {
              before: 100,
              after: 100,
            },
          })
        );
      } else if (line.startsWith('  - ') || line.startsWith('    - ')) {
        // Nested bullet point
        bulletPointCount++;
        const level = line.startsWith('    - ') ? 2 : 1;
        const text = line.startsWith('    - ') ? line.substring(6) : line.substring(4);
        
        children.push(
          new Paragraph({
            text: text,
            bullet: {
              level: level,
            },
            spacing: {
              before: 100,
              after: 100,
            },
          })
        );
      } else if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) {
        // Numbered list
        bulletPointCount++;
        const match = line.match(/^(\d+)\.\s+(.*)$/);
        if (match) {
          const number = parseInt(match[1]);
          const text = match[2];
          
          children.push(
            new Paragraph({
              text: text,
              numbering: {
                reference: 'default-numbering',
                level: 0,
              },
              spacing: {
                before: 100,
                after: 100,
              },
            })
          );
        }
      } else if (line === '') {
        // Empty line - add spacing
        children.push(
          new Paragraph({
            spacing: {
              before: 120,
              after: 120,
            },
          })
        );
      } else {
        // Regular paragraph
        paragraphCount++;
        children.push(createParagraphFromLine(line));
      }
    }
    
    // If we're still in a table at the end, add it
    if (inTable && tableHeaders.length > 0 && tableRows.length > 0) {
      console.log(`📊 Creating final table with ${tableRows.length} rows and ${tableHeaders.length} columns`);
      const table = createTable(tableHeaders, tableRows);
      children.push(table);
    }
    
    // Log document structure summary
    console.log('');
    console.log('📊 Document Structure Summary:');
    console.log(`📊 Main Headings: ${headingCount}`);
    console.log(`📊 Subheadings: ${subheadingCount}`);
    console.log(`📊 Paragraphs: ${paragraphCount}`);
    console.log(`📊 Tables: ${tableCount}`);
    console.log(`📊 Bullet Points: ${bulletPointCount}`);
    console.log('');
    
    console.log('📄 Creating final document...');
    
    // Add a section for image references with page break
    children.push(
      new Paragraph({
        text: "Source Images for Reference",
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: {
          before: 400,
          after: 200,
        },
      })
    );
    
    // Add a note about the images
    children.push(
      new Paragraph({
        text: "The following images were used as source data for this analysis. An HTML file with all images is included in the download ZIP file for better viewing.",
        spacing: {
          before: 200,
          after: 400,
        },
      })
    );
    
    // Get list of image files in the session directory
    const uploadsDir = join(process.cwd(), 'uploads', sessionId);
    console.log(`🔍 Looking for source images in: ${uploadsDir}`);
    
    try {
      // Find all files that might be images in the session directory
      const sessionFiles = await readdir(uploadsDir);
      const imageFiles = sessionFiles.filter(file => {
        const ext = file.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext || '');
      });
      
      console.log(`📊 Found ${imageFiles.length} image files for reference`);
      
      // Create HTML file with embedded images
      let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LVMH Competitor Analysis - Source Images</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #000080;
      border-bottom: 2px solid #000080;
      padding-bottom: 10px;
    }
    h2 {
      color: #333;
      margin-top: 40px;
    }
    img {
      max-width: 100%;
      height: auto;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
      display: block;
    }
    .image-container {
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .timestamp {
      color: #666;
      font-size: 0.9em;
      text-align: right;
    }
  </style>
</head>
<body>
  <h1>LVMH Competitor Analysis - Source Images</h1>
  <p class="timestamp">Generated on: ${new Date(analysisData.timestamp).toLocaleString()}</p>
  <p>The following ${imageFiles.length} images were analyzed to generate the competitor analysis report.</p>`;
      
      // Add each image to the HTML content
      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const imagePath = join(uploadsDir, imageFile);
        
        try {
          console.log(`📷 Processing image for HTML: ${imageFile}`);
          const base64Image = await imageToBase64(imagePath);
          
          htmlContent += `
  <div class="image-container">
    <h2>Image ${i + 1}: ${imageFile}</h2>
    <img src="${base64Image}" alt="${imageFile}" />
  </div>`;
        } catch (error: any) {
          console.error(`❌ Error processing image ${imageFile}:`, error);
          htmlContent += `
  <div class="image-container">
    <h2>Image ${i + 1}: ${imageFile}</h2>
    <p>Error embedding image: ${error?.message || 'Unknown error'}</p>
  </div>`;
        }
        
        // Add image title/note to the Word document
        children.push(
          new Paragraph({
            text: `Image ${i + 1}: ${imageFile}`,
            heading: HeadingLevel.HEADING_3,
            spacing: {
              before: 300,
              after: 200,
            },
          })
        );
        
        // Add note about viewing the image in the HTML file
        children.push(
          new Paragraph({
            text: `This image is available in the Source_Images.html file included in the ZIP download.`,
            spacing: {
              before: 100,
              after: 300,
            },
          })
        );
      }
      
      // Finalize HTML content
      htmlContent += `
</body>
</html>`;
      
      // Save the HTML file
      const htmlPath = join(uploadsDir, 'embedded_images.html');
      console.log(`💾 Writing HTML file with embedded images to: ${htmlPath}`);
      await writeFile(htmlPath, htmlContent);
      
      // Add note about the HTML file to the DOCX
      children.push(
        new Paragraph({
          text: `A complete HTML file with all source images is included in the download ZIP file.`,
          spacing: {
            before: 200,
            after: 200,
          },
        })
      );
    } catch (error: any) {
      console.error('❌ Error processing images directory:', error);
      children.push(
        new Paragraph({
          text: `Could not process source images: ${error?.message || 'Unknown error'}`,
          spacing: {
            before: 200,
            after: 400,
          },
        })
      );
    }
    
    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          children: children,
        },
      ],
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
              {
                level: 1,
                format: LevelFormat.LOWER_LETTER,
                text: '%2.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
              {
                level: 2,
                format: LevelFormat.LOWER_ROMAN,
                text: '%3.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
            ],
          },
        ],
      },
    });
    
    // Create directory for the session
    const docDir = join(process.cwd(), 'uploads', sessionId);
    const docPath = join(docDir, 'analysis.docx');
    
    console.log(`💾 Packing document to: ${docPath}`);
    
    // Generate document
    const buffer = await Packer.toBuffer(doc);
    
    // Save document
    await writeFile(docPath, buffer);
    
    const endTime = Date.now();
    console.log('');
    console.log('='.repeat(50));
    console.log(`✅ Document generation completed in ${formatElapsedTime(endTime - startTime)}`);
    console.log(`📄 Document saved to: ${docPath}`);
    console.log('='.repeat(50));
    console.log('');
    
    return docPath;
  } catch (error) {
    console.error('❌ Error generating document:', error);
    throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Creates a table from headers and rows
 * @param headers The table headers
 * @param rows The table rows
 * @returns A formatted Table
 */
function createTable(headers: string[], rows: string[][]): Table {
  // Create table rows
  const tableRows = [];
  
  // Add header row
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: headers.map(header => 
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: header,
                  bold: true,
                  size: 22,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: {
            fill: "D0E0F5",
          },
          verticalAlign: AlignmentType.CENTER,
        })
      ),
      height: {
        value: 400,
        rule: 'atLeast',
      },
    })
  );
  
  // Add data rows
  rows.forEach((rowData, rowIndex) => {
    tableRows.push(
      new TableRow({
        children: rowData.map(cell => 
          new TableCell({
            children: [
              new Paragraph({
                text: cell,
                spacing: {
                  before: 50,
                  after: 50,
                },
              }),
            ],
            shading: {
              fill: rowIndex % 2 === 0 ? "FFFFFF" : "F5F5F5",
            },
          })
        ),
      })
    );
  });
  
  // Create the table
  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "888888",
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "888888",
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "888888",
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "888888",
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "AAAAAA",
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "AAAAAA",
      },
    },
    margins: {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
    },
  });
}

/**
 * Creates a paragraph from a line of text with improved formatting
 * @param line The line of text
 * @returns A formatted Paragraph
 */
function createParagraphFromLine(line: string): Paragraph {
  // Process text with formatting markers first
  if (line.includes('**') || line.includes('__')) {
    // Handle bold text by separating into segments
    const parts = [];
    let currentText = '';
    let isBold = false;
    
    for (let i = 0; i < line.length; i++) {
      if (i < line.length - 1 && line.substr(i, 2) === '**') {
        // Push current text with current state
        if (currentText) {
          parts.push(new TextRun({
            text: currentText,
            bold: isBold,
          }));
          currentText = '';
        }
        
        // Toggle bold state
        isBold = !isBold;
        i++; // Skip the second *
      } else {
        currentText += line[i];
      }
    }
    
    // Add any remaining text
    if (currentText) {
      parts.push(new TextRun({
        text: currentText,
        bold: isBold,
      }));
    }
    
    return new Paragraph({
      children: parts,
      spacing: {
        before: 120,
        after: 120,
      },
    });
  } else {
    // Regular paragraph
    return new Paragraph({
      text: line,
      spacing: {
        before: 120,
        after: 120,
      },
    });
  }
}