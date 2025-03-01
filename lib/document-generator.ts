import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, HeadingLevel } from 'docx';
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
    
    // Create a simple document with minimal formatting
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "LVMH Competitor Analysis Report",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `Generated on: ${new Date(analysisData.timestamp).toLocaleString()}`,
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
              text: `Number of images analyzed: ${analysisData.imageCount}`,
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({}), // Empty paragraph as separator
            new Paragraph({
              text: analysis,
            }),
          ],
        },
      ],
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
 * @returns A Paragraph containing the table
 */
function createTable(headers: string[], rows: string[][]): Paragraph {
  // Create table rows
  const tableRows: TableRow[] = [];
  
  // Add header row
  tableRows.push(new TableRow({
    tableHeader: true,
    children: headers.map(header => 
      new TableCell({
        children: [new Paragraph({ 
          text: header,
          alignment: AlignmentType.CENTER,
        })],
        shading: {
          fill: "EEEEEE",
        },
      })
    ),
  }));
  
  // Add data rows
  rows.forEach(rowData => {
    tableRows.push(new TableRow({
      children: rowData.map(cell => 
        new TableCell({
          children: [new Paragraph({ text: cell })],
        })
      ),
    }));
  });
  
  // Create the table
  const table = new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "auto",
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "auto",
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "auto",
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "auto",
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "auto",
      },
      insideVertical: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "auto",
      },
    },
  });
  
  // Wrap the table in a paragraph
  return new Paragraph({
    children: [table],
  });
} 