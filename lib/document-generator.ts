import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ImageRun,
  Packer,
  convertInchesToTwip,
  LevelFormat,
  UnderlineType
} from "docx";
import { join } from "path";
import * as path from "path";
import { writeFile, readFile, readdir } from "fs/promises";
import * as fs from "fs";

interface AnalysisData {
  analysis: string;
  timestamp: number;
  imageCount: number;
}

/**
 * Generates a Word document from the analysis content
 * @param content The analysis content
 * @param sessionId The session ID
 * @param imageCount The number of images analyzed
 * @returns A buffer containing the Word document
 */
export async function generateDocument(
  content: string,
  sessionId: string,
  imageCount: number
): Promise<Buffer> {
  // Start image appendix processing in parallel
  let appendixPromise: Promise<Paragraph[]> | null = null;
  if (sessionId) {
    appendixPromise = createImageAppendix(sessionId);
  }
  
  // Process content in a more efficient way
  const { recommendationsParagraphs, tableParagraphs } = await processContent(content);
  
  // Prepare all document elements
  const documentElements: (Paragraph | Table)[] = [
    // Title and header are pre-computed for efficiency
    createDocumentTitle(),
    createDocumentHeader(imageCount)
  ];
  
  // Add recommendations section if available
  if (recommendationsParagraphs.length > 0) {
    documentElements.push(
      new Paragraph({
        text: "Recommendations & Analysis",
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: 400,
          after: 200,
        },
        border: {
          bottom: {
            color: "auto",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Add all recommendation paragraphs
    documentElements.push(...recommendationsParagraphs);
  }
  
  // Add table section if available
  if (tableParagraphs.length > 0) {
    documentElements.push(
      new Paragraph({
        text: "Detailed Analysis Table",
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: 400,
          after: 200,
        },
        border: {
          bottom: {
            color: "auto",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Add all table paragraphs
    documentElements.push(...tableParagraphs);
  }
  
  // Add image appendix if available
  if (appendixPromise) {
    try {
      const appendixParagraphs = await appendixPromise;
      
      if (appendixParagraphs.length > 0) {
        // Add appendix header with page break
        documentElements.push(
          new Paragraph({
            text: "Image Appendix",
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: true,
            spacing: {
              before: 400,
              after: 200,
            },
            border: {
              bottom: {
                color: "auto",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
          })
        );
        
        // Add all appendix paragraphs
        documentElements.push(...appendixParagraphs);
      }
    } catch (error) {
      console.error("Error creating image appendix:", error);
      // Add error message
      documentElements.push(
        new Paragraph({
          text: "Error loading image appendix",
          spacing: {
            before: 200,
            after: 200,
          },
        })
      );
    }
  }
  
  // Create the document with all elements
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: documentElements
      }
    ]
  });
  
  // Generate document buffer
  return await Packer.toBuffer(doc);
}

/**
 * Creates the title header for the document
 * @returns A formatted Paragraph for the title
 */
function createTitleHeader(): Paragraph {
  return new Paragraph({
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
  });
}

/**
 * Creates a document with the given content
 * @param children The document content
 * @returns A Document object
 */
function createDocumentWithContent(children: any[]): Document {
  return new Document({
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
          ],
        },
      ],
    },
  });
}

/**
 * Creates an appendix document with the given content
 * @param children The appendix content
 * @returns A Document object
 */
function createAppendixDocument(appendixChildren: any[]): Document {
  const children = [
    new Paragraph({
      text: "Appendix: Analyzed Images",
      heading: HeadingLevel.HEADING_1,
      spacing: {
        before: 400,
        after: 200,
      },
    }),
    ...appendixChildren
  ];
  
  return createDocumentWithContent(children);
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
 * Creates a paragraph from a line of text with formatting
 * @param line The line of text
 * @returns A formatted Paragraph
 */
function createParagraphFromLine(line: string): Paragraph {
  // Check if the line is part of the recommendations section
  if (line.match(/^(\d+)\.\s+(Which|What|How)/)) {
    // This is a recommendation heading - make it bold but don't parse markdown
    return new Paragraph({
      children: [
        new TextRun({
          text: line,
          bold: true,
          size: 24,
        }),
      ],
      spacing: {
        before: 200,
        after: 120,
      },
    });
  }
  
  // Check for special formatting in other sections
  if (line.includes('**') || line.includes('__')) {
    // Handle bold text
    const parts = line.split(/(\*\*.*?\*\*|__.*?__)/g);
    const textRuns = parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({
          text: part.substring(2, part.length - 2),
          bold: true,
        });
      } else if (part.startsWith('__') && part.endsWith('__')) {
        return new TextRun({
          text: part.substring(2, part.length - 2),
          bold: true,
          underline: {
            type: UnderlineType.SINGLE,
          },
        });
      } else {
        return new TextRun({
          text: part,
        });
      }
    });
    
    return new Paragraph({
      children: textRuns,
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

/**
 * Creates an image appendix with all images from the session
 * @param sessionId The session ID
 * @returns An array of paragraphs and images for the appendix
 */
async function createImageAppendix(sessionId: string): Promise<Paragraph[]> {
  const appendixChildren: Paragraph[] = [];
  const sessionDir = join(process.cwd(), 'uploads', sessionId);
  
  try {
    // Find all files in the session directory
    const files = await readdir(sessionDir);
    
    // Filter image files more efficiently
    const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);
    const imageFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.has(ext) && file.includes('-');
      })
      .map(file => join(sessionDir, file));
    
    // Sort image files by name
    imageFiles.sort();
    
    // Process images in batches to avoid memory issues
    const BATCH_SIZE = 3; // Process 3 images at a time
    
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
      const batch = imageFiles.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (imagePath) => {
        try {
          // Get the original filename from the UUID-filename pattern
          const filename = path.basename(imagePath);
          const filenameMatch = filename.match(/([^\/]+)-([^\/]+\.(jpg|jpeg|png|gif|bmp|webp))$/i);
          const originalFilename = filenameMatch ? filenameMatch[2] : filename;
          
          // Read the image file
          const imageBuffer = await readFile(imagePath);
          
          // For Word documents, we need to set dimensions but want to maintain quality
          // We'll use page width (6 inches at 96 DPI) and proportional height
          // This gives high quality while ensuring images fit on the page
          
          // Return the title and image paragraphs
          return [
            new Paragraph({
              text: originalFilename,
              heading: HeadingLevel.HEADING_3,
              spacing: {
                before: 300,
                after: 100,
              },
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 550, // ~5.7 inches at 96 DPI (fits within margins)
                    height: 550, // Same as width, but the image will maintain aspect ratio
                  },
                  type: "png",
                }),
              ],
              spacing: {
                before: 100,
                after: 300,
              },
            })
          ];
        } catch (error) {
          console.error(`Error processing image ${imagePath}:`, error);
          // Return error message instead of the image
          return [
            new Paragraph({
              text: `Error loading image: ${path.basename(imagePath)}`,
              spacing: {
                before: 100,
                after: 100,
              },
            })
          ];
        }
      });
      
      // Process batch in parallel
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten and add to appendix
      for (const paragraphs of batchResults) {
        appendixChildren.push(...paragraphs);
      }
    }
  } catch (error) {
    console.error("Error finding images:", error);
    throw error;
  }
  
  return appendixChildren;
}

