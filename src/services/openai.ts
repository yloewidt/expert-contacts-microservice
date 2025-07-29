import OpenAI from 'openai';
import { logger } from '../config/logger';
import { ExpertType, SearchCandidate } from '../types';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateExpertTypes(projectDescription: string): Promise<ExpertType[]> {
    try {
      const systemPrompt = `I am looking for experts to help me validate a topic. Based on the project description, what specific types of experts should I target? For each type, provide a title, a reason ("why") they are relevant, and assign an importance score from 0.0 to 1.0 for each expert type.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: projectDescription }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in response');

      const result = JSON.parse(content);
      logger.info({ expertTypes: result }, 'Generated expert types');
      
      // Handle various response formats
      if (Array.isArray(result)) {
        return result;
      } else if (result.expert_types && Array.isArray(result.expert_types)) {
        return result.expert_types;
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      logger.error({ error }, 'Error generating expert types');
      throw error;
    }
  }

  async generateSearchPrompt(projectDescription: string, expertType: ExpertType): Promise<string> {
    try {
      const userPrompt = `I'm looking to validate the following project:\n${projectDescription}\nTo do this, I'm looking for an expert like a ${expertType.expert_title} because ${expertType.why}.\nHelp me write a search prompt based on this need, using the provided template.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in response');

      // Replace placeholders in the template
      const template = `### SYSTEM
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

      return content || template;
    } catch (error) {
      logger.error({ error }, 'Error generating search prompt');
      throw error;
    }
  }

  async searchExperts(searchPrompt: string): Promise<SearchCandidate[]> {
    try {
      // Note: In production, this would use the o3 model with web search capabilities
      // For now, we'll simulate with GPT-4o
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o', // Would be 'o3' in production
        messages: [
          { role: 'user', content: searchPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No content in response');

      const result = JSON.parse(content);
      logger.info({ candidatesFound: result.length || 0 }, 'Found expert candidates');
      
      // Handle various response formats
      if (Array.isArray(result)) {
        return result;
      } else if (result.candidates && Array.isArray(result.candidates)) {
        return result.candidates;
      } else if (result.experts && Array.isArray(result.experts)) {
        return result.experts;
      } else {
        return [];
      }
    } catch (error) {
      logger.error({ error }, 'Error searching for experts');
      throw error;
    }
  }
}