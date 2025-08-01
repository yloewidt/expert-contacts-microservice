import { v4 as uuidv4 } from 'uuid';
import { Expert, ExpertType, SearchCandidate } from '../types';
import { logger } from '../config/logger';
import { OpenAIService } from './openai';

export class ExpertAggregatorService {
  private openaiService: OpenAIService;

  constructor(requestId?: string) {
    this.openaiService = new OpenAIService(requestId);
  }

  async aggregateExperts(
    expertTypes: ExpertType[],
    searchResults: SearchCandidate[][]
  ): Promise<Expert[]> {
    // Flatten all candidates and assign temporary IDs
    const allCandidates: Array<{
      tempId: number;
      candidate: SearchCandidate;
      typeIndex: number;
    }> = [];
    
    let tempId = 1;
    searchResults.forEach((results, typeIndex) => {
      results.forEach(candidate => {
        allCandidates.push({
          tempId: tempId++,
          candidate,
          typeIndex
        });
      });
    });

    if (allCandidates.length === 0) {
      return [];
    }

    // Prepare candidates for deduplication (only core identifying info)
    const candidatesForDedup = allCandidates.map(({ tempId, candidate }) => ({
      id: tempId,
      name: candidate.name,
      title: candidate.title,
      company: candidate.company,
      linkedin_url: candidate.linkedin_url
    }));

    // Get deduplication mapping from LLM
    const deduplicationMapping = await this.openaiService.deduplicateExperts(candidatesForDedup);
    
    // Create a map of tempId to newId
    const idMap = new Map<number, number>();
    deduplicationMapping.forEach(mapping => {
      idMap.set(mapping.original_id, mapping.new_id);
    });

    // Group candidates by their new ID
    const groupedCandidates = new Map<number, Array<{
      candidate: SearchCandidate;
      expertType: ExpertType;
    }>>();

    allCandidates.forEach(({ tempId, candidate, typeIndex }) => {
      const newId = idMap.get(tempId) || tempId; // Fallback to tempId if not in mapping
      const expertType = expertTypes[typeIndex];
      
      if (!groupedCandidates.has(newId)) {
        groupedCandidates.set(newId, []);
      }
      
      groupedCandidates.get(newId)!.push({ candidate, expertType });
    });

    // Create unified expert records
    const experts: Expert[] = Array.from(groupedCandidates.entries()).map(([, group]) => {
      // For unified records, we need to merge the information intelligently
      // Use the first candidate as the base
      const baseCandidate = group[0].candidate;
      
      // Collect all unique matching reasons
      const allMatchingReasons = new Set<string>();
      const allAreasOfExpertise = new Set<string>();
      const allConversationTopics = new Set<string>();
      
      // Collect scores for averaging
      const typeScores: { score: number; responsiveness: number; importance: number }[] = [];
      
      group.forEach(({ candidate, expertType }) => {
        candidate.matching_reasons.forEach(reason => allMatchingReasons.add(reason));
        candidate.areas_of_expertise?.forEach(area => allAreasOfExpertise.add(area));
        candidate.conversation_topics?.forEach(topic => allConversationTopics.add(topic));
        
        typeScores.push({
          score: candidate.relevancy_to_type_score,
          responsiveness: candidate.responsiveness,
          importance: expertType.importance_score
        });
      });
      
      // Calculate weighted average score
      const totalScore = typeScores.reduce(
        (sum, ts) => sum + (ts.score * ts.importance * ts.responsiveness),
        0
      );
      
      // Get average scores for breakdown
      const avgTypeImportance = typeScores.reduce((sum, ts) => sum + ts.importance, 0) / typeScores.length;
      const avgRelevancy = typeScores.reduce((sum, ts) => sum + ts.score, 0) / typeScores.length;
      const avgResponsiveness = typeScores.reduce((sum, ts) => sum + ts.responsiveness, 0) / typeScores.length;
      
      // Use the most recent/complete information
      const latestCandidate = group[group.length - 1].candidate;
      
      return {
        id: uuidv4(),
        name: latestCandidate.name,
        title: latestCandidate.title,
        company: latestCandidate.company,
        linkedin_url: latestCandidate.linkedin_url || baseCandidate.linkedin_url,
        email: latestCandidate.email || baseCandidate.email,
        relevance_score: Math.round(totalScore * 100) / 100,
        matching_reasons: Array.from(allMatchingReasons),
        personalised_message: latestCandidate.personalised_message,
        areas_of_expertise: Array.from(allAreasOfExpertise),
        conversation_topics: Array.from(allConversationTopics),
        // Score breakdown
        type_importance_score: Math.round(avgTypeImportance * 100) / 100,
        relevancy_to_type_score: Math.round(avgRelevancy * 100) / 100,
        responsiveness_score: Math.round(avgResponsiveness * 100) / 100
      };
    });

    // Sort by relevance score (descending)
    experts.sort((a, b) => b.relevance_score - a.relevance_score);

    logger.info({ 
      totalCandidates: allCandidates.length,
      uniqueExperts: experts.length,
      deduplicationRatio: ((allCandidates.length - experts.length) / allCandidates.length * 100).toFixed(1) + '%'
    }, 'Aggregated expert results with LLM deduplication');

    return experts;
  }
}