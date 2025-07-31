import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Expert, ExpertType, SearchCandidate, LLMMetrics } from '../types';

export class Database {
  async createSourcingRequest(projectDescription: string): Promise<string> {
    const id = uuidv4();
    const query = `
      INSERT INTO expert_sourcing_requests (id, project_description, status)
      VALUES ($1, $2, 'pending')
      RETURNING id
    `;
    
    try {
      const result = await pool.query(query, [id, projectDescription]);
      return result.rows[0].id;
    } catch (error) {
      console.error('Database error in createSourcingRequest:', error);
      throw error;
    }
  }

  async updateRequestStatus(requestId: string, status: string, completedAt?: Date): Promise<void> {
    const query = completedAt
      ? 'UPDATE expert_sourcing_requests SET status = $2, completed_at = $3 WHERE id = $1'
      : 'UPDATE expert_sourcing_requests SET status = $2 WHERE id = $1';
    
    const params = completedAt ? [requestId, status, completedAt] : [requestId, status];
    await pool.query(query, params);
  }

  async updateRequestCompletedAt(requestId: string): Promise<void> {
    const query = 'UPDATE expert_sourcing_requests SET completed_at = CURRENT_TIMESTAMP WHERE id = $1';
    await pool.query(query, [requestId]);
  }

  async getRequest(requestId: string) {
    const query = 'SELECT * FROM expert_sourcing_requests WHERE id = $1';
    const result = await pool.query(query, [requestId]);
    return result.rows[0];
  }

