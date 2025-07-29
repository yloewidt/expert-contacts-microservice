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
      typeScores: { score: number, importance: number }[]
    }>();

    // Aggregate all candidates by LinkedIn URL
    searchResults.forEach((results, typeIndex) => {
      const expertType = expertTypes[typeIndex];
      
      results.forEach(candidate => {
        const key = candidate.linkedin_url.toLowerCase();
        
        if (!expertMap.has(key)) {
          expertMap.set(key, {
            candidate,
            typeScores: []
          });
        }
        
        expertMap.get(key)!.typeScores.push({
          score: candidate.relevancy_to_type_score,
          importance: expertType.importance_score
        });
      });
    });

    // Calculate final relevance scores and convert to Expert format
    const experts: Expert[] = Array.from(expertMap.values()).map(({ candidate, typeScores }) => {
      // Calculate weighted average of relevancy scores
      const totalWeight = typeScores.reduce((sum, ts) => sum + ts.importance, 0);
      const weightedScore = typeScores.reduce(
        (sum, ts) => sum + (ts.score * ts.importance),
        0
      ) / totalWeight;

      return {
        id: uuidv4(),
        name: candidate.name,
        title: candidate.title,
        company: candidate.company,
        linkedin_url: candidate.linkedin_url,
        email: candidate.email,
        relevance_score: Math.round(weightedScore * 100) / 100, // Round to 2 decimal places
        matching_reasons: candidate.matching_reasons,
        personalised_message: candidate.personalised_message
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