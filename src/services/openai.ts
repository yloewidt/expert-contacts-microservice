import OpenAI from 'openai';
import { logger } from '../config/logger';
import { ExpertType, SearchCandidate } from '../types';
import { Database } from '../models/database';

// Type definitions for better error tracking
interface AttemptResult {
  success: boolean;
  candidates?: SearchCandidate[];
  error?: string;
  errorType?: 'timeout' | 'quota_exceeded' | 'no_content' | 'parse_error' | 'validation_error' | 'api_error' | 'network_error';
  duration: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface O3Response {
  output_text?: string;
  output?: Array<{ type: string; content?: Array<{ text?: string }> }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

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
- 0.9-1.0: Essential Expertiese Expertiese in the specific space and domain.
- 0.6-0.8: Essential Expertiese in the space, but not in the domain, or in the domain but not in the space
- 0.4-0.6: Non Essential Expertiese in the specific space and domain.
- 0.1-0.4: Non Essential Expertiese in the space but not domain or other way around.

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
                  }
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
EX-CEO OR A freelance consultant in this spaceshould score high here(0.9-1.0).
), personalised_message, areas_of_expertise (array of 3-5 specific technical/domain areas they are expert in), and conversation_topics (array of 3-5 specific topics we should discuss with them based on our project needs).

### CONSTRAINTS
- Individuals only (no brokerages or consulting firms).
- Find a public email where possible.
- Cite every claim with a hyperlink inside the matching_reasons.

