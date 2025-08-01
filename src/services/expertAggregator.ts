import { v4 as uuidv4 } from 'uuid';
import { Expert, ExpertType, SearchCandidate } from '../types';
import { logger } from '../config/logger';

export class ExpertAggregatorService {
  aggregateExperts(
    expertTypes: ExpertType[],
    searchResults: SearchCandidate[][]
  ): Expert[] {
    const expertMap = new Map<string, {
      candidate: SearchCandidate,
      typeScores: { score: number, responsiveness: number, importance: number }[]
    }>();

    // Aggregate all candidates by LinkedIn URL
    searchResults.forEach((results, typeIndex) => {
      const expertType = expertTypes[typeIndex];
      
      results.forEach(candidate => {
        // Use LinkedIn URL if available, otherwise use name+company as key
        const key = candidate.linkedin_url 
          ? candidate.linkedin_url.toLowerCase()
          : `${candidate.name}_${candidate.company}`.toLowerCase();
        
        if (!expertMap.has(key)) {
          expertMap.set(key, {
            candidate,
            typeScores: []
          });
        }
        
        expertMap.get(key)!.typeScores.push({
          score: candidate.relevancy_to_type_score,
          responsiveness: candidate.responsiveness,
          importance: expertType.importance_score
        });
      });
    });

    // Calculate final relevance scores and convert to Expert format
    const experts: Expert[] = Array.from(expertMap.values()).map(({ candidate, typeScores }) => {
      // Calculate weighted average of relevancy scores
      
      const totalScore = typeScores.reduce(
        (sum, ts) => sum + (ts.score * ts.importance * ts.responsiveness),
        0
      );

      // Get average scores for breakdown
      const avgTypeImportance = typeScores.reduce((sum, ts) => sum + ts.importance, 0) / typeScores.length;
      const avgRelevancy = typeScores.reduce((sum, ts) => sum + ts.score, 0) / typeScores.length;
      const avgResponsiveness = typeScores.reduce((sum, ts) => sum + ts.responsiveness, 0) / typeScores.length;

      return {
        id: uuidv4(),
        name: candidate.name,
        title: candidate.title,
        company: candidate.company,
        linkedin_url: candidate.linkedin_url,
        email: candidate.email,
        relevance_score: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
        matching_reasons: candidate.matching_reasons,
        personalised_message: candidate.personalised_message,
        areas_of_expertise: candidate.areas_of_expertise || [],
        conversation_topics: candidate.conversation_topics || [],
        // Add score breakdown
        type_importance_score: Math.round(avgTypeImportance * 100) / 100,
        relevancy_to_type_score: Math.round(avgRelevancy * 100) / 100,
        responsiveness_score: Math.round(avgResponsiveness * 100) / 100
      };
    });

    // Sort by relevance score (descending)
    experts.sort((a, b) => b.relevance_score - a.relevance_score);

    logger.info({ 
      totalCandidates: searchResults.flat().length,
      uniqueExperts: experts.length 
    }, 'Aggregated expert results');

    return experts;
  }
}