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
      timeout: 300000, // 30 second timeout
    });
  }

  async generateExpertTypes(projectDescription: string): Promise<ExpertType[]> {
    try {
      logger.info('Starting generateExpertTypes');
      const systemPrompt = `I am looking for experts to help me validate a topic. Based on the project description, what specific types of experts should I target? For each type, provide a title, a reason ("why") they are relevant, and assign an importance score from 0.0 to 1.0 for each expert type.
      
      Provide 3-5 different expert types that would be valuable for this project.
      
      Return your response as a JSON object with an "expert_types" array containing multiple expert objects:
      {
        "expert_types": [
          {
            "expert_title": "string",
            "why": "string", 
            "importance_score": 0.9
          },
          {
            "expert_title": "string",
            "why": "string",
            "importance_score": 0.8
          }
        ]
      }`;

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
      logger.info({ 
        rawResult: result,
        isArray: Array.isArray(result),
        hasExpertTypes: !!result.expert_types,
        keys: Object.keys(result)
      }, 'Parsed OpenAI response');
      
      // Ensure the result is an array
      const expertTypes = Array.isArray(result) ? result : (result.expert_types || result.experts || []);
      
      // Validate and fix field names
      const mappedTypes = expertTypes.map((type: any) => ({
        expert_title: type.expert_title || type.title,
        why: type.why || type.reason,
        importance_score: type.importance_score || type.importance || 0.5
      }));
      
      logger.info({ 
        expertTypesCount: mappedTypes.length,
        expertTypes: mappedTypes 
      }, 'Returning expert types');
      
      return mappedTypes;
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

2. **Short-list 8-12 candidates** who meet the following:
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
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info({ searchPrompt, attempt, maxRetries }, 'Starting expert search');
      
      try {
        const response = await this.client.responses.create({
          model: "o3",
          input: [
            {
              role: "developer",
              content: [
                {
                  type: "input_text",
                  text: `You are an elite research assistant and head-hunter tasked with finding expert candidates. 
                  
                  You MUST return a JSON object with a "candidates" array containing 8-12 candidates.
                  
                  Each candidate MUST have ALL of these fields:
                  - name: Full name of the expert (string, required)
                  - title: Current professional title (string, required)
                  - company: Current company/organization (string, required)
                  - linkedin_url: LinkedIn profile URL (string, required - must be a valid linkedin.com URL)
                  - email: Professional email address (string or null)
                  - matching_reasons: Array of strings explaining why they match, with source citations (array, required, min 2 items)
                  - relevancy_to_type_score: Score from 0.0 to 1.0 (number, required)
                  - responsiveness: "High", "Medium", or "Low" (string, required)
                  - personalised_message: Personalized outreach message (string, required)
                  
                  IMPORTANT: All candidates must be real people with verifiable LinkedIn profiles. No fictional examples.`
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: searchPrompt
                }
              ]
            }
          ],
          text: {
            format: {
              type: "text"
            }
          },
          reasoning: {
            effort: "medium"
          },
          tools: [
            {
              type: "web_search_preview",
              user_location: {
                type: "approximate",
                country: "US"
              },
              search_context_size: "medium"
            }
          ],
          store: true
        });

        // Parse the response
        const content = response.choices?.[0]?.message?.content || response.content || '';
        if (!content) throw new Error('No content in response');

        // Extract JSON from the response (it might be wrapped in markdown or other text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }

        const result = JSON.parse(jsonMatch[0]);
        
        // Validate the response has candidates
        const candidates = Array.isArray(result) ? result : (result.candidates || result.experts || []);
        
        if (!Array.isArray(candidates) || candidates.length === 0) {
          throw new Error(`No candidates found in response on attempt ${attempt}`);
        }
        
        // Validate each candidate has required fields
        const validCandidates = candidates.filter(candidate => 
          candidate.name && 
          candidate.title && 
          candidate.company && 
          candidate.linkedin_url?.includes('linkedin.com') &&
          Array.isArray(candidate.matching_reasons) &&
          candidate.matching_reasons.length >= 2 &&
          typeof candidate.relevancy_to_type_score === 'number' &&
          candidate.responsiveness &&
          candidate.personalised_message
        );
        
        if (validCandidates.length < 5) {
          if (attempt === maxRetries) {
            logger.warn({ 
              validCount: validCandidates.length, 
              totalCount: candidates.length 
            }, 'Insufficient valid candidates after all attempts');
            return validCandidates; // Return what we have
          }
          throw new Error(`Only ${validCandidates.length} valid candidates found, retrying...`);
        }
        
        logger.info({ 
          candidatesFound: validCandidates.length,
          attempt 
        }, 'Successfully found expert candidates');
        
        return validCandidates;
        
      } catch (error) {
        logger.error({ error: error.message, attempt }, 'Expert search attempt failed');
        
        if (attempt === maxRetries) {
          logger.error({ error }, 'All expert search attempts failed');
          // Return empty array instead of throwing to prevent workflow failure
          return [];
        }
        
        // Add more specific requirements for retry
        logger.info('Retrying with enhanced requirements...');
      }
    }
    
    return []; // Should never reach here
  }
}