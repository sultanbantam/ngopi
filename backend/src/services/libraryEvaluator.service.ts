import axios from 'axios';

export interface LiteraryEvaluationResult {
  score: number; // 0 - 100
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  tierLabel: string;
  pointsAwarded: number;
  wordCount: number;
  isSpam: boolean;
  breakdown: {
    substance: number; // max 25
    vocabulary: number; // max 20
    structure: number; // max 20
    coherence: number; // max 20
    depth: number; // max 15
  };
  feedback: string;
  evaluatorMode: 'llm_verified' | 'objective_rubric';
}

const STOP_WORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'untuk', 'dengan', 'pada', 'adalah', 'atau',
  'juga', 'tidak', 'akan', 'dalam', 'saya', 'aku', 'kamu', 'dia', 'mereka', 'kita', 'kami',
  'the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'for', 'with', 'that', 'this',
]);

function mapScoreToPoints(score: number, isChapterOnly = false): {
  points: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  tierLabel: string;
} {
  const multiplier = isChapterOnly ? 0.5 : 1.0;
  if (score >= 90) {
    const raw = 800 + Math.round(((score - 90) / 10) * 700); // 800 - 1500
    return { points: Math.round(raw * multiplier), grade: 'S', tierLabel: 'Karya Istimewa (Masterpiece)' };
  }
  if (score >= 75) {
    const raw = 400 + Math.round(((score - 75) / 14) * 350); // 400 - 750
    return { points: Math.round(raw * multiplier), grade: 'A', tierLabel: 'Sangat Bagus (Unggulan)' };
  }
  if (score >= 55) {
    const raw = 150 + Math.round(((score - 55) / 19) * 200); // 150 - 350
    return { points: Math.round(raw * multiplier), grade: 'B', tierLabel: 'Bagus & Berkualitas' };
  }
  if (score >= 35) {
    const raw = 50 + Math.round(((score - 35) / 19) * 70); // 50 - 120
    return { points: Math.round(raw * multiplier), grade: 'C', tierLabel: 'Layak Baca (Dasar)' };
  }
  return { points: Math.max(0, Math.round((score / 34) * 15 * multiplier)), grade: 'D', tierLabel: 'Perlu Pengembangan' };
}

