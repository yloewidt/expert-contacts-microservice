import OpenAI from 'openai';
import { logger } from '../config/logger';
import { ExpertType, SearchCandidate } from '../types';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      logger.error('OPENAI_API_KEY is not set');
      throw new Error('OPENAI_API_KEY is not configured');
    }
    logger.info({ 
      hasApiKey: !!apiKey, 
      keyLength: apiKey.length,
      firstChars: apiKey.substring(0, 10),
      lastChars: apiKey.substring(apiKey.length - 10)
    }, 'Initializing OpenAI client');
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateExpertTypes(projectDescription: string): Promise<ExpertType[]> {
    try {
      logger.info('Starting generateExpertTypes');
      const systemPrompt = `I am looking for experts to help me validate a topic. Based on the project description, what specific types of experts should I target? For each type, provide a title, a reason ("why") they are relevant, and assign an importance score from 0.0 to 1.0 for each expert type.
      
      Return your response as a JSON array of objects with the following structure:
      [{
        "expert_title": "string",
        "why": "string",
        "importance_score": 0.9
      }]`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Project Description: ${projectDescription}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in response');

      const result = JSON.parse(content);
      logger.info({ expertTypes: result }, 'Generated expert types');
      
      // Ensure the result is an array
      const expertTypes = Array.isArray(result) ? result : (result.expert_types || result.experts || []);
      
      // Validate and fix field names
      return expertTypes.map((type: any) => ({
        expert_title: type.expert_title || type.title,
        why: type.why || type.reason,
        importance_score: type.importance_score || type.importance || 0.5
      }));
    } catch (error) {
      logger.error({ error }, 'Error generating expert types');
      throw error;
    }
  }

  async generateSearchPrompt(projectDescription: string, expertType: ExpertType): Promise<string> {
    try {
      const userPrompt = `I'm looking to validate the following project:\n${projectDescription}\nTo do this, I'm looking for an expert like a ${expertType.expert_title} because ${expertType.why}.\nHelp me write a search prompt based on this need, using the provided template.

Fill in the template below by replacing the [[PLACEHOLDERS]] with specific, relevant information based on the project and expert type:

### SYSTEM
You are an elite research assistant and head-hunter.
Your job: surface INDIVIDUAL consultants (no firms) who combine
[[RELEVANT EXPERIENCE OF THE PEOPLE I AM LOOKING FOR]]
and have PROOF of thought-leadership (articles, talks, open-source tools).

### TASK
1. **Search strategy**
▸ Use [[LinkedIn, personal sites, academic papers, conference agendas OR ANY OTHER RESOURCE]].
▸ Prioritise keywords: [[RELEVANT SEARCHES]]
▸ [[ANY ADDITIONAL FOCUSES]].

2. **Short-list 8-12 candidates** who meet ≥ 3 of the following:
- Published in the last 3 years on [[TOPIC THEY SHOULD BE EXPERT ON]]
- [[DEMONSTRATED HANDS ON EXPERIENCE RELEVANT TO THE TOPIC]]

3. For EACH candidate, return a JSON object with: name, title, company, linkedin_url, email, matching_reasons (as an array of strings), relevancy_to_type_score (a number from 0.0 to 1.0 indicating how well they match this specific expert type), responsiveness, and a personalised_message.

### CONSTRAINTS
- Individuals only (no brokerages or consulting firms).
- Find a public email where possible.
- Cite every claim with a hyperlink inside the matching_reasons.

### EXAMPLE OUTPUT (structure only)
[
  {
    "name": "John Doe",
    "title": "Principal Blockchain Architect",
    "company": "Tech Solutions Inc.",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "email": "john.doe@example.com",
    "matching_reasons": ["Led the development of a DeFi protocol at ExampleCorp", "Published a paper on zero-knowledge proofs"],
    "relevancy_to_type_score": 0.95,
    "responsiveness": "High",
    "personalised_message": "A personalized WIIFM-oriented message to get them to consult."
  }
]`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in response');

      return content;
    } catch (error) {
      logger.error({ error }, 'Error generating search prompt');
      throw error;
    }
  }

  async searchExperts(searchPrompt: string): Promise<SearchCandidate[]> {
    try {
      // Note: In production, this would use the o3 model with web search capabilities
      // For now, we'll simulate with GPT-4o
      const systemPrompt = `You are tasked with finding expert candidates based on the provided search criteria. Return a JSON object with a "candidates" array. Each candidate should have the following fields:
      - name: Full name of the expert
      - title: Current professional title
      - company: Current company/organization
      - linkedin_url: LinkedIn profile URL (or null if not found)
      - email: Professional email address (or null if not found)
      - matching_reasons: Array of strings explaining why they match
      - relevancy_to_type_score: Score from 0.0 to 1.0
      - responsiveness: Expected responsiveness level
      - personalised_message: Personalized outreach message`;

      const response = await this.client.chat.completions.create({
        model: process.env.SEARCH_MODEL || 'gpt-4o', // o3 model with web search in production
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: searchPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in response');

      const result = JSON.parse(content);
      logger.info({ candidatesFound: result.candidates?.length || 0 }, 'Found expert candidates');
      
      // Handle various response formats
      if (Array.isArray(result)) {
        return result;
      } else if (result.candidates && Array.isArray(result.candidates)) {
        return result.candidates;
      } else if (result.experts && Array.isArray(result.experts)) {
        return result.experts;
      } else {
        logger.warn({ result }, 'No candidates found in response');
        return [];
      }
    } catch (error) {
      logger.error({ error }, 'Error searching for experts');
      throw error;
    }
  }
}