export type Question = {
  id: string;
  number: string;
  question: string;
  answer: string;
  points: number;
};

export type PerQuestionResult = {
  number: string;
  recognized_answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  feedback: string;
};

export type GradeResponse = {
  per_question: PerQuestionResult[];
  total_score: number;
  total_max: number;
  overall_feedback: string;
};

export type OcrResponse = {
  raw_text: string;
  overall_confidence: 'high' | 'medium' | 'low';
  notes: string;
};