function computeObjectiveMetrics(params: {
  title: string;
  synopsis: string;
  content: string;
  category: string;
}): {
  score: number;
  isSpam: boolean;
  wordCount: number;
  breakdown: LiteraryEvaluationResult['breakdown'];
  feedback: string;
} {
  const fullText = `${params.synopsis}\n${params.content}`.trim();
  const words = fullText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const wordCount = words.length;
  const uniqueWords = new Set(words);
  const ttr = wordCount > 0 ? uniqueWords.size / wordCount : 0;

  // Anti-spam / gibberish checks
  const hasLongGarbageToken = words.some((w) => w.length > 32 && !w.startsWith('http'));
  const hasExcessiveCharRepeat = /(.)\1{6,}/i.test(fullText);
  const topFreq = (() => {
    const counts = new Map<string, number>();
    for (const w of words) {
      if (!STOP_WORDS.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
    }
    let max = 0;
    for (const c of counts.values()) if (c > max) max = c;
    return max;
  })();
  const spamRatio = wordCount > 20 ? topFreq / wordCount : 0;
  const isSpam =
    wordCount < 15 ||
    hasLongGarbageToken ||
    hasExcessiveCharRepeat ||
    (wordCount >= 30 && ttr < 0.22) ||
    spamRatio > 0.25;

  if (isSpam) {
    return {
      score: 10,
      isSpam: true,
      wordCount,
      breakdown: { substance: 2, vocabulary: 2, structure: 2, coherence: 2, depth: 2 },
      feedback:
        'Tulisan terdeteksi terlalu singkat, repetitif, atau tidak memenuhi standar minimum kualitas naskah. Tambahkan isi yang substantif dan bervariasi.',
    };
  }

  // 1. Substance & Length (max 25)
  let substance = 4;
  if (wordCount >= 1200) substance = 25;
  else if (wordCount >= 800) substance = 22;
  else if (wordCount >= 500) substance = 19;
  else if (wordCount >= 300) substance = 15;
  else if (wordCount >= 150) substance = 11;
  else if (wordCount >= 60) substance = 7;

  // 2. Vocabulary Diversity (max 20) — calibrated by length (longer texts naturally have lower raw TTR)
  const expectedTtr = wordCount > 800 ? 0.38 : wordCount > 300 ? 0.48 : 0.6;
  const vocabRatio = Math.min(1.15, ttr / expectedTtr);
  const vocabulary = Math.max(4, Math.min(20, Math.round(vocabRatio * 17)));

  // 3. Structure: paragraphs & sentence variety (max 20)
  const paragraphs = params.content
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  const sentences = fullText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
  const avgSentenceLen = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  let structure = 5;
  if (paragraphs.length >= 5) structure += 8;
  else if (paragraphs.length >= 3) structure += 5;
  else if (paragraphs.length >= 2) structure += 3;
  if (sentences.length >= 6 && avgSentenceLen >= 8 && avgSentenceLen <= 28) structure += 7;
  else if (sentences.length >= 3) structure += 4;
  structure = Math.min(20, structure);

  // 4. Coherence between title/synopsis and body (max 20)
  const titleTokens = new Set(
    `${params.title} ${params.synopsis}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t))
  );
  let overlapCount = 0;
  for (const tok of titleTokens) {
    if (uniqueWords.has(tok)) overlapCount++;
  }
  const coherenceRatio = titleTokens.size > 0 ? overlapCount / Math.min(8, titleTokens.size) : 0.5;
  const coherence = Math.max(6, Math.min(20, Math.round(coherenceRatio * 20)));

  // 5. Narrative / Analytical Depth (max 15)
  const discourseMarkers = [
    'namun', 'tetapi', 'karena', 'sebab', 'sehingga', 'meskipun', 'walaupun', 'ketika', 'akhirnya',
    'sebenarnya', 'bayangkan', 'menurut', 'artinya', 'seperti', 'bagaikan', 'ternyata', 'oleh karena',
    'however', 'because', 'therefore', 'although', 'meanwhile',
  ];
  const lowerFull = fullText.toLowerCase();
  const markerHits = discourseMarkers.filter((m) => lowerFull.includes(m)).length;
  const hasDialogueOrQuotes = /["“”«»]/.test(params.content);
  let depth = Math.min(10, markerHits * 2 + 2);
  if (hasDialogueOrQuotes) depth = Math.min(15, depth + 3);
  if (params.category === 'puisi' && paragraphs.length >= 4) depth = Math.min(15, depth + 4);
  depth = Math.max(4, Math.min(15, depth));

  const score = Math.max(15, Math.min(100, substance + vocabulary + structure + coherence + depth));

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (substance >= 19) strengths.push('kedalaman & panjang naskah kuat');
  else improvements.push('perluas narasi/pembahasan (>300-800 kata) untuk tier lebih tinggi');

  if (vocabulary >= 16) strengths.push('diksi kaya & tidak repetitif');
  else improvements.push('variasikan pilihan kata');

  if (structure >= 15) strengths.push('struktur paragraf & ritme kalimat rapi');
  else improvements.push('pecah tulisan menjadi beberapa paragraf yang terstruktur');

  const feedback = [
    strengths.length > 0 ? `Kelebihan: ${strengths.join(', ')}.` : null,
    improvements.length > 0 ? `Saran AI: ${improvements.join('; ')}.` : 'Kualitas sangat baik dan siap dibaca komunitas!',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    score,
    isSpam: false,
    wordCount,
    breakdown: { substance, vocabulary, structure, coherence, depth },
    feedback,
  };
}

export async function evaluateLiteraryWork(params: {
  title: string;
  synopsis: string;
  content: string;
  category: string;
  isChapterOnly?: boolean;
}): Promise<LiteraryEvaluationResult> {
  const objective = computeObjectiveMetrics(params);

  let finalScore = objective.score;
  let finalFeedback = objective.feedback;
  let evaluatorMode: 'llm_verified' | 'objective_rubric' = 'objective_rubric';

  // Optional LLM cross-evaluation if GEMINI_API_KEY or OPENAI_API_KEY is configured on VPS
  // Objective cap prevents LLM hallucination on short/spam submissions
  if (!objective.isSpam && (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)) {
    try {
      const prompt = [
        'Anda adalah kurator sastra & editor objektif di Ngopi Pustaka. Jangan melebih-lebihkan nilai.',
        'Nilai naskah berikut secara ketat (0-100) berdasarkan orisinalitas, kedalaman gagasan, keindahan/kejelasan bahasa, dan daya tarik pembaca.',
        'Balas HANYA JSON valid: {"score": number, "feedback": "ringkas 1-2 kalimat bahasa Indonesia"}',
        `Kategori: ${params.category}`,
        `Judul: ${params.title}`,
        `Sinopsis: ${params.synopsis}`,
        `Isi (potongan maks 4000 karakter):\n${params.content.slice(0, 4000)}`,
      ].join('\n');

      let llmScore: number | null = null;
      let llmFeedback: string | null = null;

      if (process.env.OPENAI_API_KEY) {
        const res = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }],
          },
          { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 10000 }
        );
        const text = String(res.data?.choices?.[0]?.message?.content || '');
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.score === 'number') llmScore = parsed.score;
          if (typeof parsed.feedback === 'string') llmFeedback = parsed.feedback;
        }
      } else if (process.env.GEMINI_API_KEY) {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 },
          },
          { timeout: 10000 }
        );
        const text = String(res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.score === 'number') llmScore = parsed.score;
          if (typeof parsed.feedback === 'string') llmFeedback = parsed.feedback;
        }
      }

      if (llmScore !== null && Number.isFinite(llmScore)) {
        // Blend 60% LLM + 40% objective rubric, capped so short/thin text cannot score unfairly high
        const clampedLlm = Math.max(0, Math.min(100, llmScore));
        const maxAllowedByLength = objective.wordCount < 100 ? 55 : objective.wordCount < 250 ? 78 : 100;
        finalScore = Math.min(maxAllowedByLength, Math.round(clampedLlm * 0.6 + objective.score * 0.4));
        if (llmFeedback) finalFeedback = llmFeedback.trim();
        evaluatorMode = 'llm_verified';
      }
    } catch {
      // Fall back silently to objective rubric
    }
  }

  const mapped = mapScoreToPoints(finalScore, Boolean(params.isChapterOnly));
  return {
    score: finalScore,
    grade: mapped.grade,
    tierLabel: mapped.tierLabel,
    pointsAwarded: objective.isSpam ? 0 : mapped.points,
    wordCount: objective.wordCount,
    isSpam: objective.isSpam,
    breakdown: objective.breakdown,
    feedback: finalFeedback,
    evaluatorMode,
  };
}
