import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Expert, ExpertType, SearchCandidate } from '../types';

export class Database {
  async createSourcingRequest(projectDescription: string): Promise<string> {
    const id = uuidv4();
    const query = `
      INSERT INTO expert_sourcing_requests (id, project_description, status)
      VALUES ($1, $2, 'pending')
      RETURNING id
    `;
    
    const result = await pool.query(query, [id, projectDescription]);
    return result.rows[0].id;
  }

  async updateRequestStatus(requestId: string, status: string, completedAt?: Date): Promise<void> {
    const query = completedAt
      ? 'UPDATE expert_sourcing_requests SET status = $2, completed_at = $3 WHERE id = $1'
      : 'UPDATE expert_sourcing_requests SET status = $2 WHERE id = $1';
    
    const params = completedAt ? [requestId, status, completedAt] : [requestId, status];
    await pool.query(query, params);
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
          (id, request_id, expert_id, relevance_score, email, matching_reasons, personalised_message)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        
        await client.query(matchQuery, [
          matchId,
          requestId,
          expertId,
          expert.relevance_score,
          expert.email,
          JSON.stringify(expert.matching_reasons),
          expert.personalised_message
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
        erm.personalised_message
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
      personalised_message: row.personalised_message
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
}