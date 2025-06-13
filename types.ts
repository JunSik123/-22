
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string; // ISO date string
}

export interface FileSection {
  id: string; // e.g., `section-${Date.now()}`
  name: string;
  content: string;
  startPage: number; // 1-indexed, 0 for AI-generated content-only sections
  endPage: number;   // 1-indexed, 0 for AI-generated content-only sections
  isAiGenerated?: boolean; // Optional flag
}

export interface FileData {
  id: string;
  name: string;
  folderId: string | null;
  extractedText: string;
  structuredText: PageContent[]; // Array of page content objects
  firstPageImageBase64: string | null; // Base64 encoded image of the first page
  pdfRawData?: ArrayBuffer; // Raw PDF data for rendering specific pages
  createdAt: string; // ISO date string
  fileType?: string; // e.g. "application/pdf"
  sections?: FileSection[]; // Array of defined sections
  isJokbo?: boolean; // New field: true if this file is a Jokbo
  associatedJokboFileId?: string | null; // New field: for Gyoan files, ID of the associated Jokbo file
}

export interface PageContent {
  pageNum: number;
  text: string;
}

export enum QuestionType {
  MULTIPLE_CHOICE = "multiple-choice",
  OX = "ox",
  SELECT_ALL = "select-all",
  SHORT_ANSWER = "short-answer"
}

export interface Question {
  id?: string; // Optional, used for notes
  questionText: string;
  questionType: QuestionType;
  options: string[]; // Empty for SHORT_ANSWER
  correctAnswer: string; // For multiple-choice/OX, it's the value. For select-all, it's a comma-separated string (actually SAP_DELIMITER separated full text). For short-answer, it's the direct answer string.
  explanation: string; // Main explanation for the correct answer / overall concept
  incorrectOptionExplanations?: Record<string, string>; // Key: Full text of an INCORRECT option, Value: Explanation why it's incorrect
  fileContextId?: string; // ID of the file this question relates to
  pageNum?: number; // Page number in the source PDF (ABSOLUTE page number)
  originalQuestionId?: string; // For retry quizzes, to link back to the original note
}

export type RecallLevel = 'again' | 'hard' | 'good' | 'easy';

export const RECALL_LEVEL_OPTIONS: { level: RecallLevel; label: string; color: string; darkColor: string }[] = [
    { level: 'again', label: '까먹음', color: 'bg-red-500 hover:bg-red-600', darkColor: 'dark:bg-red-600 dark:hover:bg-red-700' },
    { level: 'hard', label: '어려움', color: 'bg-orange-500 hover:bg-orange-600', darkColor: 'dark:bg-orange-600 dark:hover:bg-orange-700' },
    { level: 'good', label: '보통', color: 'bg-yellow-500 hover:bg-yellow-600', darkColor: 'dark:bg-yellow-500 dark:hover:bg-yellow-600' },
    { level: 'easy', label: '쉬움', color: 'bg-green-500 hover:bg-green-600', darkColor: 'dark:bg-green-600 dark:hover:bg-green-700' },
];


export interface IncorrectNote extends Question {
  id: string; // Firestore ID or locally generated unique ID
  userAnswer: string | string[] | null; // string for SHORT_ANSWER
  timestamp: string; // ISO date string
  sectionId?: string | undefined; // ID of the section if the question originated from a section (can be AI section name)
  sourceName?: string; // Display name of the source (file name, "족보", etc.) for PDF export.
  // SRS Fields
  nextReviewAt?: string; // ISO datetime string
  lastReviewedAt?: string; // ISO datetime string
  srsLevel?: number; // Simple level: 0 (new/failed), 1 (learning), 2 (young), 3+ (mature)
}

// Initially, ShortAnswerIncorrectNote will be structurally the same as IncorrectNote.
// It can be specialized later if specific fields or behaviors are needed.
export type ShortAnswerIncorrectNote = IncorrectNote;


export interface DeepDiveAnalysis {
  diagnosis: string;
  detailedSummary: string;
  inDepthLearningPoints: Array<{
    conceptName: string;
    details: string;
  }>;
  recommendedQuestions: Question[];
  trickQuestions: Question[];
  originalSourcePageGuess?: number; // AI's best guess for the original PDF page number
  plausibleDistractors?: Array<{ // Added new field
    optionText: string;
    explanation: string;
  }>;
}

export interface FillInBlankItem {
  blankQuestion: string;
  answer: string;
}

export type AiToolExplanationType = string | FillInBlankItem[];

export interface CorrectiveFeedbackContent {
  originalNote: IncorrectNote;
  aiFeedbackText: string;
  practiceQuestion?: Question;
}


export type View = 
  | 'fileManager' 
  | 'dashboard' 
  | 'quiz' 
  | 'retryQuiz'
  | 'results' 
  | 'notes' 
  | 'shortAnswerNotes' 
  | 'selectAllNotes' // New view for "Select All" type incorrect notes
  | 'analysis' 
  | 'deepDive' 
  | 'deepDiveQuiz'
  | 'aiToolExplanation'
  | 'correctiveFeedback'
  | 'jokboSimulatedNotes'; 

export type Difficulty = '쉬움' | '보통' | '어려움' | '매우 어려움';

