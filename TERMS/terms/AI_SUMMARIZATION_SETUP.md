# AI Summarization Setup Guide

## Overview
The AI summarization feature provides intelligent analysis of **teacher narratives** from consolidated Accomplishment Reports, generating professional summaries that synthesize key themes, achievements, and insights from multiple teacher perspectives.

## Setup Steps

### 1. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (starts with `sk-`)

### 2. Configure Environment Variables
Create a `.env` file in the `TERMS/terms/` directory with the following content:

```env
VITE_OPENAI_API_KEY=your_actual_api_key_here
```

**Important:** Replace `your_actual_api_key_here` with your actual OpenAI API key.

### 3. Restart the Development Server
After adding the environment variables:
1. Stop the current development server (Ctrl+C)
2. Restart with `npm run dev` or `yarn dev`

## How It Works

### For AccomplishmentReport Consolidation:
1. When a coordinator consolidates accomplishment reports
2. The system automatically extracts **teacher narratives** from all consolidated submissions
3. AI analyzes the actual narrative content written by teachers
4. The summary includes:
   - **Synthesis of key themes** across all teacher narratives
   - **Common achievements and activities** mentioned by multiple teachers
   - **Unique contributions** from different teachers/sections
   - **Student engagement and learning outcomes** insights
   - **Recommendations** based on collective teacher experiences

### Features:
- **Automatic Generation**: AI summary is generated automatically after consolidation
- **Professional Format**: Summaries are written in a professional tone suitable for administrators
- **Integration**: Summary can be added directly to the narrative field
- **Loading States**: Clear feedback during AI processing

## Usage

1. **As Coordinator**: 
   - Go to AccomplishmentReport
   - Click "Consolidate" button
   - Select peer submissions to consolidate
   - Click "Consolidate Images"
   - AI summary will be generated automatically
   - Review the summary in the modal
   - Optionally add it to the narrative

2. **Summary Modal**:
   - Shows generated AI summary
   - "Close" button to dismiss
   - "Add to Narrative" button to append summary to the narrative field

## Troubleshooting

### Common Issues:

1. **"OpenAI API key not configured" error**:
   - Ensure your `.env` file is in the correct location (`TERMS/terms/.env`)
   - Check that the API key is correctly formatted
   - Restart the development server

2. **"Failed to generate AI summary" error**:
   - Check your OpenAI API key has sufficient credits
   - Verify internet connection
   - Check browser console for detailed error messages

3. **"No teacher narratives found" error**:
   - Ensure the consolidated submissions contain narrative content
   - Check that teachers have actually written narratives in their reports
   - Verify the consolidation process completed successfully

4. **API Rate Limits**:
   - OpenAI has rate limits based on your plan
   - If you hit limits, wait a few minutes before trying again

### API Costs:
- Uses GPT-3.5-turbo model (cost-effective)
- **Optimized for cost**: Only analyzes teacher narratives, no image processing
- Typical cost: ~$0.001-0.002 per summary (depends on narrative length)
- Monitor usage in your OpenAI dashboard

## Security Notes

- Never commit your `.env` file to version control
- Keep your API key secure and don't share it
- Consider using environment-specific keys for production

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your API key is valid and has credits
3. Ensure the `.env` file is properly formatted
4. Try restarting the development server
