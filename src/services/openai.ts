import OpenAI from 'openai';
import { logger } from '../config/logger';
import { ExpertType, SearchCandidate } from '../types';
import { Database } from '../models/database';

export class OpenAIService {
  private client: OpenAI;
  private db: Database;
  private requestId?: string;

  constructor(requestId?: string) {
    this.db = new Database();
    this.requestId = requestId;
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
      timeout: 300000, // 5 minute timeout
    });
  }

  async generateExpertTypes(projectDescription: string): Promise<ExpertType[]> {
    const startTime = Date.now();
    let llmCallId: string | undefined;
    
    try {
      logger.info('Starting generateExpertTypes');
      
      // Track LLM call if requestId is available
      if (this.requestId) {
        llmCallId = await this.db.createLLMCall(this.requestId, 'gpt-4o', 'generate_expert_types');
      }
      const systemPrompt = `You are an elite expert type identification system for project validation. Your task is to identify hyper-specific expert types that would provide the most valuable insights for validating a given project.

Based on the project description, identify distinct expert types. For each expert type, you must provide:

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
      
      // Track success
      if (llmCallId && this.requestId) {
        const duration = Date.now() - startTime;
        const usage = response.usage;
        await this.db.updateLLMCall(llmCallId, 'success', duration, undefined, 
          usage ? {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens
          } : undefined
        );
      }
      
      return mappedTypes;
    } catch (error) {
      logger.error({ error }, 'Error generating expert types');
      
      // Track failure
      if (llmCallId && this.requestId) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.db.updateLLMCall(llmCallId, 'failed', duration, errorMessage);
      }
      
      throw error;
    }
  }

  async generateSearchPrompt(projectDescription: string, expertType: ExpertType): Promise<string> {
    const startTime = Date.now();
    let llmCallId: string | undefined;
    
    try {
      // Track LLM call if requestId is available
      if (this.requestId) {
        llmCallId = await this.db.createLLMCall(this.requestId, 'gpt-4o', 'generate_search_prompt');
      }
      
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
- Published recently on [[TOPIC THEY SHOULD BE EXPERT ON]]
- [[DEMONSTRATED HANDS ON EXPERIENCE RELEVANT TO THE TOPIC]]

3. For EACH candidate, return a JSON object with: name, title, 
company, linkedin_url, email, matching_reasons (as an array of strings), 
relevancy_to_type_score (a number from 0.0 to 1.0 indicating how well they match this specific expert type), 
responsiveness (a number from 0.0 to 1.0 indicating how likely are to respond to a message and have interest in helping the project suceced
A CEO of a competitive company should score low here(0.01-0.3).
A freelance consultant in this spaceshould score high here(0.9-1.0).
), personalised_message, areas_of_expertise (array of 3-5 specific technical/domain areas they are expert in), and conversation_topics (array of 3-5 specific topics we should discuss with them based on our project needs).

### CONSTRAINTS
- Individuals only (no brokerages or consulting firms).
- Find a public email where possible.
- Cite every claim with a hyperlink inside the matching_reasons.

IMPORTANT:
VALIIDATE LINKEDIN LINK viability.

### EXAMPLE OUTPUT (structure only)
[
  {
    "name": "John Doe",
    "title": "Principal Blockchain Architect",
    "company": "Tech Solutions Inc.",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "email": "john.doe@example.com",
    "matching_reasons": ["Led the development of a DeFi protocol at ExampleCorp", "Published a paper on zero-knowledge proofs"],
    "relevancy_to_type_score": ...,
    "responsiveness": ...,
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

      // Track success
      if (llmCallId && this.requestId) {
        const duration = Date.now() - startTime;
        const usage = response.usage;
        await this.db.updateLLMCall(llmCallId, 'success', duration, undefined, 
          usage ? {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens
          } : undefined
        );
      }

      return content;
    } catch (error) {
      logger.error({ error }, 'Error generating search prompt');
      
      // Track failure
      if (llmCallId && this.requestId) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.db.updateLLMCall(llmCallId, 'failed', duration, errorMessage);
      }
      
      throw error;
    }
  }

  async searchExperts(searchPrompt: string): Promise<SearchCandidate[]> {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info({ searchPrompt, attempt, maxRetries }, 'Starting expert search with o3');
      
      const startTime = Date.now();
      let llmCallId: string | undefined;
      
      try {
        // Track LLM call with attempt number
        if (this.requestId) {
          const callInfo = await this.db.incrementLLMCallAttempt(this.requestId, 'o3', 'search_experts');
          llmCallId = callInfo.id;
        }
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
                          type: "number"
                        },
                        personalised_message: { type: "string" },
                        areas_of_expertise: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 3,
                          maxItems: 5
                        },
                        conversation_topics: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 3,
                          maxItems: 5
                        }
                      },
                      required: ["name", "title", "company", "linkedin_url", "email", "matching_reasons", "relevancy_to_type_score", "responsiveness", "personalised_message", "areas_of_expertise", "conversation_topics"],
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
        }, {
          timeout: 300000 // 5 minute timeout for o3 calls
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
        
 
        if (candidates.length === 0 && attempt < maxRetries) {
          throw new Error(`No valid candidates found, retrying...`);
        }
        
        logger.info({ 
          candidatesFound: candidates.length,
          totalCandidates: candidates.length,
          attempt,
          usage: response.usage
        }, 'Successfully found expert candidates');
        
        // Track success
        if (llmCallId && this.requestId) {
          const duration = Date.now() - startTime;
          const usage = response.usage;
          await this.db.updateLLMCall(llmCallId, 'success', duration, undefined,
            usage ? {
              prompt_tokens: usage.prompt_tokens || 0,
              completion_tokens: usage.completion_tokens || 0,
              total_tokens: usage.total_tokens || 0
            } : undefined
          );
        }
        
        return candidates;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage, attempt }, 'Expert search attempt failed');
        
        // Track failure or timeout
        if (llmCallId && this.requestId) {
          const duration = Date.now() - startTime;
          const isTimeout = errorMessage.toLowerCase().includes('timeout') || duration >= 300000;
          await this.db.updateLLMCall(
            llmCallId, 
            isTimeout ? 'timeout' : 'failed', 
            duration, 
            errorMessage
          );
        }
        
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