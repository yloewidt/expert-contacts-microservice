import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class ExpertSourcingService {
  constructor(db) {
    this.db = db;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Main entry point for expert sourcing
  async sourceExperts(userId, projectDescription) {
    try {
      logger.info({ userId, projectDescription }, 'Starting expert sourcing');
      
      // Create sourcing request
      const requestId = await this.createSourcingRequest(userId, projectDescription);
      
      // Generate expert types needed
      const expertTypes = await this.generateExpertTypes(projectDescription);
      
      // Update request with expert types
      await this.updateSourcingRequest(requestId, { 
        expert_types: JSON.stringify(expertTypes),
        status: 'processing'
      });
      
      // Find experts for each type - process all types but limit for performance
      const allExperts = [];
      const typesToProcess = expertTypes.slice(0, 5); // Process up to 5 types
      
      for (const expertType of typesToProcess) {
        logger.info({ expertType: expertType.type }, 'Finding experts for type');
        const experts = await this.findExpertsForType(expertType, projectDescription);
        allExperts.push({
          expertType: expertType.type,
          importance: expertType.importance,
          experts: experts
        });
      }
      
      // Save results
      await this.saveSourcingResults(requestId, allExperts);
      
      logger.info({ requestId, expertTypesCount: expertTypes.length }, 'Expert sourcing completed');
      
      return {
        requestId,
        expertTypes,
        results: allExperts
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error in sourceExperts');
      throw error;
    }
  }

  // Generate expert types using AI
  async generateExpertTypes(projectDescription) {
    const prompt = `You are an expert at identifying the types of domain experts needed to validate innovative projects.

Given this project description:
${projectDescription}

Generate 5-8 expert types that would be most valuable for validating this project. Be VERY SPECIFIC to the exact project domain.

Focus on:
1. Domain-specific technical experts who worked on this use case
2. Domain-specific Marketing experts who worked on this use case
3. Domain-specific Sales experts who worked on this use case
4. Domain-specific Business experts who worked on this use case
5. Domain-specific Financial experts who worked on this use case

For each expert type, provide:
- type: Brief, specific title
- description: 1-2 sentence description of their expertise
- importance: Score 1-10 based on criticality for project validation
- keywords: Array of 3-5 search keywords
- skills: Array of key skills they should have

Return as JSON object with "expertTypes" array.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return response.expertTypes || response.experts || [];
  }

  // Find experts for a specific type
  async findExpertsForType(expertType, projectDescription) {
    // Generate search prompt
    const searchPrompt = this.generateSearchPrompt(expertType, projectDescription);
    
    // Find real experts using o3
    const experts = await this.findRealExperts(expertType, searchPrompt);
    
    // Score and rank experts
    const scoredExperts = await this.scoreExperts(experts, expertType, projectDescription);
    
    // Generate LinkedIn messages and validation topics
    const expertsWithDetails = await this.generateExpertDetails(scoredExperts, expertType, projectDescription);
    
    return expertsWithDetails;
  }

  // Generate search prompt for finding experts
  generateSearchPrompt(expertType, projectDescription) {
    return `I'm looking for experts to validate a project: ${projectDescription.substring(0, 200)}...

To validate ${expertType.description}, I'm seeking ${expertType.type} consultants.

### SYSTEM
You are an elite research assistant and head-hunter.
Your job: surface INDIVIDUAL consultants (no firms) who combine:
• ${expertType.skills.join('\n• ')}
and have PROOF of thought-leadership (articles, talks, open-source tools).

### TASK
1. **Search strategy**
   ▸ Use LinkedIn, personal sites, academic papers, conference agendas
   ▸ Prioritise keywords: ${expertType.keywords.join(', ')}
   ▸ Geographic focus: Global with US emphasis

2. **Short-list 10-15 candidates** who meet ≥ 3 of the following:
   - Published in the last 3 years on relevant topics
   - Hands-on project experience in the domain
   - Publicly presented on related topics

3. For EACH candidate, return:
   | Name | Current role | Core skills | Proof links | Responsiveness | Linkedin URL |

4. Flag **Top 3** with a ★

### CONSTRAINTS
- Individuals only (no firms)
- Cite every claim with a hyperlink
- Output ≤ 500 words total`;
  }

  // Find real experts using o3 with web search
  async findRealExperts(expertType, searchPrompt) {
    const prompt = `${searchPrompt}

Use web search to find REAL experts matching this criteria. Search LinkedIn profiles, conference speakers, article authors, etc.

CRITICAL: 
1. Only return experts with REAL, VERIFIABLE LinkedIn URLs that you found through search.
2. LinkedIn URLs must be in format: https://www.linkedin.com/in/[username] or https://linkedin.com/in/[username]
3. Double-check each LinkedIn URL to ensure it's accurate and belongs to the correct person.
4. Include their actual LinkedIn headline/title, not a generic role.
5. Do NOT generate fake profiles. Only include experts whose LinkedIn profiles you can actually find and verify.
6. Aim for 10-15 experts per expertise type.

Return as JSON object with an "experts" array containing fields: name, title (exact LinkedIn title), company, skills, proofLinks, linkedinUrl, responsiveness`;

    try {
      const response = await this.openai.responses.create({
        model: "o3",
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: "You are an expert recruiter who finds real professionals through web search. Return only real people with verifiable LinkedIn profiles."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt
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
          effort: "high"
        },
        tools: [
          {
            type: "web_search_preview",
            user_location: {
              type: "approximate",
              country: "US"
            },
            search_context_size: "high"
          }
        ],
        store: true
      });

      // Parse the response
      const content = response.content?.[0]?.text;
      if (!content) {
        logger.error('No content in o3 response');
        return [];
      }
      
      const cleanedContent = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .trim();
      
      const result = JSON.parse(cleanedContent);
      const experts = result.experts || [];
      
      // Filter out experts without LinkedIn URLs and take up to 15
      return experts
        .filter(expert => expert.linkedinUrl && expert.linkedinUrl.includes('linkedin.com/in/'))
        .slice(0, 15);
    } catch (error) {
      logger.error({ error }, 'Error finding experts with o3');
      // Fallback to empty array if search fails
      return [];
    }
  }

  // Score experts based on relevance
  async scoreExperts(experts, expertType, projectDescription) {
    if (experts.length === 0) return [];
    
    const scoringPrompt = `Score these experts for their relevance to validating this project:

Project: ${projectDescription.substring(0, 300)}...
Expert Type Needed: ${expertType.type}
Description: ${expertType.description}

Experts to score:
${JSON.stringify(experts, null, 2)}

For each expert, provide a relevancy score (1-10) based on:
- Direct experience with similar projects
- Depth of expertise in required skills
- Quality and recency of proof links
- Likelihood to provide valuable validation insights

Return as JSON array with original expert data plus 'relevancyScore' field.`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [{ role: "user", content: scoringPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return response.experts || [];
  }

  // Generate expert details including messages and validation topics
  async generateExpertDetails(experts, expertType, projectDescription) {
    if (experts.length === 0) return [];
    
    const detailsPrompt = `You are creating PERSONALIZED outreach for each expert. Each expert must have UNIQUE, SPECIFIC content.

Project: ${projectDescription.substring(0, 300)}...
Expert Type: ${expertType.type}

For EACH expert below, create UNIQUE, PERSONALIZED content:

${experts.map((e, idx) => `
Expert ${idx + 1}: ${e.name}
Title: ${e.title || e.role} at ${e.company}
LinkedIn: ${e.linkedinUrl}
Skills: ${e.skills?.join(', ')}
Current Relevancy: ${e.relevancyScore}/10
`).join('\n')}

For EACH expert, provide:

1. **linkedinMessage** (MUST be unique per person):
   - Start with THEIR specific work: "I saw your work on [specific project/role] at ${experts[0]?.company}..."
   - Include concrete opportunity: "$500/hour consulting to help design our [specific aspect]"
   - Reference THEIR unique expertise
   - End with: "Would love 15 minutes to explore?"

2. **whatToDiscuss** (3 SPECIFIC bullet points):
   - Reference their actual company/role
   - Ask about challenges specific to their domain
   - Focus on their unique expertise area
   Example: "How did you handle [specific challenge] at [their company]?"

3. **likelihoodToRespond** (1-10, BE REALISTIC):
   SCORING GUIDE:
   - CEO/Founder at Fortune 500: 1-2 (extremely unlikely)
   - CEO/Founder at startup/SMB: 2-4 (very busy but possible)
   - VP/Director at large company: 3-5 (gatekeepers, busy schedule)
   - VP/Director at smaller company: 4-6 (more accessible)
   - Senior Manager/Lead: 5-7 (good balance of expertise/availability)
   - Individual Contributor/Specialist: 6-8 (most responsive)
   - Consultant/Freelance: 7-9 (actively seeking opportunities)
   - Recently changed jobs: +1 (more open to new connections)
   - Active on LinkedIn (posts weekly): +1
   - No recent LinkedIn activity: -1

4. **criticalRelevance** (1-10, BE VERY CRITICAL):
   SCORING GUIDE:
   - 10: Exact match - worked on identical use case
   - 9: Near perfect - same domain, very similar challenge
   - 8: Strong match - relevant industry + relevant technical skills
   - 7: Good match - either perfect industry OR perfect technical match
   - 6: Decent match - adjacent industry with transferable skills
   - 5: Moderate - some relevant experience but gaps exist
   - 4: Weak match - tangential experience only
   - 3: Stretch - would need significant context switching
   - 2: Poor match - minimal relevance
   - 1: No real connection

5. **relevanceReason** (1-2 sentences):
   - Why THIS expert specifically
   - What unique value they bring

Return JSON with "experts" array: name, linkedinMessage, whatToDiscuss (array), likelihoodToRespond (number), criticalRelevance (number), relevanceReason`;

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: detailsPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.8, // Higher for more variation
    });

    const response = JSON.parse(completion.choices[0].message.content);
    const detailedExperts = response.experts || [];
    
    // Merge the details with original expert data
    return experts.map((expert, index) => {
      const details = detailedExperts.find(d => d.name === expert.name) || detailedExperts[index] || {};
      const relevance = details.criticalRelevance || expert.relevancyScore || 5;
      const likelihood = details.likelihoodToRespond || 5;
      
      return {
        ...expert,
        linkedinMessage: details.linkedinMessage || '',
        whatToDiscuss: Array.isArray(details.whatToDiscuss) ? details.whatToDiscuss.join('\n• ') : '',
        likelihoodToRespond: likelihood,
        relevancyScore: relevance,
        relevance: details.relevanceReason || expert.relevance || '',
        combinedScore: (relevance * likelihood * (expertType.importance || 5)) / 100
      };
    });
  }

  // Database operations
  async createSourcingRequest(userId, projectDescription) {
    await this.db.run(
      `INSERT INTO expert_sourcing_requests (user_id, project_description, status, expert_types) 
       VALUES (?, ?, ?, ?)`,
      [userId, projectDescription, 'pending', '[]']
    );
    
    const result = await this.db.get('SELECT last_insert_rowid() as id');
    return result.id;
  }

  async updateSourcingRequest(requestId, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), requestId];
    
    await this.db.run(
      `UPDATE expert_sourcing_requests SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
  }

  async saveSourcingResults(requestId, results) {
    await this.db.transaction(async () => {
      // Save experts and create matches
      for (const typeResult of results) {
        for (const expert of typeResult.experts) {
          // Check if expert exists or create new
          let expertId = await this.findOrCreateExpert(expert);
          
          // Create match
          await this.db.run(
            `INSERT INTO expert_request_matches 
             (request_id, expert_id, expert_type, relevancy_score, importance_score, 
              linkedin_message, what_to_discuss, likelihood_to_respond, combined_score, relevance_reason) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              requestId,
              expertId,
              typeResult.expertType,
              expert.relevancyScore || 0,
              typeResult.importance || 0,
              expert.linkedinMessage || '',
              expert.whatToDiscuss || '',
              expert.likelihoodToRespond || 5,
              expert.combinedScore || 0,
              expert.relevance || ''
            ]
          );
        }
      }
      
      // Update request status
      await this.db.run(
        `UPDATE expert_sourcing_requests 
         SET status = 'completed', results = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [JSON.stringify(results), requestId]
      );
    });
  }

  async findOrCreateExpert(expertData) {
    // Check if expert exists by LinkedIn URL
    const existing = await this.db.get(
      'SELECT id FROM experts WHERE linkedin_url = ?',
      [expertData.linkedinUrl]
    );
    
    if (existing) {
      return existing.id;
    }
    
    // Create new expert
    await this.db.run(
      `INSERT INTO experts 
       (name, linkedin_url, company, title, bio, expertise_areas, proof_links, 
        responsiveness_score, source, confidence_score) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expertData.name,
        expertData.linkedinUrl,
        expertData.company || null,
        expertData.title || expertData.role || null,
        expertData.bio || null,
        JSON.stringify(expertData.skills || []),
        JSON.stringify(expertData.proofLinks || []),
        expertData.responsiveness || 5,
        'ai_suggested',
        expertData.relevancyScore || 5
      ]
    );
    
    const result = await this.db.get('SELECT last_insert_rowid() as id');
    
    // Add skills to expert_skills table
    if (expertData.skills && Array.isArray(expertData.skills)) {
      for (const skill of expertData.skills) {
        await this.db.run(
          'INSERT OR IGNORE INTO expert_skills (expert_id, skill) VALUES (?, ?)',
          [result.id, skill]
        );
      }
    }
    
    return result.id;
  }

  // Get sourcing request details
  async getSourcingRequest(requestId) {
    const request = await this.db.get(
      'SELECT * FROM expert_sourcing_requests WHERE id = ?',
      [requestId]
    );
    
    if (!request) {
      return null;
    }
    
    // Get matched experts
    const matches = await this.db.all(
      `SELECT 
        erm.*,
        e.name, e.linkedin_url, e.company, e.title, e.expertise_areas, e.proof_links
       FROM expert_request_matches erm
       JOIN experts e ON erm.expert_id = e.id
       WHERE erm.request_id = ?
       ORDER BY erm.combined_score DESC, erm.relevancy_score DESC`,
      [requestId]
    );
    
    // Parse JSON fields in matches
    const parsedMatches = matches.map(match => ({
      ...match,
      expertise_areas: JSON.parse(match.expertise_areas || '[]'),
      proof_links: JSON.parse(match.proof_links || '[]')
    }));
    
    return {
      ...request,
      expert_types: JSON.parse(request.expert_types || '[]'),
      results: JSON.parse(request.results || '[]'),
      matches: parsedMatches
    };
  }

  // Get all sourcing requests for a user
  async getUserRequests(userId, limit = 50) {
    return await this.db.all(
      `SELECT id, project_description, status, created_at, updated_at
       FROM expert_sourcing_requests 
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  // Search experts
  async searchExperts(query, filters = {}) {
    let sql = `
      SELECT DISTINCT e.*
      FROM experts e
      WHERE 1=1
    `;
    const params = [];
    
    if (query) {
      sql += ` AND (
        e.name LIKE ? OR 
        e.company LIKE ? OR 
        e.title LIKE ? OR 
        e.bio LIKE ? OR
        e.expertise_areas LIKE ?
      )`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.minConfidence) {
      sql += ' AND e.confidence_score >= ?';
      params.push(filters.minConfidence);
    }
    
    if (filters.source) {
      sql += ' AND e.source = ?';
      params.push(filters.source);
    }
    
    if (filters.skills && filters.skills.length > 0) {
      sql += ` AND e.id IN (
        SELECT expert_id FROM expert_skills 
        WHERE skill IN (${filters.skills.map(() => '?').join(',')})
      )`;
      params.push(...filters.skills);
    }
    
    sql += ' ORDER BY e.confidence_score DESC LIMIT ?';
    params.push(filters.limit || 50);
    
    const experts = await this.db.all(sql, params);
    
    // Parse JSON fields
    return experts.map(expert => ({
      ...expert,
      expertise_areas: JSON.parse(expert.expertise_areas || '[]'),
      proof_links: JSON.parse(expert.proof_links || '[]')
    }));
  }

  // Get expert by ID
  async getExpertById(expertId) {
    const expert = await this.db.get(
      'SELECT * FROM experts WHERE id = ?',
      [expertId]
    );
    
    if (!expert) {
      return null;
    }
    
    // Get skills
    const skills = await this.db.all(
      'SELECT skill FROM expert_skills WHERE expert_id = ?',
      [expertId]
    );
    
    return {
      ...expert,
      expertise_areas: JSON.parse(expert.expertise_areas || '[]'),
      proof_links: JSON.parse(expert.proof_links || '[]'),
      skills: skills.map(s => s.skill)
    };
  }

  // Update expert contact status
  async updateExpertContactStatus(requestId, expertId, status, notes = null) {
    await this.db.run(
      `UPDATE expert_request_matches 
       SET contact_status = ?, contact_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       ${notes ? ', response_received = 1' : ''}
       WHERE request_id = ? AND expert_id = ?`,
      [status, requestId, expertId]
    );
  }
}

export default ExpertSourcingService;