/**
 * Processes the content to extract recommendations and table sections
 * @param content The analysis content
 * @returns An object containing recommendations and table paragraphs
 */
async function processContent(content: string): Promise<{
  recommendationsParagraphs: Paragraph[];
  tableParagraphs: (Paragraph | Table)[];
}> {
  const recommendationsParagraphs: Paragraph[] = [];
  const tableParagraphs: (Paragraph | Table)[] = [];
  
  // Split content by lines for processing
  const lines = content.split('\n');
  
  // First pass: identify sections and process content
  let currentSection: 'recommendations' | 'table' | null = null;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let tableHeaderLine = '';
  
  // Batch processing for paragraphs
  const processParagraphBatch = (paragraphs: string[], targetArray: Paragraph[]) => {
    if (paragraphs.length === 0) return;
    
    // Process paragraphs in batches
    const batchParagraphs = paragraphs.map(line => createParagraphFromLine(line));
    targetArray.push(...batchParagraphs);
  };
  
  let recommendationsBatch: string[] = [];
  let tableBatch: string[] = [];
  const BATCH_SIZE = 10;
  
  // Process each line to identify sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check for section headers
    if (line.includes('Recommendations') || line.includes('Analysis:')) {
      // Process any pending batches before changing section
      processParagraphBatch(recommendationsBatch, recommendationsParagraphs);
      processParagraphBatch(tableBatch, tableParagraphs as Paragraph[]);
      recommendationsBatch = [];
      tableBatch = [];
      
      currentSection = 'recommendations';
      continue;
    }
    
    // Check for table markers
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        // Process any pending batches before entering table
        processParagraphBatch(recommendationsBatch, recommendationsParagraphs);
        processParagraphBatch(tableBatch, tableParagraphs as Paragraph[]);
        recommendationsBatch = [];
        tableBatch = [];
        
        inTable = true;
        currentSection = 'table';
        tableHeaderLine = line;
      } else if (line.includes('---')) {
        // This is the separator line, skip it
        continue;
      } else {
        // This is a table row
        const rowCells = line
          .split('|')
          .filter(cell => cell.trim() !== '')
          .map(cell => cell.trim());
        
        if (rowCells.length > 0) {
          tableRows.push(rowCells);
        }
      }
      continue;
    } else if (inTable) {
      // We've exited the table
      inTable = false;
      
      // Process the table header
      tableHeaders = tableHeaderLine
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim());
      
      // Create and add the table
      if (tableHeaders.length > 0 && tableRows.length > 0) {
        tableParagraphs.push(createTable(tableHeaders, tableRows));
        
        // Reset table data
        tableHeaders = [];
        tableRows = [];
        tableHeaderLine = '';
      }
    }
    
    // Process regular content based on current section
    if (currentSection === 'recommendations') {
      recommendationsBatch.push(line);
      if (recommendationsBatch.length >= BATCH_SIZE) {
        processParagraphBatch(recommendationsBatch, recommendationsParagraphs);
        recommendationsBatch = [];
      }
    } else if (currentSection === 'table' && !inTable) {
      tableBatch.push(line);
      if (tableBatch.length >= BATCH_SIZE) {
        processParagraphBatch(tableBatch, tableParagraphs as Paragraph[]);
        tableBatch = [];
      }
    }
  }
  
  // Process any remaining batches
  processParagraphBatch(recommendationsBatch, recommendationsParagraphs);
  processParagraphBatch(tableBatch, tableParagraphs as Paragraph[]);
  
  // Process any remaining table
  if (inTable && tableHeaderLine && tableRows.length > 0) {
    tableHeaders = tableHeaderLine
      .split('|')
      .filter(cell => cell.trim() !== '')
      .map(cell => cell.trim());
    
    if (tableHeaders.length > 0) {
      tableParagraphs.push(createTable(tableHeaders, tableRows));
    }
  }
  
  return {
    recommendationsParagraphs,
    tableParagraphs,
  };
}

/**
 * Creates the document title
 * @returns A paragraph with the document title
 */
function createDocumentTitle(): Paragraph {
  return new Paragraph({
    text: "LVMH Competitor Analysis",
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: {
      after: 200,
    },
  });
}

/**
 * Creates the document header with metadata
 * @param imageCount The number of images analyzed
 * @returns A paragraph with the document header
 */
function createDocumentHeader(imageCount: number): Paragraph {
  const now = new Date();
  const formattedDate = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  
  return new Paragraph({
    text: `Generated on ${formattedDate} | ${imageCount} image${imageCount !== 1 ? 's' : ''} analyzed`,
    spacing: {
      before: 100,
      after: 400,
    },
    border: {
      bottom: {
        color: "auto",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
  });
} 