import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function testO3Debug() {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('🔍 Testing o3 API response structure...\n');
  
  const simplePrompt = "What is 2+2? Return JSON with 'answer' field.";
  
  try {
    const response = await (client as any).responses.create({
      model: "o3",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: simplePrompt
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "simple_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              answer: { type: "number" }
            },
            required: ["answer"],
            additionalProperties: false
          }
        }
      },
      reasoning: {
        effort: "low"
      },
      store: true
    });
    
    console.log('📦 Response structure analysis:\n');
    console.log('Fields present in response:');
    Object.keys(response).forEach(key => {
      const value = response[key];
      const type = typeof value;
      console.log(`- ${key}: ${type}${Array.isArray(value) ? ' (array)' : ''}`);
    });
    
    console.log('\n🔎 Looking for JSON content:');
    
    // Check all possible locations
    const possibleLocations = [
      { path: 'response.content', value: response.content },
      { path: 'response.output_text', value: response.output_text },
      { path: 'response.text', value: response.text },
      { path: 'response.output[message].content[0].text', value: response.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text }
    ];
    
    possibleLocations.forEach(({ path, value }) => {
      if (value !== undefined) {
        console.log(`\n✅ Found at ${path}:`);
        console.log(`   Type: ${typeof value}`);
        console.log(`   Value: ${typeof value === 'string' ? value : JSON.stringify(value).substring(0, 100)}`);
        
        if (typeof value === 'string' && value.startsWith('{')) {
          try {
            const parsed = JSON.parse(value);
            console.log(`   Parsed: ${JSON.stringify(parsed)}`);
          } catch (e) {
            console.log(`   Parse error: ${e}`);
          }
        }
      } else {
        console.log(`❌ Not found at ${path}`);
      }
    });
    
    // Log the actual extraction logic needed
    console.log('\n💡 Correct extraction code:');
    const content = response.output_text || response.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text;
    console.log(`const content = response.output_text || response.output?.find(o => o.type === 'message')?.content?.[0]?.text;`);
    console.log(`Result: ${content}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testO3Debug().catch(console.error);