FINDING THE RIGHT LINKEDIN URL:
Finding the right person is the most important part of the task.
Algo:
1. Web Search with the following format:
[Person Name] [Additional information they might include in their profile] site:linkedin.com
1.a. If you cannot find the right person, make a variation of the search query and try again.
2. Grab Linkedin FULL PROFILE URL from the Search Results.
3. For each FULL PROFILE URL Validate the URL from the results by doing the following search:
site:[FULL PROFILE URL] and validate the results exists. If results doesn't exist you can ommit the URL.
4. If you still get multiple FULL PROFILE URLs for a person do the following:
[Additional information they might include in their profile] site:[FULL PROFILE URL]
If you get a response it means that the URL contains the information.

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
      logger.info({ attempt, maxRetries }, 'Starting expert search with o3');
      
      // Execute attempt and track it
      const result = await this.executeSearchAttempt(searchPrompt, attempt);
      
      if (result.success && result.candidates) {
        return result.candidates;
      }
      
      // Check if this is the last attempt
      if (attempt === maxRetries) {
        logger.error({
          finalError: result.error,
          totalAttempts: maxRetries
        }, 'All expert search attempts failed');
        return []; // Return empty array instead of throwing
      }
      
      // Calculate backoff and wait before retry
      const backoffMs = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
      logger.info({
        nextAttempt: attempt + 1,
        backoffMs,
        lastError: result.error,
        errorType: result.errorType
      }, 'Retrying expert search after backoff');
      
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
    
    return []; // Should never reach here
  }

  private async executeSearchAttempt(searchPrompt: string, attemptNumber: number): Promise<AttemptResult> {
    const startTime = Date.now();
    let llmCallId: string | undefined;
    
    // Start tracking this attempt
    if (this.requestId) {
      // For first attempt, use createLLMCall. For retries, use incrementLLMCallAttempt
      if (attemptNumber === 1) {
        llmCallId = await this.db.createLLMCall(this.requestId, 'o3', 'search_experts');
      } else {
        const callInfo = await this.db.incrementLLMCallAttempt(this.requestId, 'o3', 'search_experts');
        llmCallId = callInfo.id;
      }
    }
    
    try {
      // Phase 1: Make the API call
      const response = await this.callO3API(searchPrompt);
      
      // Phase 2: Extract JSON content
      const jsonContent = this.extractJsonContent(response);
      
      // Phase 3: Parse JSON
      const parsedData = this.parseJsonResponse(jsonContent);
      
      // Phase 4: Extract and validate candidates
      const candidates = this.extractAndValidateCandidates(parsedData, attemptNumber);
      
      // Success! Track it
      const duration = Date.now() - startTime;
      if (llmCallId && this.requestId) {
        await this.db.updateLLMCall(llmCallId, 'success', duration, undefined, {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        });
      }
      
      logger.info({
        attempt: attemptNumber,
        candidatesFound: candidates.length,
        duration,
        usage: response.usage
      }, 'Expert search attempt succeeded');
      
      return {
        success: true,
        candidates,
        duration,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens || 0,
          completion_tokens: response.usage.completion_tokens || 0,
          total_tokens: response.usage.total_tokens || 0
        } : undefined
      };
      
    } catch (error) {
      // Handle and track the failure
      const duration = Date.now() - startTime;
      const errorResult = this.categorizeError(error, duration);
      
      logger.error({
        attempt: attemptNumber,
        error: errorResult.error,
        errorType: errorResult.errorType,
        duration
      }, 'Expert search attempt failed');
      
      // Track the failure in database
      if (llmCallId && this.requestId) {
        const status = errorResult.errorType === 'timeout' ? 'timeout' : 'failed';
        await this.db.updateLLMCall(llmCallId, status, duration, errorResult.error);
      }
      
      return errorResult;
    }
  }

  private async callO3API(searchPrompt: string): Promise<O3Response> {
    return await (this.client as any).responses.create({
      model: "o3",
      input: [{
        role: "user",
        content: [{
          type: "input_text",
          text: searchPrompt
        }]
      }],
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
                    linkedin_url: { type: ["string", "null"] },
                    email: { type: ["string", "null"] },
                    matching_reasons: {
                      type: "array",
                      items: { type: "string" }
                    },
                    relevancy_to_type_score: { type: "number" },
                    responsiveness: { type: "number" },
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
                  required: ["name", "title", "company", "linkedin_url", "email", "matching_reasons", 
                            "relevancy_to_type_score", "responsiveness", "personalised_message", 
                            "areas_of_expertise", "conversation_topics"],
                  additionalProperties: false
                }
              }
            },
            required: ["candidates"],
            additionalProperties: false
          }
        }
      },
      reasoning: { effort: process.env.O3_REASONING_EFFORT || "low" },
      tools: [{
        type: "web_search_preview",
        user_location: { type: "approximate", country: "US" },
        search_context_size: process.env.O3_SEARCH_CONTEXT_SIZE || "low"
      }],
      store: true
    }, {
      timeout: parseInt(process.env.O3_TIMEOUT_MS || '900000') // Default 15 minutes
    });
  }

  private extractJsonContent(response: O3Response): string {
    const jsonContent = response.output_text || 
                       response.output?.find(o => o.type === 'message')?.content?.[0]?.text;
    
    if (!jsonContent) {
      logger.error({
        responseKeys: Object.keys(response),
        hasOutputText: !!response.output_text,
        hasOutput: !!response.output,
        outputLength: response.output?.length
      }, 'No JSON content found in o3 response');
      
      throw new Error('NO_CONTENT: o3 response contained no JSON content');
    }
    
    return jsonContent;
  }

  private parseJsonResponse(jsonContent: string): any {
    try {
      return typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    } catch (parseError) {
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      logger.error({
        parseError: errorMsg,
        contentPreview: jsonContent.substring(0, 200)
      }, 'Failed to parse o3 JSON response');
      
      throw new Error(`PARSE_ERROR: Failed to parse JSON - ${errorMsg}`);
    }
  }

  private extractAndValidateCandidates(parsedData: any, attemptNumber: number): SearchCandidate[] {
    // Extract candidates array from various possible formats
    const candidates = Array.isArray(parsedData) ? parsedData : 
                      (parsedData.candidates || parsedData.experts || []);
    
    // Validate it's an array
    if (!Array.isArray(candidates)) {
      const error = `VALIDATION_ERROR: Response does not contain candidates array. Got keys: ${JSON.stringify(Object.keys(parsedData || {}))}`;
      logger.error({
        responseStructure: parsedData,
        attempt: attemptNumber
      }, error);
      throw new Error(error);
    }
    
    // Check if empty
    if (candidates.length === 0) {
      const error = `VALIDATION_ERROR: o3 returned empty candidates array on attempt ${attemptNumber}`;
      logger.warn({
        attempt: attemptNumber,
        parsedData
      }, error);
      throw new Error(error);
    }
    
    // Validate first candidate structure as a sample
    const firstCandidate = candidates[0];
    const requiredFields = ['name', 'title', 'company'];
    const missingFields = requiredFields.filter(field => !firstCandidate[field]);
    
    if (missingFields.length > 0) {
      const error = `VALIDATION_ERROR: First candidate missing required fields: ${missingFields.join(', ')}`;
      logger.error({
        firstCandidate,
        missingFields,
        attempt: attemptNumber
      }, error);
      throw new Error(error);
    }
    
    return candidates;
  }

  private categorizeError(error: unknown, duration: number): AttemptResult {
    let errorMessage = error instanceof Error ? error.message : String(error);
    let errorType: AttemptResult['errorType'] = 'api_error';
    
    // Check for our custom error prefixes
    if (errorMessage.startsWith('NO_CONTENT:')) {
      errorType = 'no_content';
    } else if (errorMessage.startsWith('PARSE_ERROR:')) {
      errorType = 'parse_error';
    } else if (errorMessage.startsWith('VALIDATION_ERROR:')) {
      errorType = 'validation_error';
    } else if (error instanceof Error) {
      // Check for API errors
      if ('response' in error) {
        const apiError = error as any;
        const status = apiError.response?.status;
        const apiMessage = apiError.response?.data?.error?.message;
        
        if (status === 429 || apiMessage?.includes('quota') || apiMessage?.includes('rate_limit')) {
          errorType = 'quota_exceeded';
          errorMessage = `Quota/Rate Limit Error (${status}): ${apiMessage || errorMessage}`;
        } else {
          errorMessage = `OpenAI API Error (${status}): ${apiMessage || errorMessage}`;
        }
      } 
      // Check for network errors
      else if ('code' in error) {
        const networkError = error as any;
        const code = networkError.code;
        
        if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || duration >= 300000) {
          errorType = 'timeout';
          errorMessage = `Timeout Error: ${errorMessage} [Code: ${code}] (Duration: ${duration}ms)`;
        } else {
          errorType = 'network_error';
          errorMessage = `Network Error: ${errorMessage} [Code: ${code}]`;
        }
      }
    }
    
    // Check for timeout based on duration or message
    if (duration >= 300000 || errorMessage.toLowerCase().includes('timeout')) {
      errorType = 'timeout';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorType,
      duration
    };
  }

  async deduplicateExperts(candidates: Array<{
    id: number;
    name: string;
    title: string;
    company: string;
    linkedin_url: string | null;
  }>): Promise<Array<{ original_id: number; new_id: number }>> {
    const startTime = Date.now();
    let llmCallId: string | undefined;
    
    try {
      logger.info({ candidateCount: candidates.length }, 'Starting expert deduplication with o3');
      
      // Track LLM call if requestId is available
      if (this.requestId) {
        llmCallId = await this.db.createLLMCall(this.requestId, 'o3', 'deduplicate_experts');
      }

      const systemPrompt = `You are an expert deduplication system. Your task is to identify which expert records refer to the same person and create a mapping to unify them.

Analyze the provided list of experts and determine which records should be merged. Consider:
- Same person with slight name variations (e.g., "John Smith" vs "J. Smith" vs "John R. Smith")
- Same person at different companies (career progression)
- Same person with different titles at the same company
- Similar LinkedIn URLs that might be the same person

Create a mapping where each record gets assigned a new_id. Records that refer to the same person should have the same new_id.

IMPORTANT: Be conservative - only merge if you're confident they're the same person.`;

      const response = await (this.client as any).responses.create({
        model: "o3",
        input: [{
          role: "user",
          content: [{
            type: "input_text",
            text: `${systemPrompt}\n\nExperts to deduplicate:\n${JSON.stringify(candidates, null, 2)}`
          }]
        }],
        text: {
          format: {
            type: "json_schema",
            name: "deduplication_mapping",
            strict: true,
            schema: {
              type: "object",
              properties: {
                mappings: {
                  type: "array",
                  description: "Array of id mappings",
                  items: {
                    type: "object",
                    properties: {
                      original_id: {
                        type: "number",
                        description: "The original id from the input"
                      },
                      new_id: {
                        type: "number",
                        description: "The new unified id (records with same new_id are the same person)"
                      }
                    },
                    required: ["original_id", "new_id"],
                    additionalProperties: false
                  }
                },
                reasoning: {
                  type: "string",
                  description: "Brief explanation of the deduplication decisions"
                }
              },
              required: ["mappings", "reasoning"],
              additionalProperties: false
            }
          }
        },
        reasoning: { effort: process.env.O3_REASONING_EFFORT || "low" },
        store: true
      }, {
        timeout: parseInt(process.env.O3_TIMEOUT_MS || '300000') // Default 5 minutes
      });

      const jsonContent = response.output_text || 
                         response.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text;
      
      if (!jsonContent) {
        throw new Error('No content in deduplication response');
      }

      const result = JSON.parse(jsonContent);
      
      logger.info({ 
        mappingCount: result.mappings.length,
        reasoning: result.reasoning 
      }, 'Deduplication completed');
      
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
      
      return result.mappings;
    } catch (error) {
      logger.error({ error }, 'Error deduplicating experts');
      
      // Track failure
      if (llmCallId && this.requestId) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.db.updateLLMCall(llmCallId, 'failed', duration, errorMessage);
      }
      
      // Return identity mapping on error
      return candidates.map((c, idx) => ({
        original_id: c.id,
        new_id: idx + 1
      }));
    }
  }
}