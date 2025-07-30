import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

async function testO3Search() {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const searchPrompt = `### SYSTEM
You are an elite research assistant and head-hunter.
Your job: surface INDIVIDUAL consultants (no firms) who combine
extensive experience in petroleum engineering with a focus on integrating alternative energy solutions and have PROOF of thought-leadership (articles, talks, open-source tools).

### TASK
1. **Search strategy**
▸ Use LinkedIn, personal sites, academic papers, conference agendas, and industry publications.
▸ Prioritise keywords: "petroleum engineer flare gas utilization", "flare gas to power bitcoin mining", "oil field energy solutions", "stranded gas monetization".
▸ Focus on identifying individuals with practical experience in converting flare gas into usable energy, particularly for digital applications like data centers or cryptocurrency mining.

2. **Short-list 8-12 candidates** who meet the following:
- Published in the last 3 years on topics related to flare gas utilization or alternative energy solutions in oil fields.
- Demonstrated hands-on experience in projects capturing flare gas for energy generation or similar applications.

3. For EACH candidate, return a JSON object with: name, title, company, linkedin_url, email, matching_reasons (as an array of strings), relevancy_to_type_score (a number from 0.0 to 1.0 indicating how well they match this specific expert type), responsiveness, and a personalised_message.

### CONSTRAINTS
- Individuals only (no brokerages or consulting firms).
- Find a public email where possible.
- Cite every claim with a hyperlink inside the matching_reasons.

### EXAMPLE OUTPUT (structure only)
[
  {
    "name": "Jane Smith",
    "title": "Senior Petroleum Engineer",
    "company": "Energy Innovations Ltd.",
    "linkedin_url": "https://linkedin.com/in/janesmith",
    "email": "jane.smith@energyltd.com",
    "matching_reasons": ["Developed a flare gas capture project for on-site power generation at OilCo", "Speaker at the International Petroleum Technology Conference on sustainable energy solutions"],
    "relevancy_to_type_score": 0.92,
    "responsiveness": "Medium",
    "personalised_message": "Hi Jane, your expertise in integrating flare gas solutions into energy production aligns perfectly with our project on monetizing stranded gas for bitcoin mining. We would love to discuss potential collaboration."
  }
]`;

  console.log('🔍 Running o3 search for petroleum engineers with flare gas expertise...\n');
  console.log('This may take a minute as o3 performs web searches...\n');

  try {
    const response = await (client as any).responses.create({
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

    console.log('✅ Response received!\n');
    console.log('Response ID:', response.id);
    console.log('Model:', response.model);
    console.log('Usage:', response.usage);
    console.log('\n📊 Results:\n');
    
    // Extract the JSON content from the response
    const content = response.output_text || response.output?.find((o: any) => o.type === 'message')?.content?.[0]?.text;
    
    if (content) {
      const result = JSON.parse(content);
      console.log(JSON.stringify(result, null, 2));
      
      if (result.candidates && result.candidates.length > 0) {
        console.log(`\n✅ Found ${result.candidates.length} candidates!`);
        
        // Display summary
        result.candidates.forEach((candidate: any, index: number) => {
          console.log(`\nCandidate ${index + 1}:`);
          console.log(`- Name: ${candidate.name}`);
          console.log(`- Title: ${candidate.title}`);
          console.log(`- Company: ${candidate.company}`);
          console.log(`- LinkedIn: ${candidate.linkedin_url}`);
          console.log(`- Relevancy Score: ${candidate.relevancy_to_type_score}`);
          console.log(`- Matching Reasons: ${candidate.matching_reasons.length}`);
        });
      } else {
        console.log('\n❌ No candidates found');
      }
    } else {
      console.log('\n❌ No content in response');
      console.log('Full response:', JSON.stringify(response, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

testO3Search().catch(console.error);