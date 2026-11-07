import { AiProvider } from '../ai/types';
import { VASTU_SYSTEM_PROMPT } from '../ai/vastuSystemPrompt';
import { PropertyProfile, RoomAnalysis } from '../types/vastu';
import { analyzeProperty, buildGenericChecklist, DATASET_VERSION, RULE_ENGINE_VERSION } from './knowledgeEngine';

function buildStaticExplanation(analyses: RoomAnalysis[], missingCount: number): string {
  if (analyses.length === 0) {
    return 'No room directions were provided yet, so no direction-specific guidance is available. Add at least one room direction to get started.';
  }
  const favorable = analyses.filter((a) => a.alignment === 'favorable').length;
  const cautioned = analyses.filter((a) => a.alignment === 'traditionally-cautioned').length;

  let summary = `Based on the ${analyses.length} room${analyses.length > 1 ? 's' : ''} you provided, `;
  if (favorable > 0) summary += `${favorable} align${favorable === 1 ? 's' : ''} with commonly favorable traditional placements. `;
  if (cautioned > 0) summary += `${cautioned} room${cautioned > 1 ? 's are' : ' is'} in a direction some traditions suggest reconsidering, though this varies by school and is not a structural concern. `;
  if (missingCount > 0) summary += `${missingCount} room direction${missingCount > 1 ? 's were' : ' was'} not provided, so this is a partial assessment.`;
  return summary.trim();
}

function looksLikeRealAnswer(text: string): boolean {
  if (text.trim().length < 8) return false;
  if (text.includes('<') || text.includes('>')) return false;
  if (text.includes('[mock reply]')) return false;
  if (text.includes('Write a')) return false; // our own instruction text echoed back
  return true;
}

async function generateExplanation(
  analyses: RoomAnalysis[],
  missingCount: number,
  propertyType: string,
  aiProvider: AiProvider
): Promise<{ text: string; source: 'ai' | 'static-fallback' }> {
  const staticText = buildStaticExplanation(analyses, missingCount);
  if (analyses.length === 0) return { text: staticText, source: 'static-fallback' };

  try {
    const roomLines = analyses
      .map((a) => `${a.roomLabel}: facing ${a.direction} (${a.alignment}). ${a.guidance}`)
      .join('\n');
    const prompt =
      `Property type: ${propertyType}\nRooms analyzed:\n${roomLines}\n` +
      (missingCount > 0 ? `${missingCount} room(s) were not provided.\n` : '') +
      `Write a warm, 3-5 sentence overall summary of this property's traditional Vastu alignment. ` +
      `Do not invent any room or direction not listed above. Do not recommend purchases or rituals as necessary.`;

    const raw = await aiProvider.complete([
      { role: 'system', content: VASTU_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);

    if (looksLikeRealAnswer(raw)) return { text: raw.trim(), source: 'ai' };
  } catch (err) {
    console.warn('[vastu] AI explanation failed, using static fallback:', err);
  }

  return { text: staticText, source: 'static-fallback' };
}

export async function buildVastuReportContent(profile: PropertyProfile, aiProvider: AiProvider) {
  const { analyses, missingRooms } = analyzeProperty(profile);
  const checklist = buildGenericChecklist(analyses).map((item) => ({ ...item, completed: false }));
  const { text: explanation, source: explanationSource } = await generateExplanation(
    analyses, missingRooms.length, profile.propertyType, aiProvider
  );

  return {
    datasetVersion: DATASET_VERSION,
    ruleEngineVersion: RULE_ENGINE_VERSION,
    propertyType: profile.propertyType,
    confirmedRoomCount: analyses.length,
    missingRooms,
    completeness: (missingRooms.length === 0 ? 'full' : 'partial') as 'full' | 'partial',
    roomAnalyses: analyses,
    checklist,
    explanation,
    explanationSource,
    generationStatus: 'ready' as const,
  };
}
