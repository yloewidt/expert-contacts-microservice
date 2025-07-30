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
      const systemPrompt = `You are an elite expert type identification system for project validation. Your task is to identify hyper-specific expert types that would provide the most valuable insights for validating a given project.

Based on the project description, identify 3-5 distinct expert types. For each expert type, you must provide:

1. **expert_title**: A specific, professional title that describes the expert's role and domain expertise. Be precise - avoid generic titles like "Industry Expert" or "Consultant". Examples: "B2B SaaS Growth Marketing Director", "Kubernetes DevOps Lead Engineer", "Healthcare Compliance Attorney".

2. **why**: A detailed explanation (2-3 sentences) of why this specific expert type is crucial for validating this project. Explain their unique perspective, what specific insights they could provide, and how their expertise directly relates to critical aspects of the project.

3. **importance_score**: A decimal score between 0.0 and 1.0 indicating how critical this expert type is for project validation. Use this scale:
   - 0.9-1.0: Absolutely essential - project validation would be incomplete without their input
   - 0.7-0.8: Very important - their insights would significantly strengthen validation
   - 0.5-0.6: Valuable - would provide useful perspective but not critical
   - Below 0.5: Nice to have but not essential

Focus on experts who have:
- Direct hands-on experience in the specific domain
- Deep understanding of the target market or technology
- Practical insights about implementation challenges
- Knowledge of regulatory, compliance, or industry-specific requirements`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Project Description: ${projectDescription}` }
        ],
        response_format: { 
          type: 'json_schema',
          json_schema: {
            name: 'expert_types_response',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                expert_types: {
                  type: 'array',
                  description: 'Array of expert types identified for project validation',
                  items: {
                    type: 'object',
                    properties: {
                      expert_title: {
                        type: 'string',
                        description: 'Specific professional title describing the expert\'s role and domain'
                      },
                      why: {
                        type: 'string',
                        description: 'Detailed explanation of why this expert type is valuable for validation'
                      },
                      importance_score: {
                        type: 'number',
                        description: 'Score from 0.0 to 1.0 indicating how critical this expert is',
                        minimum: 0,
                        maximum: 1
                      }
                    },
                    required: ['expert_title', 'why', 'importance_score'],
                    additionalProperties: false
                  },
                  minItems: 3,
                  maxItems: 5
                }
              },
              required: ['expert_types'],
              additionalProperties: false
            }
          }
        },
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

IMPORTANT:
VALIIDATE LINKEDIN LINK.

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
      logger.info({ searchPrompt, attempt, maxRetries }, 'Starting expert search with o3');
      
      try {
        const response = await (this.client as any).responses.create({
          model: "o3",
          input: [
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
              type: "json_schema",
              name: "expert_search_response",
              strict: true,
              schema: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                        name: { type: "string" },
                        title: { type: "string" },
                        company: { type: "string" },
                        linkedin_url: { type: "string" },
                        email: { type: ["string", "null"] },
                        matching_reasons: {
                          type: "array",
                          items: { type: "string" }
                        },
                        relevancy_to_type_score: { type: "number" },
                        responsiveness: { 
                          type: "string",
                          enum: ["High", "Medium", "Low"]
                        },
                        personalised_message: { type: "string" }
                      },
                      required: ["name", "title", "company", "linkedin_url", "email", "matching_reasons", "relevancy_to_type_score", "responsiveness", "personalised_message"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["candidates"],
                additionalProperties: false
              }
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

        // o3 returns JSON in output_text or in the output array
        const jsonContent = response.output_text || 
                          response.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text;
        
        if (!jsonContent) {
          logger.error({ 
            responseKeys: Object.keys(response),
            hasOutputText: !!response.output_text,
            hasOutput: !!response.output,
            outputLength: response.output?.length 
          }, 'No JSON content found in o3 response');
          throw new Error('No content in response');
        }
        
        const result = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
        
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
        
        if (validCandidates.length === 0 && attempt < maxRetries) {
          throw new Error(`No valid candidates found, retrying...`);
        }
        
        logger.info({ 
          candidatesFound: validCandidates.length,
          totalCandidates: candidates.length,
          attempt,
          usage: response.usage
        }, 'Successfully found expert candidates');
        
        return validCandidates;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage, attempt }, 'Expert search attempt failed');
        
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