# LVMH Competitor Analysis Tool

A tool to help analyze competitor sales incentives and promotions for LVMH brands at Changi Airport.

## Project Objectives

To create a simple competitive analysis report tool for my mother-in-law, who is currently working in Changi Airport as a sales manager. 

## Problem Statement
As part of her workflow, she takes over 30+ photos of the competition's incentive structure and promotions every month. She then needs to manually extract the data and input it into a spreadsheet.

This task is highly tedious and error-prone, and it consumes a lot of time.

It is difficult to synthesize the information and come up with action items, ideas, and insights for improving her sales incentive structure.

## Solution

Make it easy for her to extract data from the photos and synthesize the information into a report.

Input: Upload multiple images
Output: Word document with the following sections:
1. Table summary of the competition's incentive structure and promotions
2. Insights and recommendations

## Core Functionalities
1. Allow users to upload multiple images
2. Extract structured data from the uploaded images with LLM (Deepseek V3)
3. Synthesize the information into a word document
4. Allow users to download the generated word document

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- DeepSeek API key (or OpenAI API key)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/lvmh-competitor-analysis.git
cd lvmh-competitor-analysis
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with your API keys:
```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1
```

If you're using OpenAI API with DeepSeek models:
```
DEEPSEEK_API_KEY=your_openai_api_key_here
DEEPSEEK_API_BASE_URL=https://api.openai.com/v1
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Upload images of competitor promotions and sales incentives.
2. Wait for the analysis to complete.
3. Download the generated Word document with the analysis.

## Technical Implementation

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Next.js API routes and server actions
- **Image Analysis**: DeepSeek V3 Vision model
- **Document Generation**: docx library

## Prompt for DeepSeek V3

The prompt used for extracting structured data from the uploaded images:

```
You are a luxury retail and duty-free sales expert. Analyze the following competitor's staff sales incentive data to help an LVMH brand compete effectively. 

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
* Format your response using markdown, with tables using the | syntax for better document generation.