export type SortCriteria = 'name' | 'date-newest' | 'date-oldest';

export interface NavItemConfig {
  view: View;
  label: string;
  IconComponent: React.FC<React.SVGProps<SVGSVGElement>>;
}

// This type is specific to the Gemini API schema for question generation
export interface GeminiQuestionSchemaItem {
  questionText: string;
  questionType: "multiple-choice" | "ox" | "select-all" | "short-answer";
  options: string[]; // Will be empty or not present for "short-answer"
  correctAnswer: string;
  explanation: string;
  incorrectOptionExplanations?: Record<string, string>; // Key: Full text of incorrect option, Value: Explanation why it's incorrect
  pageNum?: number; // 1-indexed page number relative to the provided source text snippet
}

export interface GeminiFillInBlankSchemaItem {
    blankQuestion: string;
    answer: string;
}

export interface GeminiDeepDiveSchema {
    diagnosis: string;
    detailedSummary: string;
    inDepthLearningPoints: Array<{
        conceptName: string;
        details: string;
    }>;
    recommendedQuestions: GeminiQuestionSchemaItem[];
    trickQuestions: GeminiQuestionSchemaItem[];
    originalSourcePageGuess?: number; // AI's best guess for the original PDF page number
    plausibleDistractors?: Array<{ 
        optionText: string;
        explanation: string;
    }>;
}

export interface GeminiAiSectionSchemaItem {
  name: string;
  content: string;
}

export interface GeminiCorrectiveFeedbackSchema {
  aiFeedbackText: string;
  practiceQuestion?: GeminiQuestionSchemaItem;
}

export interface GeminiNoteClassificationSchema {
  [categoryName: string]: string[]; // Key: category name (e.g., "고혈압 약물"), Value: array of note IDs
}

export interface TopicWeakness {
  topicName: string;
  incorrectCount: number;
  specificSubTopics?: string[];
  potentialReasons?: string[];
  relatedKeywords?: string[];
}

export interface GeminiTopicWeaknessSchemaItem {
  topicName: string;
  incorrectCount: number;
  specificSubTopics?: string[];
  potentialReasons?: string[];
  relatedKeywords?: string[];
}

export interface LearningPathwayStep {
  id: string;
  stepTitle: string;
  rootCauseDiagnosis: string;
  learningObjective: string;
  suggestedAction: string;
  aiGeneratedContent_SummaryOrKeywords?: string;
  aiGeneratedPracticeQuestions?: Question[];
}

export interface GeminiLearningPathwayStepSchemaItem {
  stepTitle: string;
  rootCauseDiagnosis: string;
  learningObjective: string;
  suggestedAction: string;
  aiGeneratedContent_SummaryOrKeywords?: string;
  aiGeneratedPracticeQuestions?: GeminiQuestionSchemaItem[];
}


// For Data Export/Import
export interface AppSettings {
  theme: 'light' | 'dark';
  fontSize: number;
  numQuestions: number;
  difficulty: Difficulty;
  sortCriteria: SortCriteria;
}

// Reflects the structure of files when exported (omitting large binary data)
export interface ExportedFileData extends Omit<FileData, 'firstPageImageBase64' | 'pdfRawData'> {}

export interface ExportedAppData {
  version: string; // To handle future data structure changes
  timestamp: string; // ISO date string of export
  data: {
    folders: Folder[];
    files: ExportedFileData[]; // Use ExportedFileData
    incorrectAnswerNotes: IncorrectNote[]; 
    shortAnswerIncorrectNotes?: ShortAnswerIncorrectNote[];
    selectAllIncorrectNotes?: IncorrectNote[]; // New: For select-all type incorrect notes
    jokboSimulatedIncorrectNotes?: IncorrectNote[]; 
    settings: AppSettings;
    chatMessagesByFileId?: Record<string, ChatMessage[]>; 
    topicWeaknessAnalysis?: Record<string, TopicWeakness[]>; 
    learningPathways?: Record<string, LearningPathwayStep[]>;
  };
}

export type ActiveQuizContext =
  | { type: 'fullFile'; fileId: string; fileName: string; isJokboOrigin?: boolean; associatedJokboFileId?: string | null } 
  | { type: 'jokbo'; fileId: string; fileName: string; } // Represents a quiz directly from a Jokbo file
  | { type: 'jokbo_simulated_exam'; fileId: string; fileName: string; } // Quiz from AI generating similar questions based on a Jokbo
  | { type: 'section'; fileId: string; sectionId: string; sectionName: string; sectionStartPage: number; isAiSection: boolean; associatedJokboFileId?: string | null; }
  | { type: 'targetedPractice'; fileId: string; fileName: string; isJokboOrigin?: boolean; associatedJokboFileId?: string | null; };

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isLoading?: boolean; // For AI messages while waiting for response
  error?: string; // To display an error message for a specific AI response
}

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
export const SAP_DELIMITER = '###SAP###';

export const formatSAPDelimitedAnswer = (sapAnswer: string): string => {
  if (!sapAnswer) return "정보 없음";
  return sapAnswer.split(SAP_DELIMITER).filter(s => s.trim() !== "").join(', ');
};

export const formatDate = (isoString?: string): string => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    return '날짜 오류';
  }
};
