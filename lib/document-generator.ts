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
  // Parse the analysis content
  const { analysis } = analysisData;
  
  // Create sections for the document
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "LVMH Competitor Analysis Report",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      text: `Generated on: ${new Date(analysisData.timestamp).toLocaleString()}`,
      alignment: AlignmentType.RIGHT,
    })
  );
  
  children.push(
    new Paragraph({
      text: `Number of images analyzed: ${analysisData.imageCount}`,
      alignment: AlignmentType.RIGHT,
    })
  );

  // Separator
  children.push(new Paragraph({}));

  // Process the analysis content
  // We'll split the content into sections based on markdown-like formatting
  const lines = analysis.split('\n');
  let currentSection = '';
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a heading
    if (line.startsWith('# ')) {
      // Add a new heading
      children.push(
        new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
        })
      );
    } else if (line.startsWith('## ')) {
      // Add a new subheading
      children.push(
        new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
        })
      );
    } else if (line.startsWith('|') && line.endsWith('|')) {
      // This is a table row
      if (!inTable) {
        inTable = true;
        // This is the header row
        tableHeaders = line
          .split('|')
          .filter(cell => cell.trim() !== '')
          .map(cell => cell.trim());
      } else if (line.includes('---')) {
        // This is the separator row, skip it
        continue;
      } else {
        // This is a data row
        const rowData = line
          .split('|')
          .filter(cell => cell.trim() !== '')
          .map(cell => cell.trim());
        
        tableRows.push(rowData);
      }
    } else if (inTable && !line.startsWith('|')) {
      // End of table
      inTable = false;
      
      // Create the table
      if (tableHeaders.length > 0 && tableRows.length > 0) {
        const table = createTable(tableHeaders, tableRows);
        children.push(table);
        
        // Reset table data
        tableHeaders = [];
        tableRows = [];
      }
      
      // Add the current line if it's not empty
      if (line) {
        children.push(new Paragraph({ text: line }));
      }
    } else if (line.startsWith('- ')) {
      // Bullet point
      children.push(
        new Paragraph({
          text: line.substring(2),
          bullet: {
            level: 0
          }
        })
      );
    } else if (line.startsWith('  - ')) {
      // Nested bullet point
      children.push(
        new Paragraph({
          text: line.substring(4),
          bullet: {
            level: 1
          }
        })
      );
    } else if (line) {
      // Regular paragraph
      children.push(new Paragraph({ text: line }));
    } else {
      // Empty line
      children.push(new Paragraph({}));
    }
  }
  
  // If we're still in a table at the end, add it
  if (inTable && tableHeaders.length > 0 && tableRows.length > 0) {
    const table = createTable(tableHeaders, tableRows);
    children.push(table);
  }

  // Create a new document
  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }],
    styles: {
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 28,
            bold: true,
            color: "2E5A88"
          },
          paragraph: {
            spacing: {
              after: 120,
            },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 24,
            bold: true,
            color: "2E5A88"
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120,
            },
          },
        },
      ]
    }
  });

  // Generate the document
  const buffer = await Packer.toBuffer(doc);
  
  // Save the document
  const docPath = join(process.cwd(), 'uploads', sessionId, 'analysis.docx');
  await writeFile(docPath, buffer);
  
  return docPath;
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