  async saveRawOutputs(
    requestId: string,
    expertTypes: ExpertType[],
    searchPrompts: string[],
    searchResults: SearchCandidate[][]
  ): Promise<void> {
    const id = uuidv4();
    const query = `
      INSERT INTO expert_sourcing_raw_outputs (id, request_id, expert_types, search_prompts, search_results)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await pool.query(query, [
      id,
      requestId,
      JSON.stringify(expertTypes),
      JSON.stringify(searchPrompts),
      JSON.stringify(searchResults)
    ]);
  }

  async saveExperts(requestId: string, experts: Expert[]): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const expert of experts) {
        // First, insert or update the expert
        const expertQuery = `
          INSERT INTO experts (id, name, title, company, linkedin_url, email)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (linkedin_url) 
          DO UPDATE SET 
            name = EXCLUDED.name,
            title = EXCLUDED.title,
            company = EXCLUDED.company,
            email = COALESCE(EXCLUDED.email, experts.email),
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `;
        
        const expertResult = await client.query(expertQuery, [
          expert.id,
          expert.name,
          expert.title,
          expert.company,
          expert.linkedin_url,
          expert.email
        ]);
        
        const expertId = expertResult.rows[0].id;
        
        // Then, create the match record
        const matchId = uuidv4();
        const matchQuery = `
          INSERT INTO expert_request_matches 
          (id, request_id, expert_id, relevance_score, email, matching_reasons, personalised_message, areas_of_expertise, conversation_topics)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        await client.query(matchQuery, [
          matchId,
          requestId,
          expertId,
          expert.relevance_score,
          expert.email,
          JSON.stringify(expert.matching_reasons),
          expert.personalised_message,
          JSON.stringify(expert.areas_of_expertise || []),
          JSON.stringify(expert.conversation_topics || [])
        ]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getExpertsByRequestId(requestId: string): Promise<Expert[]> {
    const query = `
      SELECT 
        e.id,
        e.name,
        e.title,
        e.company,
        e.linkedin_url,
        erm.email,
        erm.relevance_score,
        erm.matching_reasons,
        erm.personalised_message,
        erm.areas_of_expertise,
        erm.conversation_topics
      FROM expert_request_matches erm
      JOIN experts e ON erm.expert_id = e.id
      WHERE erm.request_id = $1
      ORDER BY erm.relevance_score DESC
    `;
    
    const result = await pool.query(query, [requestId]);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      title: row.title,
      company: row.company,
      linkedin_url: row.linkedin_url,
      email: row.email,
      relevance_score: row.relevance_score,
      matching_reasons: JSON.parse(row.matching_reasons),
      personalised_message: row.personalised_message,
      areas_of_expertise: JSON.parse(row.areas_of_expertise || '[]'),
      conversation_topics: JSON.parse(row.conversation_topics || '[]')
    }));
  }

  async getRawOutputs(requestId: string) {
    const query = 'SELECT * FROM expert_sourcing_raw_outputs WHERE request_id = $1';
    const result = await pool.query(query, [requestId]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      expert_types: JSON.parse(row.expert_types),
      search_prompts: JSON.parse(row.search_prompts),
      search_results: JSON.parse(row.search_results)
    };
  }

  async getAllJobs() {
    const query = `
      SELECT 
        id,
        project_description,
        status,
        created_at,
        completed_at
      FROM expert_sourcing_requests
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async storeRawOutput(requestId: string, outputType: string, data: any): Promise<void> {
    // Check if a record already exists
    const checkQuery = 'SELECT id FROM expert_sourcing_raw_outputs WHERE request_id = $1';
    const checkResult = await pool.query(checkQuery, [requestId]);
    
    if (checkResult.rows.length === 0) {
      // Insert new record
      const id = uuidv4();
      const insertQuery = `
        INSERT INTO expert_sourcing_raw_outputs (id, request_id, expert_types, search_prompts, search_results)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      if (outputType === 'expert_types') {
        await pool.query(insertQuery, [id, requestId, JSON.stringify(data), '[]', '[]']);
      } else if (outputType.startsWith('search_')) {
        await pool.query(insertQuery, [id, requestId, '[]', JSON.stringify([outputType]), JSON.stringify([data])]);
      }
    } else {
      // Update existing record
      if (outputType === 'expert_types') {
        const updateQuery = `
          UPDATE expert_sourcing_raw_outputs 
          SET expert_types = $2::jsonb
          WHERE request_id = $1
        `;
        await pool.query(updateQuery, [requestId, JSON.stringify(data)]);
      } else if (outputType.startsWith('search_')) {
        const updateQuery = `
          UPDATE expert_sourcing_raw_outputs 
          SET search_prompts = search_prompts::jsonb || $2::jsonb,
              search_results = search_results::jsonb || $3::jsonb
          WHERE request_id = $1
        `;
        await pool.query(updateQuery, [requestId, JSON.stringify([outputType]), JSON.stringify([data])]);
      }
    }
  }

  async createExpert(expert: Partial<Expert>): Promise<string> {
    const id = uuidv4();
    const query = `
      INSERT INTO experts (id, name, title, company, linkedin_url, email, created_at, updated_at)
      VALUES ($1, $2, $3, $4, COALESCE($5, ''), $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (linkedin_url) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        title = EXCLUDED.title,
        company = EXCLUDED.company,
        email = COALESCE(EXCLUDED.email, experts.email),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    const result = await pool.query(query, [
      id,
      expert.name,
      expert.title,
      expert.company,
      expert.linkedin_url,
      expert.email
    ]);
    
    return result.rows[0].id;
  }

  async createExpertMatch(requestId: string, expertId: string, matchData: any): Promise<void> {
    const id = uuidv4();
    const query = `
      INSERT INTO expert_request_matches 
      (id, request_id, expert_id, relevance_score, email, matching_reasons, personalised_message, areas_of_expertise, conversation_topics, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    `;
    
    await pool.query(query, [
      id,
      requestId,
      expertId,
      matchData.relevancy_score || matchData.relevance_score,
      matchData.email || null,
      JSON.stringify(matchData.matching_reasons || []),
      matchData.suggested_message || matchData.personalised_message || '',
      JSON.stringify(matchData.areas_of_expertise || []),
      JSON.stringify(matchData.conversation_topics || [])
    ]);
  }

  // LLM Call Tracking Methods
  async createLLMCall(requestId: string, model: string, operation: string): Promise<string> {
    const id = uuidv4();
    const query = `
      INSERT INTO llm_calls (id, request_id, model, operation, started_at, status)
      VALUES ($1, $2, $3, $4, NOW(), 'in_progress')
      RETURNING id, started_at
    `;
    
    const result = await pool.query(query, [id, requestId, model, operation]);
    return result.rows[0].id;
  }

  async updateLLMCall(
    callId: string, 
    status: 'success' | 'failed' | 'timeout',
    duration_ms: number,
    error_message?: string,
    tokens_used?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  ): Promise<void> {
    const query = `
      UPDATE llm_calls 
      SET 
        completed_at = NOW(),
        duration_ms = $2,
        status = $3,
        error_message = $4,
        tokens_used = $5
      WHERE id = $1
    `;
    
    await pool.query(query, [
      callId,
      duration_ms,
      status,
      error_message || null,
      tokens_used ? JSON.stringify(tokens_used) : null
    ]);
  }

  async incrementLLMCallAttempt(requestId: string, model: string, operation: string): Promise<{ id: string; attempt_number: number }> {
    // Get the current max attempt number for this operation
    const maxAttemptQuery = `
      SELECT COALESCE(MAX(attempt_number), 0) as max_attempt
      FROM llm_calls
      WHERE request_id = $1 AND model = $2 AND operation = $3
    `;
    
    const maxResult = await pool.query(maxAttemptQuery, [requestId, model, operation]);
    const nextAttempt = maxResult.rows[0].max_attempt + 1;
    
    // Create new call with incremented attempt number
    const id = uuidv4();
    const insertQuery = `
      INSERT INTO llm_calls (id, request_id, model, operation, started_at, status, attempt_number)
      VALUES ($1, $2, $3, $4, NOW(), 'in_progress', $5)
      RETURNING id
    `;
    
    const result = await pool.query(insertQuery, [id, requestId, model, operation, nextAttempt]);
    return { id: result.rows[0].id, attempt_number: nextAttempt };
  }

  async getLLMMetrics(requestId: string): Promise<LLMMetrics | null> {
    try {
      const query = `SELECT calculate_llm_metrics($1) as metrics`;
      const result = await pool.query(query, [requestId]);
      return result.rows[0].metrics;
    } catch (error: any) {
      // If function doesn't exist, return null
      if (error.code === '42883') {
        console.warn('calculate_llm_metrics function not found, returning null');
        return null;
      }
      throw error;
    }
  }
}