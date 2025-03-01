import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, HeadingLevel, convertInchesToTwip, LevelFormat, UnderlineType } from 'docx';
import { writeFile } from 'fs/promises';
import { join } from 'path';

interface AnalysisData {
  timestamp: string;
  imageCount: number;
  analysis: string;
}

/**
 * Generates a Word document from the analysis result
 * @param sessionId The session ID
 * @param analysisData The analysis data
 * @returns The path to the generated document
 */
export async function generateWordDocument(sessionId: string, analysisData: AnalysisData): Promise<string> {
  try {
    // Parse the analysis content
    const { analysis } = analysisData;
    
    // Split the content into sections
    const lines = analysis.split('\n');
    const children = [];
    
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
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('# ')) {
        // Main heading
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
          const table = createTable(tableHeaders, tableRows);
          children.push(table);
          
          // Reset table data
          tableHeaders = [];
          tableRows = [];
        }
        
        // Process the current line if not empty
        if (line) {
          children.push(createParagraphFromLine(line));
        }
      } else if (line.startsWith('- ')) {
        // Bullet point
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
        children.push(createParagraphFromLine(line));
      }
    }
    
    // If we're still in a table at the end, add it
    if (inTable && tableHeaders.length > 0 && tableRows.length > 0) {
      const table = createTable(tableHeaders, tableRows);
      children.push(table);
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
            ],
          },
        ],
      },
    });
    
    // Generate the document
    const buffer = await Packer.toBuffer(doc);
    
    // Save the document
    const docPath = join(process.cwd(), 'uploads', sessionId, 'analysis.docx');
    await writeFile(docPath, buffer);
    
    return docPath;
  } catch (error: any) {
    console.error("Error generating document:", error);
    throw new Error(`Failed to generate document: ${error.message}`);
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
 * Creates a paragraph from a line of text with formatting
 * @param line The line of text
 * @returns A formatted Paragraph
 */
function createParagraphFromLine(line: string): Paragraph {
  // Check for special formatting
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