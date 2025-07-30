import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function testO3Minimal() {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log('Testing minimal o3 call...');
  
  try {
    const response = await (client as any).responses.create({
      model: "o3",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "What is 2+2?"
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

    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

testO3Minimal().catch(console.error);