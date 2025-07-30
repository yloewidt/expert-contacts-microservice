import dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai';
import { logger } from './src/config/logger';

dotenv.config();

async function testO3ResponseStructure() {
  console.log('🧪 Testing o3 Response Structure...\n');
  
  const openAIService = new OpenAIService();
  
  // Simple test prompt
  const testPrompt = `Find one expert in AI. Return JSON with candidates array containing one object with these fields: name, title, company, linkedin_url, email, matching_reasons (array), relevancy_to_type_score (number), responsiveness (High/Medium/Low), personalised_message`;
  
  try {
    console.log('📡 Calling searchExperts method...\n');
    const candidates = await openAIService.searchExperts(testPrompt);
    
    console.log('✅ searchExperts returned:', candidates);
    console.log('\nNumber of candidates:', candidates.length);
    
  } catch (error) {
    console.error('❌ searchExperts failed:', error);
    
    // Now let's debug by calling o3 directly
    console.log('\n🔍 Debugging: Calling o3 API directly...\n');
    
    const client = (openAIService as any).client;
    
    try {
      const response = await (client as any).responses.create({
        model: "o3",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: testPrompt
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
          effort: "low"
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
      
      console.log('📦 Raw o3 Response Structure:');
      console.log('- response.content:', response.content);
      console.log('- response.output_text:', response.output_text);
      console.log('- response.output:', Array.isArray(response.output) ? `Array with ${response.output.length} items` : response.output);
      
      if (response.output && Array.isArray(response.output)) {
        response.output.forEach((item: any, index: number) => {
          console.log(`\n  Output[${index}]:`);
          console.log(`  - type: ${item.type}`);
          console.log(`  - id: ${item.id}`);
          if (item.type === 'message' && item.content) {
            console.log(`  - content: Array with ${item.content.length} items`);
            item.content.forEach((c: any, i: number) => {
              console.log(`    Content[${i}]: type=${c.type}, text=${c.text ? c.text.substring(0, 50) + '...' : 'N/A'}`);
            });
          }
        });
      }
      
      // Try different ways to extract the content
      console.log('\n🔎 Attempting to extract JSON content:');
      
      // Method 1: output_text
      if (response.output_text) {
        console.log('\n✅ Method 1 (output_text): Found!');
        const parsed = JSON.parse(response.output_text);
        console.log('Parsed:', parsed);
      }
      
      // Method 2: output array
      if (response.output && Array.isArray(response.output)) {
        const messageOutput = response.output.find((o: any) => o.type === 'message');
        if (messageOutput?.content?.[0]?.text) {
          console.log('\n✅ Method 2 (output array): Found!');
          const parsed = JSON.parse(messageOutput.content[0].text);
          console.log('Parsed:', parsed);
        }
      }
      
      // Method 3: content field (what production code expects)
      if (response.content) {
        console.log('\n✅ Method 3 (content field): Found!');
        console.log('Type:', typeof response.content);
        console.log('Value:', response.content);
      } else {
        console.log('\n❌ Method 3 (content field): NOT FOUND - This is why production fails!');
      }
      
    } catch (apiError) {
      console.error('❌ Direct o3 API call failed:', apiError);
    }
  }
}

testO3ResponseStructure().catch(console.error);