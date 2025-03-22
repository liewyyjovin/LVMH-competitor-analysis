const nodeTesseract = require('node-tesseract-ocr');
const fs = require('fs').promises;
const path = require('path');

// Configure Tesseract options
const config = {
  lang: 'eng', // Language
  oem: 1,      // OCR Engine Mode (1 = Neural nets LSTM engine only)
  psm: 3,      // Page Segmentation Mode (3 = Fully automatic page segmentation, but no OSD)
};

async function testOCR() {
  try {
    // Path to a test image - replace with a path to your test image
    const testImagePath = path.join(__dirname, 'test-image.png');
    
    // If the test image doesn't exist, create a sample image with text
    try {
      await fs.access(testImagePath);
      console.log('Using existing test image:', testImagePath);
    } catch (err) {
      console.log('Test image not found. Please add a test image at:', testImagePath);
      return;
    }
    
    console.log('Starting OCR processing...');
    const text = await nodeTesseract.recognize(testImagePath, config);
    
    console.log('OCR Result:');
    console.log('-----------------------------------');
    console.log(text);
    console.log('-----------------------------------');
    
    console.log('OCR test completed successfully!');
    
  } catch (error) {
    console.error('Error during OCR test:', error);
  }
}

// Run the test
testOCR(); 