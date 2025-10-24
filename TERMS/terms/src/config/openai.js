// OpenAI API Configuration
export const OPENAI_CONFIG = {
  API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',
  API_URL: 'https://api.openai.com/v1/chat/completions',
  MODEL: 'gpt-3.5-turbo',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7
};

// Debug: Check if API key is being read
console.log('🔑 [DEBUG] Environment variables check:');
console.log('🔑 [DEBUG] VITE_OPENAI_API_KEY exists:', !!import.meta.env.VITE_OPENAI_API_KEY);
console.log('🔑 [DEBUG] VITE_OPENAI_API_KEY length:', import.meta.env.VITE_OPENAI_API_KEY?.length || 0);
console.log('🔑 [DEBUG] VITE_OPENAI_API_KEY starts with sk-:', import.meta.env.VITE_OPENAI_API_KEY?.startsWith('sk-') || false);
console.log('🔑 [DEBUG] OPENAI_CONFIG.API_KEY:', OPENAI_CONFIG.API_KEY ? 'SET' : 'NOT SET');

// AI Summarization Service
export class AISummarizationService {
  static async generateSummary(data) {
    console.log('🤖 [AI SUMMARIZATION] Starting AI summary generation...');
    console.log('🤖 [AI SUMMARIZATION] Data received:', {
      title: data.title,
      submissionCount: data.submissionCount,
      teacherNarrativesCount: data.teacherNarratives?.length || 0
    });
    
    try {
      if (!OPENAI_CONFIG.API_KEY) {
        console.error('❌ [AI SUMMARIZATION] OpenAI API key not configured');
        throw new Error('OpenAI API key not configured');
      }

      console.log('✅ [AI SUMMARIZATION] API key found, generating prompt...');
      const prompt = this.createPrompt(data);
      console.log('📝 [AI SUMMARIZATION] Prompt length:', prompt.length, 'characters');
      
      console.log('🚀 [AI SUMMARIZATION] Sending request to OpenAI API...');
      const response = await fetch(OPENAI_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_CONFIG.API_KEY}`
        },
        body: JSON.stringify({
          model: OPENAI_CONFIG.MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are an educational data analyst. Generate concise, professional summaries of student performance data for school reports.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: OPENAI_CONFIG.MAX_TOKENS,
          temperature: OPENAI_CONFIG.TEMPERATURE
        })
      });

      console.log('📡 [AI SUMMARIZATION] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [AI SUMMARIZATION] OpenAI API error:', response.status, response.statusText);
        console.error('❌ [AI SUMMARIZATION] Error details:', errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      console.log('✅ [AI SUMMARIZATION] API response successful, parsing JSON...');
      const result = await response.json();
      console.log('📊 [AI SUMMARIZATION] Response data:', {
        model: result.model,
        usage: result.usage,
        choicesCount: result.choices?.length || 0
      });
      
      const summary = result.choices[0].message.content.trim();
      console.log('✅ [AI SUMMARIZATION] Summary generated successfully!');
      console.log('📝 [AI SUMMARIZATION] Summary length:', summary.length, 'characters');
      console.log('📄 [AI SUMMARIZATION] Summary preview:', summary.substring(0, 100) + '...');
      
      return summary;
    } catch (error) {
      console.error('❌ [AI SUMMARIZATION] Error occurred:', error);
      console.error('❌ [AI SUMMARIZATION] Error stack:', error.stack);
      throw error;
    }
  }

  static createPrompt(data) {
    // Handle different data structures for different report types
    if (data.teacherNarratives && Array.isArray(data.teacherNarratives)) {
      // AccomplishmentReport consolidation data with teacher narratives
      return this.createAccomplishmentPrompt(data);
    } else if (data.peerGroup && data.consolidatedData) {
      // AccomplishmentReport consolidation data (legacy)
      return this.createAccomplishmentPromptLegacy(data);
    } else if (data.selectedPeers && data.consolidatedData) {
      // LAEMPLReport consolidation data
      return this.createLAEMPLPrompt(data);
    } else {
      // Fallback for other data structures
      return this.createGenericPrompt(data);
    }
  }

  static createAccomplishmentPrompt(data) {
    const { title, teacherNarratives, submissionCount } = data;
    
    let prompt = `Please analyze the following Accomplishment Report narratives from teachers and provide a comprehensive summary:\n\n`;
    
    prompt += `**Report Details:**\n`;
    prompt += `- Report Title: ${title}\n`;
    prompt += `- Number of teacher narratives: ${submissionCount}\n\n`;
    
    prompt += `**Teacher Narratives to Analyze:**\n`;
    teacherNarratives.forEach((narrative, index) => {
      prompt += `\n**Narrative ${index + 1} - ${narrative.teacherName} (${narrative.section}):**\n`;
      prompt += `${narrative.narrative}\n`;
    });
    
    prompt += `\n**Analysis Request:**\n`;
    prompt += `Please provide a concise, plain text summary (2-3 paragraphs) that:\n`;
    prompt += `1. Synthesizes the key themes and patterns across all teacher narratives\n`;
    prompt += `2. Highlights common achievements and activities mentioned by multiple teachers\n`;
    prompt += `3. Provides brief recommendations for future similar activities\n\n`;
    prompt += `Write in plain text format (no markdown, no bullet points, no bold text). Keep it concise and professional.`;
    
    return prompt;
  }

  static createAccomplishmentPromptLegacy(data) {
    const { title, peerGroup, consolidatedData, submissionCount } = data;
    
    let prompt = `Please analyze the following Accomplishment Report consolidation data and provide a concise summary:\n\n`;
    
    prompt += `**Consolidation Details:**\n`;
    prompt += `- Report Title: ${title}\n`;
    prompt += `- Number of peer submissions consolidated: ${submissionCount}\n\n`;
    
    if (peerGroup && peerGroup.submissions) {
      prompt += `**Peer Submissions Summary:**\n`;
      peerGroup.submissions.forEach((submission, index) => {
        prompt += `- Submission ${index + 1}: `;
        if (submission.teacher_name) prompt += `Teacher: ${submission.teacher_name}, `;
        if (submission.section_name) prompt += `Section: ${submission.section_name}, `;
        if (submission.status) prompt += `Status: ${submission.status >= 2 ? 'Submitted' : 'Draft'}`;
        prompt += `\n`;
      });
    }
    
    prompt += `\n**Analysis Request:**\n`;
    prompt += `Please provide a concise, plain text summary (2-3 paragraphs) that:\n`;
    prompt += `1. Synthesizes the key themes and patterns across all teacher narratives\n`;
    prompt += `2. Highlights common achievements and activities mentioned by multiple teachers\n`;
    prompt += `3. Provides brief recommendations for future similar activities\n\n`;
    prompt += `Write in plain text format (no markdown, no bullet points, no bold text). Keep it concise and professional.`;
    
    return prompt;
  }

  static createLAEMPLPrompt(data) {
    const { selectedPeers, consolidatedData, subjects } = data;
    
    let prompt = `Please analyze the following LAEMPL Report consolidation data and provide a concise summary:\n\n`;
    
    prompt += `**Consolidated Report Data:**\n`;
    prompt += `- Number of peer submissions: ${selectedPeers.length}\n`;
    prompt += `- Subjects covered: ${subjects.join(', ')}\n\n`;
    
    prompt += `**Performance Summary by Section:**\n`;
    Object.entries(consolidatedData).forEach(([section, data]) => {
      prompt += `- ${section}: `;
      if (data.total_score) prompt += `Total Score: ${data.total_score}, `;
      if (data.total_items) prompt += `Items: ${data.total_items}, `;
      if (data.m) prompt += `Male: ${data.m}, `;
      if (data.f) prompt += `Female: ${data.f}`;
      prompt += `\n`;
    });
    
    prompt += `\n**Analysis Request:**\n`;
    prompt += `Please provide a professional summary highlighting:\n`;
    prompt += `1. Overall performance trends\n`;
    prompt += `2. Key insights from the data\n`;
    prompt += `3. Recommendations for improvement\n`;
    prompt += `4. Notable patterns or observations\n\n`;
    prompt += `Keep the summary concise (2-3 paragraphs) and suitable for educational administrators.`;
    
    return prompt;
  }

  static createGenericPrompt(data) {
    let prompt = `Please analyze the following educational data and provide a concise summary:\n\n`;
    
    prompt += `**Data Summary:**\n`;
    prompt += `- Data type: ${data.type || 'Educational Report'}\n`;
    prompt += `- Records processed: ${data.count || 'Unknown'}\n\n`;
    
    prompt += `**Analysis Request:**\n`;
    prompt += `Please provide a professional summary highlighting:\n`;
    prompt += `1. Key findings and insights\n`;
    prompt += `2. Notable patterns or trends\n`;
    prompt += `3. Recommendations for improvement\n\n`;
    prompt += `Keep the summary concise (2-3 paragraphs) and suitable for educational administrators.`;
    
    return prompt;
  }
}
