
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, FileData, Question, IncorrectNote, ShortAnswerIncorrectNote, View, Difficulty, PageContent, DeepDiveAnalysis, AiToolExplanationType, SortCriteria, QuestionType, FillInBlankItem, AppSettings, ExportedAppData, FileSection, CorrectiveFeedbackContent, ActiveQuizContext, ChatMessage, OPTION_LETTERS, SAP_DELIMITER, GeminiNoteClassificationSchema, TopicWeakness, LearningPathwayStep, RecallLevel } from './types';
import { XCircleIcon, PDF_JS_VERSION, Edit3Icon, TrashIcon, CornerDownRightIcon, ClipboardListIcon, LinkIcon } from './constants'; 
import AppHeader from './components/AppHeader';
import FileManagerView from './components/FileManagerView';
import DashboardView from './components/DashboardView';
import QuizView from './components/QuizView';
import ResultsView from './components/ResultsView';
import IncorrectAnswerNoteView from './components/IncorrectAnswerNoteView';
import LearningAnalysisView from './components/LearningAnalysisView';
import AiToolExplanationView from './components/AiToolExplanationView';
import DeepDiveView from './components/DeepDiveView';
import DeepDiveQuizView from './components/DeepDiveQuizView';
import Modal from './components/Modal';
import ManageSectionsModal from './components/ManageSectionsModal';
import { ShortAnswerNoteView } from './components/ShortAnswerNoteView'; 
import CorrectiveFeedbackView from './components/CorrectiveFeedbackView'; 
import MoveFileModal from './components/MoveFileModal';
import AssociateJokboModal from './components/AssociateJokboModal';
import { JokboSimulatedIncorrectAnswerNoteView } from './components/JokboSimulatedIncorrectAnswerNoteView'; 
import { SelectAllIncorrectAnswerNoteView } from './components/SelectAllIncorrectAnswerNoteView'; // New import
import MoveNoteModal, { NoteCategoryType } from './components/MoveNoteModal';


import { generateQuizQuestionsSdk, fetchDeepDiveAnalysisSdk, performAiToolActionSdk, generateLearningGuideSdk, generateAsciiConceptMapSdk, generateSectionsSdk, generateCorrectiveFeedbackSdk, generateTargetedQuizFromWeaknessesSdk, answerQuestionFromDocumentSdk, classifyIncorrectNotesSdk, generateTtsScriptForWeaknessesSdk, checkShortAnswerCorrectnessSdk, checkSelectAllCorrectnessSdk, analyzeTopicWeaknessesSdk, getStudyAdviceSdk, generateSimilarJokboQuestionsSdk, generateLearningPathwaySdk } from './services/geminiService';


declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const APP_DATA_VERSION = "1.0.11"; 
const MIN_COMPATIBLE_VERSION = "1.0.8"; // Minimum version this app can reliably load/import
const LOCAL_STORAGE_KEY = 'aiLearningCompanionData';
const MAX_NOTES_FOR_CLASSIFICATION = 50;
const MAX_NOTES_FOR_TOPIC_ANALYSIS = 50;
const MAX_NOTES_FOR_PATHWAY_GENERATION = 20;
const GLOBAL_ADVICE_CHAT_KEY = "global_study_advice_chat";


interface StoredAppData {
  appVersion: string;
  folders: Folder[];
  files: Omit<FileData, 'pdfRawData' | 'firstPageImageBase64'>[]; 
  currentFolderId: string | null;
  selectedFileId: string | null;
  incorrectAnswerNotes: IncorrectNote[]; 
  shortAnswerIncorrectNotes?: ShortAnswerIncorrectNote[]; 
  selectAllIncorrectNotes?: IncorrectNote[]; 
  jokboSimulatedIncorrectNotes?: IncorrectNote[]; 
  settings: AppSettings & { activeView: View, retryQuizOrder?: 'random' | 'original' }; // Added retryQuizOrder
  learningGuides?: Record<string, string>; 
  conceptMaps?: Record<string, string>; 
  chatMessagesByFileId?: Record<string, ChatMessage[]>; 
  ttsScripts?: Record<string, string>; 
  topicWeaknessAnalysis?: Record<string, TopicWeakness[]>; 
  learningPathways?: Record<string, LearningPathwayStep[]>;
}


const jsonReplacer = (key: string, value: any) => {
  if (value instanceof ArrayBuffer) {
    return { type: 'ArrayBuffer', data: Array.from(new Uint8Array(value)) };
  }
  return value;
};

const jsonReviver = (key: string, value: any) => {
  if (typeof value === 'object' && value !== null && value.type === 'ArrayBuffer' && Array.isArray(value.data)) {
    return new Uint8Array(value.data).buffer;
  }
  return value;
};

// Helper function to compare semantic versions (e.g., "1.0.10" vs "1.0.8")
// Returns:
//   > 0 if v1 > v2
//   < 0 if v1 < v2
//   0 if v1 == v2
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(s => parseInt(s, 10));
  const parts2 = v2.split('.').map(s => parseInt(s, 10));
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0; // Treat missing parts (e.g. "1.0" vs "1.0.1") as 0
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}


function App() {
  const [isPdfJsReady, setIsPdfJsReady] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileData[]>([]); 
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);

  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('보통');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string | string[] | null>>({});
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false);
  const [activeQuizContext, setActiveQuizContext] = useState<ActiveQuizContext | null>(null);
  const [quizScore, setQuizScore] = useState<number>(0); 


  const [incorrectAnswerNotes, setIncorrectAnswerNotes] = useState<IncorrectNote[]>([]);
  const [shortAnswerIncorrectNotes, setShortAnswerIncorrectNotes] = useState<ShortAnswerIncorrectNote[]>([]);
  const [selectAllIncorrectNotes, setSelectAllIncorrectNotes] = useState<IncorrectNote[]>([]); 
  const [jokboSimulatedIncorrectNotes, setJokboSimulatedIncorrectNotes] = useState<IncorrectNote[]>([]); 


  const [activeView, setActiveView] = useState<View>('fileManager');
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [isLoadingAiSections, setIsLoadingAiSections] = useState<boolean>(false); 
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [fontSize, setFontSize] = useState<number>(16);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name');
  const [retryQuizOrder, setRetryQuizOrder] = useState<'random' | 'original'>('random');


  const [currentDeepDiveQuestion, setCurrentDeepDiveQuestion] = useState<IncorrectNote | null>(null);
  const [currentSolvingQuestion, setCurrentSolvingQuestion] = useState<Question | null>(null);
  const [deepDiveContent, setDeepDiveContent] = useState<DeepDiveAnalysis | null>(null);
  const [correctiveFeedbackContent, setCorrectiveFeedbackContent] = useState<CorrectiveFeedbackContent | null>(null);
  const [previousViewForDeepDive, setPreviousViewForDeepDive] = useState<View | null>(null);


  const [chatMessagesByFileId, setChatMessagesByFileId] = useState<Record<string, ChatMessage[]>>({});
  const [isChatbotLoading, setIsChatbotLoading] = useState<boolean>(false); 

  const [aiToolExplanation, setAiToolExplanation] = useState<AiToolExplanationType | null>(null);
  const [currentAiToolName, setCurrentAiToolName] = useState<string>('');
  const [learningGuides, setLearningGuides] = useState<Record<string, string>>({});
  const [conceptMaps, setConceptMaps] = useState<Record<string, string>>({});
  const [loadingAiToolFileId, setLoadingAiToolFileId] = useState<string | null>(null);
  const [loadingTargetedQuizFileId, setLoadingTargetedQuizFileId] = useState<string | null>(null);
  const [aiSuggestedSections, setAiSuggestedSections] = useState<FileSection[]>([]);
  const [ttsScripts, setTtsScripts] = useState<Record<string, string>>({});
  const [loadingTtsScriptFileId, setLoadingTtsScriptFileId] = useState<string | null>(null);
  const [topicWeaknessAnalysis, setTopicWeaknessAnalysis] = useState<Record<string, TopicWeakness[]>>({});
  const [loadingTopicAnalysisFileId, setLoadingTopicAnalysisFileId] = useState<string | null>(null);
  const [learningPathways, setLearningPathways] = useState<Record<string, LearningPathwayStep[] | undefined>>({});
  const [loadingLearningPathwayFileId, setLoadingLearningPathwayFileId] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string; body: React.ReactNode; actions?: React.ReactNode }>({ title: '', body: ''});
  const [isManageSectionsModalOpen, setIsManageSectionsModalOpen] = useState(false);
  const [isFileMoveModalOpen, setIsFileMoveModalOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileData | null>(null);
  const [isAssociateJokboModalOpen, setIsAssociateJokboModalOpen] = useState(false); 
  const [fileToAssociateJokboWith, setFileToAssociateJokboWith] = useState<FileData | null>(null); 
  const [isMoveNoteModalOpen, setIsMoveNoteModalOpen] = useState(false);
  const [noteToMoveDetails, setNoteToMoveDetails] = useState<{ note: IncorrectNote; currentCategory: NoteCategoryType } | null>(null);


  const [classifiedGeneralNotes, setClassifiedGeneralNotes] = useState<Record<string, IncorrectNote[]> | null>(null);
  const [classifiedShortAnswerNotes, setClassifiedShortAnswerNotes] = useState<Record<string, ShortAnswerIncorrectNote[]> | null>(null);
  const [classifiedSelectAllNotes, setClassifiedSelectAllNotes] = useState<Record<string, IncorrectNote[]> | null>(null); 
  const [classifiedJokboSimulatedNotes, setClassifiedJokboSimulatedNotes] = useState<Record<string, IncorrectNote[]> | null>(null); 
  const [isClassifyingGeneralNotes, setIsClassifyingGeneralNotes] = useState<boolean>(false);
  const [isClassifyingShortAnswerNotes, setIsClassifyingShortAnswerNotes] = useState<boolean>(false);
  const [isClassifyingSelectAllNotes, setIsClassifyingSelectAllNotes] = useState<boolean>(false); 
  const [isClassifyingJokboSimulatedNotes, setIsClassifyingJokboSimulatedNotes] = useState<boolean>(false); 

  const [generalNoteFileFilter, setGeneralNoteFileFilter] = useState<string>('');
  const [generalNoteSectionFilter, setGeneralNoteSectionFilter] = useState<string>('');
  const [shortAnswerNoteFileFilter, setShortAnswerNoteFileFilter] = useState<string>('');
  const [shortAnswerNoteSectionFilter, setShortAnswerNoteSectionFilter] = useState<string>('');
  const [selectAllNoteFileFilter, setSelectAllNoteFileFilter] = useState<string>(''); 
  const [selectAllNoteSectionFilter, setSelectAllNoteSectionFilter] = useState<string>(''); 
  const [jokboSimulatedNoteFileFilter, setJokboSimulatedNoteFileFilter] = useState<string>(''); 


  const pdfJsWorkerBlobUrl = useRef<string | null>(null);
  const importDataInputRef = useRef<HTMLInputElement>(null);
  const previousSelectedFileIdRef = useRef<string | null | undefined>(undefined);


  useEffect(() => {
    const savedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedDataString) {
      try {
        const loadedData = JSON.parse(savedDataString, jsonReviver) as StoredAppData;
        let shouldLoadData = false;

        if (loadedData.appVersion) {
            const comparisonWithApp = compareVersions(loadedData.appVersion, APP_DATA_VERSION);
            const comparisonWithMin = compareVersions(loadedData.appVersion, MIN_COMPATIBLE_VERSION);

            if (comparisonWithApp > 0) {
                console.warn(`localStorage data version (${loadedData.appVersion}) is newer than app version (${APP_DATA_VERSION}). Resetting data.`);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            } else if (comparisonWithMin < 0) {
                console.warn(`localStorage data version (${loadedData.appVersion}) is older than min compatible version (${MIN_COMPATIBLE_VERSION}). Resetting data.`);
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            } else {
                shouldLoadData = true; // Version is compatible
            }
        } else {
            console.warn(`localStorage data has no version info. Resetting data.`);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
        
        if (shouldLoadData) {
          setFolders(loadedData.folders || []);
          
          const loadedFiles: FileData[] = (loadedData.files || []).map(fStorage => ({
            id: fStorage.id,
            name: fStorage.name,
            folderId: fStorage.folderId,
            extractedText: fStorage.extractedText,
            structuredText: fStorage.structuredText,
            firstPageImageBase64: null, 
            pdfRawData: undefined, 
            createdAt: fStorage.createdAt,
            fileType: fStorage.fileType,
            sections: fStorage.sections || [],
            isJokbo: fStorage.isJokbo === undefined ? false : fStorage.isJokbo,
            associatedJokboFileId: fStorage.associatedJokboFileId === undefined ? null : fStorage.associatedJokboFileId,
          }));
          setFiles(loadedFiles);

          setCurrentFolderId(loadedData.currentFolderId || null);
          setIncorrectAnswerNotes((loadedData.incorrectAnswerNotes || []).map(n => ({...n, srsLevel: n.srsLevel || 0 })) );
          setShortAnswerIncorrectNotes((loadedData.shortAnswerIncorrectNotes || []).map(n => ({...n, srsLevel: n.srsLevel || 0 }))); 
          setSelectAllIncorrectNotes((loadedData.selectAllIncorrectNotes || []).map(n => ({...n, srsLevel: n.srsLevel || 0 }))); 
          setJokboSimulatedIncorrectNotes((loadedData.jokboSimulatedIncorrectNotes || []).map(n => ({...n, srsLevel: n.srsLevel || 0 }))); 
          setLearningGuides(loadedData.learningGuides || {});
          setConceptMaps(loadedData.conceptMaps || {});
          setChatMessagesByFileId(loadedData.chatMessagesByFileId || {}); 
          setTtsScripts(loadedData.ttsScripts || {}); 
          setTopicWeaknessAnalysis(loadedData.topicWeaknessAnalysis || {});
          setLearningPathways(loadedData.learningPathways || {});

          if (loadedData.settings) {
            setTheme(loadedData.settings.theme || 'dark');
            setFontSize(loadedData.settings.fontSize || 16);
            setNumQuestions(loadedData.settings.numQuestions || 10);
            setDifficulty(loadedData.settings.difficulty || '보통');
            setSortCriteria(loadedData.settings.sortCriteria || 'name');
            setActiveView(loadedData.settings.activeView || 'fileManager');
            setRetryQuizOrder(loadedData.settings.retryQuizOrder || 'random');
          }

          if (loadedData.selectedFileId && loadedFiles.length > 0) {
            const foundFile = loadedFiles.find(f => f.id === loadedData.selectedFileId);
            if (foundFile) {
              setSelectedFile(foundFile);
            }
          }
           setSuccessMessage('이전에 저장된 작업 내용 불러오기 완료!');
        }
      } catch (error) {
        console.error("Error loading data from localStorage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY); 
      }
    }
  }, []);

  useEffect(() => {
    const filesForStorage = files.map(file => {
      const { pdfRawData, firstPageImageBase64, ...restOfFile } = file; 
      return restOfFile; 
    });

    const dataToSave: StoredAppData = {
      appVersion: APP_DATA_VERSION,
      folders,
      files: filesForStorage, 
      currentFolderId,
      selectedFileId: selectedFile ? selectedFile.id : null,
      incorrectAnswerNotes,
      shortAnswerIncorrectNotes,
      selectAllIncorrectNotes, 
      jokboSimulatedIncorrectNotes, 
      settings: {
        theme,
        fontSize,
        numQuestions,
        difficulty,
        sortCriteria,
        activeView,
        retryQuizOrder,
      },
      learningGuides,
      conceptMaps,
      chatMessagesByFileId,
      ttsScripts, 
      topicWeaknessAnalysis,
      learningPathways,
    };
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
        console.error("Error saving data to localStorage:", error);
        if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
           setErrorMessage("로컬 저장 공간 부족. 데이터 저장에 실패했습니다. 오래된 데이터를 삭제하거나 브라우저 설정을 확인해주세요.");
        } else {
           setErrorMessage("데이터를 로컬에 저장하는 중 일반 오류 발생.");
        }
    }
  }, [
    folders, files, currentFolderId, selectedFile, 
    incorrectAnswerNotes, shortAnswerIncorrectNotes, selectAllIncorrectNotes, jokboSimulatedIncorrectNotes, 
    theme, fontSize, numQuestions, difficulty, sortCriteria, activeView, retryQuizOrder,
    learningGuides, conceptMaps, chatMessagesByFileId, ttsScripts, topicWeaknessAnalysis, learningPathways
  ]);


  const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  const increaseFontSize = () => setFontSize(prevSize => Math.min(prevSize + 2, 24));
  const decreaseFontSize = () => setFontSize(prevSize => Math.max(prevSize - 2, 12));

useEffect(() => {
    const setupPdfJsWorkerOnly = async () => {
        if (!window.pdfjsLib || !window.pdfjsLib.GlobalWorkerOptions) {
            console.error('window.pdfjsLib is not available. Ensure pdf.min.js is loaded correctly via index.html.');
            setErrorMessage('PDF 라이브러리 (pdf.min.js) 로딩 또는 초기화 실패.');
            setIsPdfJsReady(false);
            return;
        }

        try {
            const workerSrcUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.worker.min.js`;
            const response = await fetch(workerSrcUrl);
            if (!response.ok) throw new Error(`Failed to fetch PDF.js worker: ${response.statusText} (${response.status})`);
            const workerJs = await response.text();
            const blob = new Blob([workerJs], { type: 'application/javascript' });
            
            if (pdfJsWorkerBlobUrl.current) { 
                URL.revokeObjectURL(pdfJsWorkerBlobUrl.current);
            }
            pdfJsWorkerBlobUrl.current = URL.createObjectURL(blob);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerBlobUrl.current;
            setIsPdfJsReady(true);
        } catch (error: any) {
            console.error('Error setting up PDF.js worker:', error);
            setErrorMessage(`PDF 워커 초기화 실패: ${error.message}`);
            setIsPdfJsReady(false);
        }
    };

    let checkInterval: number | undefined;
    let attempts = 0;
    const maxAttempts = 15; 

    const trySetup = () => {
        if (window.pdfjsLib) {
            if (checkInterval) clearInterval(checkInterval);
            setupPdfJsWorkerOnly();
        } else {
            attempts++;
            if (attempts >= maxAttempts) {
                if (checkInterval) clearInterval(checkInterval);
                console.error('window.pdfjsLib not found after multiple attempts. pdf.min.js likely failed to load from index.html.');
                setErrorMessage('PDF 라이브러리 (pdf.min.js) 로딩 지연 또는 실패. 페이지를 새로고침하거나 인터넷 연결을 확인해주세요.');
                setIsPdfJsReady(false);
            }
        }
    };

    if (window.pdfjsLib) {
        setupPdfJsWorkerOnly();
    } else {
        checkInterval = window.setInterval(trySetup, 200);
    }

    return () => {
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        if (pdfJsWorkerBlobUrl.current) {
            URL.revokeObjectURL(pdfJsWorkerBlobUrl.current);
            pdfJsWorkerBlobUrl.current = null;
        }
    };
  }, []); 
  
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    document.documentElement.className = theme; 
  }, [fontSize, theme]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    const currentSelectedFileId = selectedFile ? selectedFile.id : null;
    if (previousSelectedFileIdRef.current !== currentSelectedFileId) {
      if (selectedFile && selectedFile.sections && !selectedFile.isJokbo) {
        const aiSections = selectedFile.sections.filter(s => s.isAiGenerated);
        setAiSuggestedSections(aiSections);
      } else {
        setAiSuggestedSections([]);
      }
    }
    previousSelectedFileIdRef.current = currentSelectedFileId;
  }, [selectedFile]); 


  const handleCreateFolder = (folderName: string) => {
    if (!folderName.trim()) return;
    const newFolder: Folder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: folderName.trim(),
      parentId: currentFolderId,
      createdAt: new Date().toISOString(),
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'gyoan' | 'jokbo', targetFolderId: string | null = currentFolderId) => {
    if (!isPdfJsReady) { setErrorMessage('PDF 라이브러리 준비 안됨. 잠시 후 다시 시도해주세요.'); return; }
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true); setErrorMessage('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const originalArrayBuffer = e.target?.result as ArrayBuffer;

        const rawDataCopyForStorage = fileType === 'gyoan' ? originalArrayBuffer.slice(0) : undefined;
        
        const typedArrayForPdfJs = new Uint8Array(originalArrayBuffer); 
        const pdf = await window.pdfjsLib.getDocument({ data: typedArrayForPdfJs }).promise;
        
        let structuredText: PageContent[] = [];
        let firstPageImageBase64: string | null = null;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          structuredText.push({ pageNum: i, text: pageText });

          if (i === 1 && fileType === 'gyoan') {
            const viewport = page.getViewport({ scale: 0.5 }); 
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error("Failed to get canvas context");
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            firstPageImageBase64 = canvas.toDataURL('image/png', 0.5); 
          }
        }
        const fullExtractedText = structuredText.map(p => p.text).join('\n\n');

        const newFile: FileData = {
            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            folderId: targetFolderId,
            extractedText: fullExtractedText,
            structuredText: structuredText,
            firstPageImageBase64: fileType === 'gyoan' ? firstPageImageBase64 : null,
            pdfRawData: rawDataCopyForStorage, 
            createdAt: new Date().toISOString(),
            fileType: file.type,
            sections: [], 
            isJokbo: fileType === 'jokbo',
            associatedJokboFileId: null,
        };
        setFiles(prev => [...prev, newFile]);
        setSuccessMessage(`파일 '${file.name}' (${fileType === 'gyoan' ? '교안' : '족보'}) 업로드 성공!`);
        
      } catch (error: any) {
        console.error(`Error uploading ${fileType} file:`, error);
        setErrorMessage(`${fileType === 'gyoan' ? '교안' : '족보'} 파일 업로드 및 분석 오류: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    if (event.target) event.target.value = ''; 
  };

  const loadSelectedFileData = (fileMeta: FileData) => {
    setSelectedFile(fileMeta);
    setActiveView('dashboard');
  };

  const _generateQuizQuestionsInternal = async (
    quizType: QuestionType | 'mixed',
    primarySourceText: string,
    primarySourceName: string,
    quizContextForProcessing: ActiveQuizContext | null,
    associatedJokboFileText?: string, 
    associatedJokboFileName?: string 
  ) => {
    if (!primarySourceText) { 
        setErrorMessage(`${primarySourceName} 내용이 없습니다.`); 
        return; 
    }
    setIsLoading(true); 
    setQuizCompleted(false); 
    setUserAnswers({}); 
    setCurrentQuestionIndex(0);
    setGeneratedQuestions([]);
    
    try {
        const questionsFromSdk = await generateQuizQuestionsSdk(
          primarySourceName, 
          primarySourceText, 
          numQuestions, 
          difficulty, 
          quizType,
          associatedJokboFileText, 
          associatedJokboFileName   
        );
        
        if (questionsFromSdk && Array.isArray(questionsFromSdk) && questionsFromSdk.length > 0) {
          const processedQuestions = questionsFromSdk.map(q => {
            const sdkPageNum = q.pageNum; 
            let finalPageNum: number | undefined = undefined;

            if (typeof sdkPageNum === 'number' && sdkPageNum > 0 && quizContextForProcessing) {
              const ctx = quizContextForProcessing;
              if (ctx.type === 'section' && ctx.isAiSection) {
                finalPageNum = undefined; 
              } else if (ctx.type === 'section' && ctx.sectionStartPage > 0) {
                finalPageNum = ctx.sectionStartPage + sdkPageNum - 1; 
              } else if (ctx.type === 'fullFile' || ctx.type === 'targetedPractice' || ctx.type === 'jokbo' || ctx.type === 'jokbo_simulated_exam') { 
                finalPageNum = sdkPageNum; 
              }
            }
            return { ...q, pageNum: finalPageNum };
          });
          setGeneratedQuestions(processedQuestions);
          setActiveView('quiz');
        } else {
          setErrorMessage("문제 생성 실패. API 응답을 확인하거나 다시 시도해주세요. 생성된 문제가 없습니다.");
          setGeneratedQuestions([]);
        }
    } catch (error) {
        console.error("Error in _generateQuizQuestionsInternal:", error);
        setErrorMessage("문제 생성 중 오류 발생.");
        setGeneratedQuestions([]);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleStartQuiz = (quizType: QuestionType | 'mixed', sectionContent?: string, actualSectionId?: string, isAiSectionArg?: boolean) => {
    if (!selectedFile || !selectedFile.extractedText) {
      setErrorMessage('학습할 파일을 선택해주세요.');
      return;
    }

    let primaryText: string;
    let primaryName: string;
    let currentContext: ActiveQuizContext;
    let associatedJokboText: string | undefined = undefined;
    let associatedJokboName: string | undefined = undefined;

    if (selectedFile.associatedJokboFileId && !selectedFile.isJokbo) { 
        const jokboFile = files.find(f => f.id === selectedFile.associatedJokboFileId);
        if (jokboFile && jokboFile.extractedText) {
            associatedJokboText = jokboFile.extractedText;
            associatedJokboName = jokboFile.name;
        } else if (jokboFile) {
            console.warn(`Associated Jokbo file '${jokboFile.name}' found but has no extracted text.`);
            setErrorMessage(`연결된 족보 '${jokboFile.name}'의 텍스트 내용이 없습니다. 족보 파일을 다시 업로드하거나 확인해주세요.`);
        } else {
            console.warn(`Associated Jokbo file ID '${selectedFile.associatedJokboFileId}' not found in files list.`);
            setErrorMessage(`연결된 족보 파일을 찾을 수 없습니다 (ID: ${selectedFile.associatedJokboFileId}). 파일이 삭제되었거나 오류가 있을 수 있습니다.`);
        }
    }

    if (actualSectionId && sectionContent && !selectedFile.isJokbo) { 
      const sectionForQuiz = selectedFile.sections?.find(s => s.id === actualSectionId);
      let sectionDisplayName = '알 수 없는 대단원';
      if (sectionForQuiz) {
        sectionDisplayName = isAiSectionArg 
          ? `${selectedFile.name} (AI) - ${sectionForQuiz.name}` 
          : `${selectedFile.name} - ${sectionForQuiz.name}`;
      } else if (isAiSectionArg && actualSectionId.startsWith('ai-section-')) {
        const tempAiSection = aiSuggestedSections.find(s => s.id === actualSectionId);
        if (tempAiSection) sectionDisplayName = `${selectedFile.name} (AI) - ${tempAiSection.name}`;
      }
      primaryText = sectionContent;
      primaryName = sectionDisplayName;
      currentContext = { 
        type: 'section', 
        fileId: selectedFile.id,
        sectionId: actualSectionId, 
        sectionName: sectionDisplayName, 
        sectionStartPage: sectionForQuiz?.startPage || 0, 
        isAiSection: !!isAiSectionArg,
        associatedJokboFileId: selectedFile.associatedJokboFileId 
      };
    } else { 
      primaryText = selectedFile.extractedText;
      primaryName = selectedFile.name;
      if (selectedFile.isJokbo) {
        currentContext = { type: 'jokbo', fileId: selectedFile.id, fileName: selectedFile.name };
      } else {
        currentContext = { type: 'fullFile', fileId: selectedFile.id, fileName: selectedFile.name, associatedJokboFileId: selectedFile.associatedJokboFileId };
      }
    }
    setActiveQuizContext(currentContext);
    _generateQuizQuestionsInternal(quizType, primaryText, primaryName, currentContext, associatedJokboText, associatedJokboName);
  };

  const handleStartSimilarJokboQuiz = async () => {
    if (!selectedFile || !selectedFile.extractedText || !selectedFile.isJokbo) {
      setErrorMessage('유사 문제 생성을 위해 먼저 족보 파일을 선택하고 파일 내용이 있어야 합니다.');
      return;
    }
    setIsLoading(true);
    setQuizCompleted(false);
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setGeneratedQuestions([]);

    try {
        const questionsFromSdk = await generateSimilarJokboQuestionsSdk(
          selectedFile.name,
          selectedFile.extractedText,
          numQuestions,
          difficulty
        );

        if (questionsFromSdk && Array.isArray(questionsFromSdk) && questionsFromSdk.length > 0) {
          const processedQuestions = questionsFromSdk.map(q => ({
            ...q,
            pageNum: (typeof q.pageNum === 'number' && q.pageNum > 0) ? q.pageNum : undefined,
          }));
          
          const currentContext: ActiveQuizContext = {
            type: 'jokbo_simulated_exam',
            fileId: selectedFile.id, 
            fileName: selectedFile.name, 
          };
          setActiveQuizContext(currentContext);
          setGeneratedQuestions(processedQuestions);
          setActiveView('quiz');
          setSuccessMessage(`'${selectedFile.name}' 기반 AI 유사 문제 생성 완료!`);
        } else {
          setErrorMessage("AI 유사 문제 생성에 실패했습니다. API 응답을 확인하거나 다시 시도해주세요. 생성된 문제가 없습니다.");
          setGeneratedQuestions([]);
        }
    } catch (error) {
        console.error("Error in handleStartSimilarJokboQuiz:", error);
        setErrorMessage("AI 유사 문제 생성 중 오류 발생.");
        setGeneratedQuestions([]);
    } finally {
        setIsLoading(false);
    }
  };


  const handleAnswerSubmit = (qIndex: number, answer: string | string[] | null) => {
    const updatedAnswers = { ...userAnswers, [qIndex]: answer };
    setUserAnswers(updatedAnswers);
    if (currentQuestionIndex < generatedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizCompleted(true);
      processQuizResults(updatedAnswers); 
      setActiveView('results');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const processQuizResults = async (currentAnswers: Record<number, string | string[] | null>) => {
    const newGeneralNotes: IncorrectNote[] = [];
    const newShortAnswerNotes: ShortAnswerIncorrectNote[] = [];
    const newSelectAllNotes: IncorrectNote[] = []; 
    const newJokboSimulatedNotes: IncorrectNote[] = []; 
    let calculatedScore = 0;

    for (const [i, question] of generatedQuestions.entries()) {
        const userAnswer = currentAnswers[i] === undefined ? null : currentAnswers[i];
        let isCorrectThisQuestion = false;

        let isMarkedAsDontKnow = false;
        if (question.questionType === QuestionType.SELECT_ALL && Array.isArray(userAnswer) && userAnswer.length === 1 && userAnswer[0] === "모르겠음") {
            isMarkedAsDontKnow = true;
        } else if (userAnswer === "모르겠음") { // For MC, OX, ShortAnswer (if string)
            isMarkedAsDontKnow = true;
        }
    
        if (isMarkedAsDontKnow) {
            isCorrectThisQuestion = false;
        } else if (userAnswer === null && question.questionType !== QuestionType.SHORT_ANSWER) { 
            if (question.questionType === QuestionType.SELECT_ALL) {
                const expectedCorrectFullTexts = question.correctAnswer
                    .split(SAP_DELIMITER).map(s => s.trim()).filter(s => s !== "" && s.toLowerCase() !== "모르겠음");
                isCorrectThisQuestion = expectedCorrectFullTexts.length === 0;
            } else {
                isCorrectThisQuestion = false; 
            }
        } else {
            // Actual answer evaluation
            switch (question.questionType) {
                case QuestionType.MULTIPLE_CHOICE:
                    if (typeof userAnswer === 'string') {
                        if (OPTION_LETTERS.includes(userAnswer.toUpperCase()) && question.options) {
                            const optionIndex = OPTION_LETTERS.indexOf(userAnswer.toUpperCase());
                            if (optionIndex !== -1 && optionIndex < question.options.length) {
                                const selectedOptionText = question.options[optionIndex];
                                isCorrectThisQuestion = selectedOptionText?.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
                            }
                        } else {
                            isCorrectThisQuestion = userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
                        }
                    }
                    break;
                case QuestionType.OX:
                    if (typeof userAnswer === 'string') {
                        isCorrectThisQuestion = userAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
                    }
                    break;
                case QuestionType.SHORT_ANSWER:
                    if (typeof userAnswer === 'string' && userAnswer.trim() !== '') {
                        const semanticCheckResult = await checkShortAnswerCorrectnessSdk(
                            question.questionText,
                            question.correctAnswer,
                            userAnswer.trim()
                        );
                        isCorrectThisQuestion = semanticCheckResult === true;
                    } else { // Blank short answer is incorrect unless correct answer is also blank (unlikely)
                        isCorrectThisQuestion = question.correctAnswer.trim() === '';
                    }
                    break;
                case QuestionType.SELECT_ALL:
                    const selections = Array.isArray(userAnswer) ? userAnswer.filter(a => a.toLowerCase() !== "모르겠음") : [];
                    
                    const userSelectedFullTexts = selections
                        .map(ansLetter => {
                            const optionIndex = OPTION_LETTERS.indexOf(ansLetter.toUpperCase());
                            if (question.options && optionIndex !== -1 && optionIndex < question.options.length) {
                                return question.options[optionIndex].trim();
                            }
                            return null; 
                        })
                        .filter(text => text !== null) as string[];

                    const expectedCorrectFullTexts = question.correctAnswer
                        .split(SAP_DELIMITER)
                        .map(s => s.trim())
                        .filter(s => s !== "" && s.toLowerCase() !== "모르겠음");

                    if (userSelectedFullTexts.length === 0) { 
                        isCorrectThisQuestion = expectedCorrectFullTexts.length === 0;
                    } else if (question.options) { 
                        const semanticCheckResult = await checkSelectAllCorrectnessSdk(
                            question.questionText,
                            question.options.filter(opt => opt.toLowerCase() !== "모르겠음"),
                            expectedCorrectFullTexts,
                            userSelectedFullTexts
                        );

                        if (semanticCheckResult === null) {
                            console.warn("Select All SDK check failed, falling back to local comparison for question:", question.questionText);
                            const correctAnswersSet = new Set(expectedCorrectFullTexts.map(s => s.toLowerCase()));
                            const userAnswersSet = new Set(userSelectedFullTexts.map(s => s.toLowerCase()));
                            isCorrectThisQuestion = correctAnswersSet.size === userAnswersSet.size &&
                                                    [...correctAnswersSet].every(val => userAnswersSet.has(val));
                        } else {
                            isCorrectThisQuestion = semanticCheckResult === true;
                        }
                    } else { 
                        isCorrectThisQuestion = false;
                    }
                    break;
                default:
                    isCorrectThisQuestion = false;
            }
        }


        if (isCorrectThisQuestion) {
            calculatedScore++;
        }

        const noteCandidateId = (question as IncorrectNote).id || `q-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`;
        let currentFileContextId: string | undefined;
        let currentSectionId: string | undefined;
        let currentSourceName: string | undefined;

        if (activeQuizContext?.type === 'section') {
            currentFileContextId = activeQuizContext.fileId;
            currentSectionId = activeQuizContext.sectionId;
            currentSourceName = activeQuizContext.sectionName;
        } else if (activeQuizContext) { 
            currentFileContextId = activeQuizContext.fileId;
            currentSourceName = activeQuizContext.fileName;
        }
        
        const isGyoanJokboLinkedQuiz =
            (activeQuizContext?.type === 'fullFile' && activeQuizContext.associatedJokboFileId) ||
            (activeQuizContext?.type === 'section' && activeQuizContext.associatedJokboFileId);

        let targetNoteListType: 'general' | 'shortAnswer' | 'selectAll' | 'jokboSimulated';
        let finalNoteSourceName = currentSourceName;

        if (activeQuizContext?.type === 'jokbo_simulated_exam') {
            targetNoteListType = 'jokboSimulated';
            finalNoteSourceName = `AI 유사 문제 (족보: ${activeQuizContext.fileName})`;
        } else if (isGyoanJokboLinkedQuiz && currentFileContextId && activeQuizContext?.associatedJokboFileId) {
            targetNoteListType = 'jokboSimulated';
            const jokboFileForContext = files.find(f => f.id === activeQuizContext!.associatedJokboFileId);
            const jokboNameForContext = jokboFileForContext ? jokboFileForContext.name : '연결된 족보';
            finalNoteSourceName = `${currentSourceName || '교안'} (족보 '${jokboNameForContext}' 연계)`;
        } else if (question.questionType === QuestionType.SHORT_ANSWER) {
            targetNoteListType = 'shortAnswer';
        } else if (question.questionType === QuestionType.SELECT_ALL) { 
            targetNoteListType = 'selectAll';
        } else {
            targetNoteListType = 'general';
        }

        const noteData: IncorrectNote = {
            ...question,
            id: noteCandidateId,
            userAnswer: userAnswer,
            timestamp: new Date().toISOString(),
            originalQuestionId: (question as IncorrectNote).originalQuestionId || noteCandidateId,
            fileContextId: currentFileContextId,
            sectionId: currentSectionId,
            sourceName: finalNoteSourceName,
            srsLevel: 0,
            lastReviewedAt: undefined,
            nextReviewAt: undefined,
        };

        if (!isCorrectThisQuestion) {
            if (targetNoteListType === 'jokboSimulated') {
                newJokboSimulatedNotes.push(noteData);
            } else if (targetNoteListType === 'shortAnswer') {
                newShortAnswerNotes.push(noteData);
            } else if (targetNoteListType === 'selectAll') { 
                newSelectAllNotes.push(noteData);
            } else {
                newGeneralNotes.push(noteData);
            }
        }
    }

    setQuizScore(calculatedScore);

    setJokboSimulatedIncorrectNotes(prevNotes => {
        let updatedNotes = [...prevNotes];
        newJokboSimulatedNotes.forEach(newNote => {
            const existingNoteIndex = updatedNotes.findIndex(existingNote =>
                existingNote.originalQuestionId === newNote.originalQuestionId &&
                existingNote.fileContextId === newNote.fileContextId
            );
             if (existingNoteIndex === -1) {
                const existingById = updatedNotes.findIndex(n => n.id === newNote.id);
                if (existingById === -1) updatedNotes.push(newNote);
                else updatedNotes[existingById] = { ...newNote, timestamp: new Date().toISOString() };
            } else {
                updatedNotes[existingNoteIndex] = { ...newNote, id: updatedNotes[existingNoteIndex].id, timestamp: new Date().toISOString() };
            }
        });
        return updatedNotes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    setIncorrectAnswerNotes(prevNotes => {
        let updatedNotes = [...prevNotes];
        newGeneralNotes.forEach(newNote => {
            const existingNoteIndex = updatedNotes.findIndex(existingNote =>
                existingNote.originalQuestionId === newNote.originalQuestionId &&
                existingNote.fileContextId === newNote.fileContextId &&
                existingNote.sectionId === newNote.sectionId
            );
            if (existingNoteIndex === -1) {
                const existingById = updatedNotes.findIndex(n => n.id === newNote.id);
                if (existingById === -1) updatedNotes.push(newNote);
                else updatedNotes[existingById] = { ...newNote, timestamp: new Date().toISOString() };
            } else {
                updatedNotes[existingNoteIndex] = { ...newNote, id: updatedNotes[existingNoteIndex].id, timestamp: new Date().toISOString() };
            }
        });
        return updatedNotes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    setShortAnswerIncorrectNotes(prevNotes => {
        let updatedNotes = [...prevNotes];
        newShortAnswerNotes.forEach(newNote => {
            const existingNoteIndex = updatedNotes.findIndex(existingNote =>
                existingNote.originalQuestionId === newNote.originalQuestionId &&
                existingNote.fileContextId === newNote.fileContextId &&
                existingNote.sectionId === newNote.sectionId
            );
            if (existingNoteIndex === -1) {
                const existingById = updatedNotes.findIndex(n => n.id === newNote.id);
                if (existingById === -1) updatedNotes.push(newNote);
                else updatedNotes[existingById] = { ...newNote, timestamp: new Date().toISOString() };
            } else {
                updatedNotes[existingNoteIndex] = { ...newNote, id: updatedNotes[existingNoteIndex].id, timestamp: new Date().toISOString() };
            }
        });
        return updatedNotes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    setSelectAllIncorrectNotes(prevNotes => { 
        let updatedNotes = [...prevNotes];
        newSelectAllNotes.forEach(newNote => {
            const existingNoteIndex = updatedNotes.findIndex(existingNote =>
                existingNote.originalQuestionId === newNote.originalQuestionId &&
                existingNote.fileContextId === newNote.fileContextId &&
                existingNote.sectionId === newNote.sectionId
            );
            if (existingNoteIndex === -1) {
                const existingById = updatedNotes.findIndex(n => n.id === newNote.id);
                if (existingById === -1) updatedNotes.push(newNote);
                else updatedNotes[existingById] = { ...newNote, timestamp: new Date().toISOString() };
            } else {
                updatedNotes[existingNoteIndex] = { ...newNote, id: updatedNotes[existingNoteIndex].id, timestamp: new Date().toISOString() };
            }
        });
        return updatedNotes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
};


  const fetchDeepDiveAnalysis = async (question: IncorrectNote) => {
    setPreviousViewForDeepDive(activeView); 
    setCurrentDeepDiveQuestion(question);
    setActiveView('deepDive');
    setIsLoading(true);
    setDeepDiveContent(null);

    let relevantGyoanText = "교안 내용이 없거나, 문제와 직접 관련된 내용을 찾기 어렵습니다. 일반적인 설명을 제공합니다.";
    const MAX_CONTEXT_CHARS = 7000;
    const MAX_ORIGINAL_SOURCE_CHARS = 15000;
    let imageForAnalysis: string | null = null;
    let originalFullSourceTextForPageGuess: string | undefined = undefined;
    
    const sourceFile = files.find(f => f.id === question.fileContextId);

    if (sourceFile) { 
        imageForAnalysis = sourceFile.isJokbo ? null : sourceFile.firstPageImageBase64;

        if (question.sectionId && !sourceFile.isJokbo && sourceFile.sections) {
            const section = sourceFile.sections.find(s => s.id === question.sectionId);
            if (section) {
                relevantGyoanText = section.content.substring(0, MAX_CONTEXT_CHARS);
                if (section.isAiGenerated || (section.startPage === 0 && section.endPage === 0)) {
                     if (sourceFile.structuredText && sourceFile.structuredText.length > 0) {
                        let structuredTextBuilder = "";
                        let charCount = 0;
                        for (const pageContent of sourceFile.structuredText) {
                            const pageMarkerStart = `--- PAGE ${pageContent.pageNum} ---\n`;
                            const pageMarkerEnd = `\n--- END PAGE ${pageContent.pageNum} ---\n\n`;
                            const pageFullText = pageMarkerStart + pageContent.text + pageMarkerEnd;
                            if (charCount + pageFullText.length > MAX_ORIGINAL_SOURCE_CHARS && structuredTextBuilder.length > 0) break;
                            structuredTextBuilder += pageFullText;
                            charCount += pageFullText.length;
                        }
                        originalFullSourceTextForPageGuess = structuredTextBuilder;
                    } else if (sourceFile.extractedText) { 
                        originalFullSourceTextForPageGuess = sourceFile.extractedText.substring(0, MAX_ORIGINAL_SOURCE_CHARS);
                    }
                }
            } else if (sourceFile.extractedText) {
                relevantGyoanText = sourceFile.extractedText.substring(0, MAX_CONTEXT_CHARS);
            }
        } else if (sourceFile.extractedText) { 
             relevantGyoanText = sourceFile.extractedText.substring(0, MAX_CONTEXT_CHARS);
             if (!sourceFile.isJokbo) { 
                if (sourceFile.structuredText && sourceFile.structuredText.length > 0) {
                    let structuredTextBuilder = "";
                    let charCount = 0;
                    for (const pageContent of sourceFile.structuredText) {
                        const pageMarkerStart = `--- PAGE ${pageContent.pageNum} ---\n`;
                        const pageMarkerEnd = `\n--- END PAGE ${pageContent.pageNum} ---\n\n`;
                        const pageFullText = pageMarkerStart + pageContent.text + pageMarkerEnd;
                        if (charCount + pageFullText.length > MAX_ORIGINAL_SOURCE_CHARS && structuredTextBuilder.length > 0) break;
                        structuredTextBuilder += pageFullText;
                        charCount += pageFullText.length;
                    }
                    originalFullSourceTextForPageGuess = structuredTextBuilder;
                } else if (sourceFile.extractedText) {
                    originalFullSourceTextForPageGuess = sourceFile.extractedText.substring(0, MAX_ORIGINAL_SOURCE_CHARS);
                }
             }
        }
    }
    
    const analysis = await fetchDeepDiveAnalysisSdk(question, relevantGyoanText, imageForAnalysis, originalFullSourceTextForPageGuess);
    if (analysis) setDeepDiveContent(analysis);
    else setErrorMessage("AI 심층 분석 정보를 가져오는데 실패했습니다.");
    setIsLoading(false);
  };

  const handleRequestCorrectiveFeedback = async (note: IncorrectNote) => {
    setIsLoading(true);
    setCorrectiveFeedbackContent(null);
    const feedback = await generateCorrectiveFeedbackSdk(note);
    if (feedback) {
      setCorrectiveFeedbackContent(feedback);
      setActiveView('correctiveFeedback');
    } else {
      setErrorMessage("AI 첨삭 피드백을 가져오는 데 실패했습니다.");
    }
    setIsLoading(false);
  };

  const deleteIncorrectNoteFromLocal = (noteId: string, noteSourceType: 'general' | 'shortAnswer' | 'selectAll' | 'jokboSimulated'): boolean => {
    let deletedNote: IncorrectNote | ShortAnswerIncorrectNote | undefined;
    
    switch (noteSourceType) {
      case 'general':
        deletedNote = incorrectAnswerNotes.find(note => note.id === noteId);
        setIncorrectAnswerNotes(prev => prev.filter(note => note.id !== noteId));
        if (deletedNote && classifiedGeneralNotes) {
            setClassifiedGeneralNotes(prev => {
                if (!prev) return null;
                const newClassification: Record<string, IncorrectNote[]> = {};
                for (const category in prev) {
                    const notesInCategory = prev[category].filter(n => n.id !== noteId);
                    if (notesInCategory.length > 0) newClassification[category] = notesInCategory;
                }
                return Object.keys(newClassification).length > 0 ? newClassification : null;
            });
        }
        break;
      case 'shortAnswer':
        deletedNote = shortAnswerIncorrectNotes.find(note => note.id === noteId);
        setShortAnswerIncorrectNotes(prev => prev.filter(note => note.id !== noteId));
         if (deletedNote && classifiedShortAnswerNotes) {
            setClassifiedShortAnswerNotes(prev => {
                if (!prev) return null;
                const newClassification: Record<string, ShortAnswerIncorrectNote[]> = {};
                for (const category in prev) {
                    const notesInCategory = prev[category].filter(n => n.id !== noteId);
                    if (notesInCategory.length > 0) newClassification[category] = notesInCategory;
                }
                return Object.keys(newClassification).length > 0 ? newClassification : null;
            });
        }
        break;
      case 'selectAll': 
        deletedNote = selectAllIncorrectNotes.find(note => note.id === noteId);
        setSelectAllIncorrectNotes(prev => prev.filter(note => note.id !== noteId));
         if (deletedNote && classifiedSelectAllNotes) {
            setClassifiedSelectAllNotes(prev => {
                if (!prev) return null;
                const newClassification: Record<string, IncorrectNote[]> = {};
                for (const category in prev) {
                    const notesInCategory = prev[category].filter(n => n.id !== noteId);
                    if (notesInCategory.length > 0) newClassification[category] = notesInCategory;
                }
                return Object.keys(newClassification).length > 0 ? newClassification : null;
            });
        }
        break;
      case 'jokboSimulated':
        deletedNote = jokboSimulatedIncorrectNotes.find(note => note.id === noteId);
        setJokboSimulatedIncorrectNotes(prev => prev.filter(note => note.id !== noteId));
        if (deletedNote && classifiedJokboSimulatedNotes) {
            setClassifiedJokboSimulatedNotes(prev => {
                if (!prev) return null;
                const newClassification: Record<string, IncorrectNote[]> = {};
                for (const category in prev) {
                    const notesInCategory = prev[category].filter(n => n.id !== noteId);
                    if (notesInCategory.length > 0) newClassification[category] = notesInCategory;
                }
                return Object.keys(newClassification).length > 0 ? newClassification : null;
            });
        }
        break;
    }

    if (deletedNote) {
        return true;
    }
    return false; 
  };


  const handleDeleteFromRetryQuiz = (questionToDelete: IncorrectNote) => {
    let noteSourceType: 'general' | 'shortAnswer' | 'selectAll' | 'jokboSimulated' = 'general';
    
    const isGyoanJokboLinkedQuiz =
        (activeQuizContext?.type === 'fullFile' && activeQuizContext.associatedJokboFileId) ||
        (activeQuizContext?.type === 'section' && activeQuizContext.associatedJokboFileId);

    if (activeQuizContext?.type === 'jokbo_simulated_exam' || isGyoanJokboLinkedQuiz) {
      noteSourceType = 'jokboSimulated';
    } else if (questionToDelete.questionType === QuestionType.SHORT_ANSWER) {
      noteSourceType = 'shortAnswer';
    } else if (questionToDelete.questionType === QuestionType.SELECT_ALL) { 
      noteSourceType = 'selectAll';
    }


    const success = deleteIncorrectNoteFromLocal(questionToDelete.id, noteSourceType);
    if (success) {
      const remainingQuestions = generatedQuestions.filter(q => (q as IncorrectNote).id !== questionToDelete.id);
      setGeneratedQuestions(remainingQuestions);
      if (remainingQuestions.length === 0) {
        let targetView: View = 'notes';
        if (noteSourceType === 'shortAnswer') targetView = 'shortAnswerNotes';
        else if (noteSourceType === 'selectAll') targetView = 'selectAllNotes'; 
        else if (noteSourceType === 'jokboSimulated') targetView = 'jokboSimulatedNotes';
        setActiveView(targetView);
      } else if (currentQuestionIndex >= remainingQuestions.length) {
        setCurrentQuestionIndex(remainingQuestions.length - 1);
      }
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const retryAllNotes = (
    notesToRetry: Array<IncorrectNote | ShortAnswerIncorrectNote>, 
    noteSourceType: 'general' | 'shortAnswer' | 'selectAll' | 'jokboSimulated',
    order: 'random' | 'original'
  ) => {
    if (notesToRetry.length > 0) {
      let orderedNotesToRetry: Array<IncorrectNote | ShortAnswerIncorrectNote>;

      if (order === 'random') {
        orderedNotesToRetry = shuffleArray(notesToRetry);
      } else { // 'original' order
        orderedNotesToRetry = [...notesToRetry].sort((a, b) => {
          // Ensure only positive page numbers are considered valid, others are treated as Infinity.
          const pageNumA = (a.pageNum && a.pageNum > 0) ? a.pageNum : Infinity;
          const pageNumB = (b.pageNum && b.pageNum > 0) ? b.pageNum : Infinity;

          if (pageNumA !== pageNumB) {
            return pageNumA - pageNumB; // Sort by page number (ascending)
          }
          // If page numbers are the same (or both Infinity), sort by timestamp (ascending)
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
      }
      
      const firstNote = orderedNotesToRetry[0];
      let currentContext: ActiveQuizContext | null = null;
      const sourceFile = files.find(f => f.id === firstNote.fileContextId);

      if (sourceFile) {
          if (noteSourceType === 'jokboSimulated' && sourceFile.isJokbo) { 
              currentContext = { type: 'jokbo_simulated_exam', fileId: sourceFile.id, fileName: sourceFile.name };
          } else if (noteSourceType === 'jokboSimulated' && !sourceFile.isJokbo) { 
              const associatedJokbo = files.find(f => f.id === sourceFile.associatedJokboFileId);
               if (firstNote.sectionId) {
                    const section = sourceFile.sections?.find(s => s.id === firstNote.sectionId);
                    const isAi = section?.isAiGenerated || false;
                    const sectionDisplayName = section 
                        ? (isAi ? `${sourceFile.name} (AI) - ${section.name}` : `${sourceFile.name} - ${section.name}`)
                        : `${sourceFile.name} - 알 수 없는 대단원`;
                     currentContext = {
                        type: 'section',
                        fileId: sourceFile.id,
                        sectionId: firstNote.sectionId,
                        sectionName: sectionDisplayName,
                        sectionStartPage: section?.startPage || 0,
                        isAiSection: isAi,
                        associatedJokboFileId: sourceFile.associatedJokboFileId 
                    };
               } else {
                    currentContext = { 
                        type: 'fullFile', 
                        fileId: sourceFile.id, 
                        fileName: sourceFile.name, 
                        associatedJokboFileId: sourceFile.associatedJokboFileId 
                    };
               }
          } else if (sourceFile.isJokbo) { 
              currentContext = { type: 'jokbo', fileId: sourceFile.id, fileName: sourceFile.name };
          } else if (firstNote.sectionId) { 
              const section = sourceFile.sections?.find(s => s.id === firstNote.sectionId);
              const isAi = section?.isAiGenerated || false;
              const sectionDisplayName = section 
                  ? (isAi ? `${sourceFile.name} (AI) - ${section.name}` : `${sourceFile.name} - ${section.name}`)
                  : `${sourceFile.name} - 알 수 없는 대단원`;
              currentContext = {
                  type: 'section',
                  fileId: sourceFile.id,
                  sectionId: firstNote.sectionId, 
                  sectionName: sectionDisplayName, 
                  sectionStartPage: section?.startPage || 0,
                  isAiSection: isAi,
                  associatedJokboFileId: sourceFile.associatedJokboFileId
              };
          } else { 
              currentContext = { type: 'fullFile', fileId: sourceFile.id, fileName: sourceFile.name, associatedJokboFileId: sourceFile.associatedJokboFileId };
          }
      }
      
      setActiveQuizContext(currentContext);
      setGeneratedQuestions([...orderedNotesToRetry] as Question[]);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setQuizCompleted(false);
      setActiveView('retryQuiz');
    } else {
      setErrorMessage('다시 풀 오답이 없습니다.');
    }
  };

  const startDeepDiveQuiz = (questionToSolve: Question) => {
    setCurrentSolvingQuestion(questionToSolve);
    setActiveView('deepDiveQuiz');
  };

  const handleSendMessageToChatbot = async (userMessageText: string) => {
    const userMessage: ChatMessage = {
      id: `chat-user-${Date.now()}`,
      sender: 'user',
      text: userMessageText,
      timestamp: new Date().toISOString(),
    };
  
    setChatMessagesByFileId(prev => ({
      ...prev,
      [GLOBAL_ADVICE_CHAT_KEY]: [...(prev[GLOBAL_ADVICE_CHAT_KEY] || []), userMessage],
    }));
    
    const aiLoadingMessageId = `chat-ai-loading-${Date.now()}`;
    const aiLoadingMessage: ChatMessage = {
      id: aiLoadingMessageId,
      sender: 'ai',
      text: 'AI가 답변을 생성 중입니다...',
      timestamp: new Date().toISOString(),
      isLoading: true,
    };

    setChatMessagesByFileId(prev => ({
        ...prev,
        [GLOBAL_ADVICE_CHAT_KEY]: [...(prev[GLOBAL_ADVICE_CHAT_KEY] || []), aiLoadingMessage],
    }));
  
    setIsChatbotLoading(true);
  
    try {
      const allNotes = [...incorrectAnswerNotes, ...shortAnswerIncorrectNotes, ...selectAllIncorrectNotes, ...jokboSimulatedIncorrectNotes];
      const aiResponseText = await getStudyAdviceSdk(
        userMessageText,
        allNotes,
        files, 
        chatMessagesByFileId[GLOBAL_ADVICE_CHAT_KEY] || [] 
      );
  
      const aiResponseMessage: ChatMessage = {
        id: `chat-ai-response-${Date.now()}`,
        sender: 'ai',
        text: aiResponseText || "죄송합니다, 학습 조언을 받지 못했습니다.",
        timestamp: new Date().toISOString(),
        isLoading: false,
      };
      
      setChatMessagesByFileId(prev => {
        const currentFileMessages = prev[GLOBAL_ADVICE_CHAT_KEY] || [];
        const updatedMessages = currentFileMessages.filter(msg => msg.id !== aiLoadingMessageId);
        return {
          ...prev,
          [GLOBAL_ADVICE_CHAT_KEY]: [...updatedMessages, aiResponseMessage],
        };
      });

    } catch (error: any) {
      console.error("Error getting study advice:", error);
      const aiErrorMessage: ChatMessage = {
        id: `chat-ai-error-${Date.now()}`,
        sender: 'ai',
        text: "학습 조언 생성 중 오류가 발생했습니다.",
        timestamp: new Date().toISOString(),
        isLoading: false,
        error: error.message || "알 수 없는 오류",
      };
       setChatMessagesByFileId(prev => {
        const currentFileMessages = prev[GLOBAL_ADVICE_CHAT_KEY] || [];
        const updatedMessages = currentFileMessages.filter(msg => msg.id !== aiLoadingMessageId);
        return {
          ...prev,
          [GLOBAL_ADVICE_CHAT_KEY]: [...updatedMessages, aiErrorMessage],
        };
      });
    } finally {
      setIsChatbotLoading(false);
    }
  };

  const handleResetGlobalAdviceChat = () => {
    setChatMessagesByFileId(prev => ({
      ...prev,
      [GLOBAL_ADVICE_CHAT_KEY]: [], 
    }));
    setSuccessMessage('AI 학습 조언 대화 내용이 초기화되었습니다.');
  };


  const handleAiToolClick = async (toolKey: string, toolName: string) => {
    if (!selectedFile || !selectedFile.extractedText) {
      setErrorMessage('AI 도구를 사용하려면 먼저 파일을 선택해주세요.');
      return;
    }

    let gyoanTextForTool = selectedFile.extractedText.substring(0, 8000);
    let basePromptContext = "다음 교안 텍스트의 일부를 바탕으로 ";
    let imageForTool: string | null = selectedFile.isJokbo ? null : selectedFile.firstPageImageBase64;
    let associatedJokboTextForTool: string | undefined = undefined;
    let associatedJokboNameForTool: string | undefined = undefined;

    if (!selectedFile.isJokbo && selectedFile.associatedJokboFileId) {
        const jokboFile = files.find(f => f.id === selectedFile.associatedJokboFileId);
        if (jokboFile && jokboFile.extractedText) {
            associatedJokboTextForTool = jokboFile.extractedText.substring(0, 4000);
            associatedJokboNameForTool = jokboFile.name;
        }
    }
    
    setCurrentAiToolName(toolName);
    setAiToolExplanation(null);
    setActiveView('aiToolExplanation');
    setIsLoading(true);

    const explanation = await performAiToolActionSdk(
        toolKey, 
        basePromptContext, 
        gyoanTextForTool, 
        imageForTool,
        associatedJokboTextForTool, 
        selectedFile.name, 
        associatedJokboNameForTool 
    );
    
    if (explanation !== null) {
      setAiToolExplanation(explanation);
    } else {
      setAiToolExplanation(toolKey === 'fillInBlank' ? [] : 'AI 도구 설명을 가져오는 데 실패했습니다.');
    }
    setIsLoading(false);
  };

  const handleGenerateLearningGuide = async (fileId: string) => {
    const targetFile = files.find(f => f.id === fileId);
    if (!targetFile || !targetFile.extractedText || targetFile.isJokbo) { 
      setErrorMessage(`"${targetFile?.name || fileId}" 교안 파일의 내용을 찾을 수 없거나 족보 파일이어서 학습 가이드를 생성할 수 없습니다.`);
      return;
    }

    setIsLoading(true);
    setLoadingAiToolFileId(fileId);
    setLearningGuides(prev => ({ ...prev, [fileId]: '' })); 

    let contextText = `현재 학습 중인 교안 "${targetFile.name}" 내용 일부:\n${targetFile.extractedText.substring(0, 4000)}\n\n`;
    const imageForGuide: string | null = targetFile.firstPageImageBase64;
    
    const notesForFile = [...incorrectAnswerNotes, ...shortAnswerIncorrectNotes, ...selectAllIncorrectNotes].filter(note => note.fileContextId === fileId);
    if (notesForFile.length > 0) {
      const notesSummary = notesForFile.slice(0, 10).map(note =>
        `틀린 문제: ${note.questionText} (나의 답: ${Array.isArray(note.userAnswer) ? note.userAnswer.join(', ') : note.userAnswer}, 정답: ${note.correctAnswer}) ${note.pageNum ? `(관련 페이지: ${note.pageNum}쪽)` : ''}`
      ).join('\n');
      contextText += `"${targetFile.name}" 관련 최근 오답 노트 요약:\n${notesSummary}\n\n`;
    } else {
      contextText += `"${targetFile.name}" 관련 오답 노트는 현재 없습니다.\n\n`;
    }

    const guide = await generateLearningGuideSdk(contextText, imageForGuide);
    setLearningGuides(prev => ({ ...prev, [fileId]: guide || "학습 가이드 생성에 실패했습니다." }));
    setLoadingAiToolFileId(null);
    setIsLoading(false);
  };

  const handleGenerateAsciiConceptMap = async (fileId: string) => {
    const targetFile = files.find(f => f.id === fileId);
    if (!targetFile || !targetFile.extractedText || targetFile.isJokbo) { 
      setErrorMessage(`"${targetFile?.name || fileId}" 교안 파일의 내용을 찾을 수 없거나 족보 파일이어서 개념도를 생성할 수 없습니다.`);
      return;
    }
    
    setIsLoading(true);
    setLoadingAiToolFileId(fileId);
    setConceptMaps(prev => ({ ...prev, [fileId]: '' })); 

    const textSample = targetFile.extractedText.substring(0, 8000);
    const imageForMap = targetFile.firstPageImageBase64;
    
    const map = await generateAsciiConceptMapSdk(textSample, imageForMap);
    setConceptMaps(prev => ({ ...prev, [fileId]: map || "개념도 생성에 실패했습니다. 텍스트가 너무 짧거나 복잡할 수 있습니다."}));
    setLoadingAiToolFileId(null);
    setIsLoading(false); 
  };

  const handleSaveSections = (fileId: string, newSections: FileSection[]) => {
    setFiles(prevFiles =>
      prevFiles.map(f =>
        f.id === fileId ? { ...f, sections: newSections } : f
      )
    );
    const updatedFile = files.find(f => f.id === fileId);
    if (updatedFile) {
        setSelectedFile({ ...updatedFile, sections: newSections });
    }
    setSuccessMessage('대단원 정보가 저장되었습니다.');
    setIsManageSectionsModalOpen(false);
  };

  const handleAutoSegmentSections = async () => {
    if (!selectedFile || !selectedFile.extractedText || selectedFile.isJokbo) {
      setErrorMessage("AI 대단원 나누기를 위해서는 교안 파일 내용이 필요합니다.");
      return;
    }
    setIsLoadingAiSections(true);
    setErrorMessage('');
    const sections = await generateSectionsSdk(selectedFile.extractedText, selectedFile.name);
    if (sections) {
      setFiles(prevFiles => 
        prevFiles.map(f => {
          if (f.id === selectedFile.id) {
            const manualSections = f.sections?.filter(s => !s.isAiGenerated) || [];
            const updatedFile = { ...f, sections: [...manualSections, ...sections] };
            setSelectedFile(updatedFile); 
            setAiSuggestedSections(sections); 
            return updatedFile;
          }
          return f;
        })
      );
      setSuccessMessage(`"${selectedFile.name}" 파일에 대한 AI 대단원 자동 분석 및 적용 완료!`);
    } else {
      setErrorMessage("AI 대단원 자동 분석에 실패했습니다.");
    }
    setIsLoadingAiSections(false);
  };

  const handleGenerateTargetedQuiz = async (fileId: string) => {
    const targetFile = files.find(f => f.id === fileId);
    if (!targetFile || !targetFile.extractedText || targetFile.isJokbo) {
        setErrorMessage("대상 교안 파일 또는 파일 내용이 없어 맞춤형 퀴즈를 생성할 수 없습니다.");
        return;
    }

    const notesForFile = [...incorrectAnswerNotes, ...shortAnswerIncorrectNotes, ...selectAllIncorrectNotes].filter(note => note.fileContextId === fileId);
    if (notesForFile.length === 0) {
        setErrorMessage(`"${targetFile.name}" 파일에 대한 오답 기록이 없어, 취약점 기반 퀴즈를 생성할 수 없습니다.`);
        return;
    }

    setIsLoading(true); 
    setLoadingTargetedQuizFileId(fileId); 
    setQuizCompleted(false); setUserAnswers({}); setCurrentQuestionIndex(0);
    setGeneratedQuestions([]);

    try {
        const questionsFromSdk = await generateTargetedQuizFromWeaknessesSdk(
            targetFile.name,
            targetFile.extractedText,
            notesForFile,
            numQuestions,
            difficulty
        );

        if (questionsFromSdk && Array.isArray(questionsFromSdk) && questionsFromSdk.length > 0) {
            const processedQuestions = questionsFromSdk.map(q => ({
                ...q,
                pageNum: (typeof q.pageNum === 'number' && q.pageNum > 0) ? q.pageNum : undefined, 
            }));

            const currentContext: ActiveQuizContext = {
                type: 'targetedPractice',
                fileId: targetFile.id,
                fileName: targetFile.name,
                associatedJokboFileId: targetFile.associatedJokboFileId
            };
            setActiveQuizContext(currentContext);
            setGeneratedQuestions(processedQuestions);
            setActiveView('quiz');
            setSuccessMessage(`"${targetFile.name}" 파일의 취약점 기반 AI 문제 생성 완료!`);
        } else {
            setErrorMessage("취약점 기반 문제 생성에 실패했습니다. 생성된 문제가 없습니다.");
            setGeneratedQuestions([]);
        }
    } catch (error) {
        console.error("Error in handleGenerateTargetedQuiz:", error);
        setErrorMessage("취약점 기반 문제 생성 중 오류 발생.");
        setGeneratedQuestions([]);
    } finally {
        setLoadingTargetedQuizFileId(null);
        setIsLoading(false); 
    }
  };

  const handleAutoClassifyNotes = async (noteSourceType: 'general' | 'shortAnswer' | 'selectAll' | 'jokboSimulated') => {
    let notesToClassifySource: Array<IncorrectNote | ShortAnswerIncorrectNote>;
    let setClassifyingState: React.Dispatch<React.SetStateAction<boolean>>;
    let setClassifiedNotesState: React.Dispatch<React.SetStateAction<Record<string, any> | null>>;

    switch (noteSourceType) {
        case 'general':
            notesToClassifySource = incorrectAnswerNotes;
            setClassifyingState = setIsClassifyingGeneralNotes;
            setClassifiedNotesState = setClassifiedGeneralNotes;
            break;
        case 'shortAnswer':
            notesToClassifySource = shortAnswerIncorrectNotes;
            setClassifyingState = setIsClassifyingShortAnswerNotes;
            setClassifiedNotesState = setClassifiedShortAnswerNotes;
            break;
        case 'selectAll': 
            notesToClassifySource = selectAllIncorrectNotes;
            setClassifyingState = setIsClassifyingSelectAllNotes;
            setClassifiedNotesState = setClassifiedSelectAllNotes;
            break;
        case 'jokboSimulated':
            notesToClassifySource = jokboSimulatedIncorrectNotes;
            setClassifyingState = setIsClassifyingJokboSimulatedNotes;
            setClassifiedNotesState = setClassifiedJokboSimulatedNotes;
            break;
        default:
            return;
    }

    const notesToClassify = notesToClassifySource
        .slice(0, MAX_NOTES_FOR_CLASSIFICATION)
        .map(note => ({ id: note.id, questionText: note.questionText, explanation: note.explanation }));

    if (notesToClassify.length === 0) {
        setErrorMessage("분류할 오답 노트가 없습니다.");
        return;
    }

    setClassifyingState(true);
    const classificationResult = await classifyIncorrectNotesSdk(notesToClassify);

    if (classificationResult) {
        const notesById = new Map<string, IncorrectNote | ShortAnswerIncorrectNote>();
        notesToClassifySource.forEach(note => notesById.set(note.id, note));

        const groupedNotes: Record<string, Array<IncorrectNote | ShortAnswerIncorrectNote>> = {};
        for (const category in classificationResult) {
            groupedNotes[category] = classificationResult[category]
                .map(noteId => notesById.get(noteId))
                .filter(note => note !== undefined) as Array<IncorrectNote | ShortAnswerIncorrectNote>;
        }
        
        setClassifiedNotesState(groupedNotes);
        setSuccessMessage("AI 오답 자동 분류 완료!");
    } else {
        setErrorMessage("AI 오답 자동 분류에 실패했습니다.");
        setClassifiedNotesState(null);
    }
    setClassifyingState(false);
  };

  const clearClassification = (noteSourceType: 'general' | 'shortAnswer' | 'selectAll' | 'jokboSimulated') => {
    if (noteSourceType === 'general') setClassifiedGeneralNotes(null);
    else if (noteSourceType === 'shortAnswer') setClassifiedShortAnswerNotes(null);
    else if (noteSourceType === 'selectAll') setClassifiedSelectAllNotes(null); 
    else if (noteSourceType === 'jokboSimulated') setClassifiedJokboSimulatedNotes(null);
  };
  
  const handleDeleteFile = (fileId: string) => {
    const fileToDelete = files.find(f => f.id === fileId);
    if (!fileToDelete) return;

    if (window.confirm(`정말로 '${fileToDelete.name}' 파일을 삭제하시겠습니까? 이 파일과 관련된 모든 오답 노트 및 학습 분석 데이터도 함께 삭제됩니다.`)) {
      setFiles(prev => prev.filter(f => f.id !== fileId));
      if (selectedFile && selectedFile.id === fileId) {
        setSelectedFile(null);
        setAiSuggestedSections([]);
      }
      setIncorrectAnswerNotes(prev => prev.filter(n => n.fileContextId !== fileId));
      setShortAnswerIncorrectNotes(prev => prev.filter(n => n.fileContextId !== fileId));
      setSelectAllIncorrectNotes(prev => prev.filter(n => n.fileContextId !== fileId)); 
      setJokboSimulatedIncorrectNotes(prev => prev.filter(n => n.fileContextId !== fileId)); 
      setLearningGuides(prev => { const newState = {...prev}; delete newState[fileId]; return newState; });
      setConceptMaps(prev => { const newState = {...prev}; delete newState[fileId]; return newState; });
      setChatMessagesByFileId(prev => { const newState = {...prev}; delete newState[fileId]; return newState; });
      setTtsScripts(prev => { const newState = {...prev}; delete newState[fileId]; return newState; });
      setTopicWeaknessAnalysis(prev => { const newState = {...prev}; delete newState[fileId]; return newState; });
      setLearningPathways(prev => { const newState = {...prev}; delete newState[fileId]; return newState; });

      setFiles(prevAllFiles => prevAllFiles.map(gyoanFile => {
        if (gyoanFile.associatedJokboFileId === fileId) {
          return { ...gyoanFile, associatedJokboFileId: null };
        }
        return gyoanFile;
      }));

      setSuccessMessage(`'${fileToDelete.name}' 파일 및 관련 데이터 삭제 완료.`);
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) return;

    const filesInFolder = files.filter(f => f.folderId === folderId);
    const subfolders = folders.filter(f => f.parentId === folderId);

    if (filesInFolder.length > 0 || subfolders.length > 0) {
      if (!window.confirm(`'${folderToDelete.name}' 폴더에는 파일 또는 하위 폴더가 포함되어 있습니다. 정말로 삭제하시겠습니까? 내부의 모든 파일과 하위 폴더도 삭제됩니다.`)) {
        return;
      }
    } else {
      if (!window.confirm(`'${folderToDelete.name}' 폴더를 삭제하시겠습니까?`)) {
        return;
      }
    }

    const folderIdsToDelete = new Set<string>();
    const q: string[] = [folderId];
    while (q.length > 0) {
        const currentId = q.shift()!;
        folderIdsToDelete.add(currentId);
        folders.filter(f => f.parentId === currentId).forEach(sf => q.push(sf.id));
    }

    const fileIdsInDeletedFolders: string[] = [];
    files.forEach(file => {
        if (file.folderId && folderIdsToDelete.has(file.folderId)) {
            fileIdsInDeletedFolders.push(file.id);
        }
    });

    setFolders(prev => prev.filter(f => !folderIdsToDelete.has(f.id)));
    setFiles(prev => prev.filter(f => !(f.folderId && folderIdsToDelete.has(f.folderId))));
    
    fileIdsInDeletedFolders.forEach(deletedFileId => {
        if (selectedFile && selectedFile.id === deletedFileId) {
            setSelectedFile(null);
            setAiSuggestedSections([]);
        }
        setIncorrectAnswerNotes(prev => prev.filter(n => n.fileContextId !== deletedFileId));
        setShortAnswerIncorrectNotes(prev => prev.filter(n => n.fileContextId !== deletedFileId));
        setSelectAllIncorrectNotes(prev => prev.filter(n => n.fileContextId !== deletedFileId)); 
        setJokboSimulatedIncorrectNotes(prev => prev.filter(n => n.fileContextId !== deletedFileId)); 
        setLearningGuides(prev => { const newState = {...prev}; delete newState[deletedFileId]; return newState; });
        setConceptMaps(prev => { const newState = {...prev}; delete newState[deletedFileId]; return newState; });
        setChatMessagesByFileId(prev => { const newState = {...prev}; delete newState[deletedFileId]; return newState; });
        setTtsScripts(prev => { const newState = {...prev}; delete newState[deletedFileId]; return newState; });
        setTopicWeaknessAnalysis(prev => { const newState = {...prev}; delete newState[deletedFileId]; return newState; });
        setLearningPathways(prev => { const newState = {...prev}; delete newState[deletedFileId]; return newState; });
        setFiles(prevAllFiles => prevAllFiles.map(gyoanFile => {
          if (gyoanFile.associatedJokboFileId === deletedFileId) {
            return { ...gyoanFile, associatedJokboFileId: null };
          }
          return gyoanFile;
        }));
    });
    
    if (currentFolderId && folderIdsToDelete.has(currentFolderId)) {
        setCurrentFolderId(folderToDelete.parentId);
    }
    setSuccessMessage(`'${folderToDelete.name}' 폴더 및 내용 삭제 완료.`);
  };

  const openMoveFileModal = (file: FileData) => {
    setFileToMove(file);
    setIsFileMoveModalOpen(true);
  };

  const handleConfirmMoveFile = (fileId: string, destinationFolderId: string) => {
    setFiles(prevFiles => prevFiles.map(f => 
      f.id === fileId ? { ...f, folderId: destinationFolderId } : f
    ));
    if (selectedFile && selectedFile.id === fileId) {
      setSelectedFile(prev => prev ? { ...prev, folderId: destinationFolderId } : null);
    }
    setIsFileMoveModalOpen(false);
    setFileToMove(null);
    setSuccessMessage("파일이 성공적으로 이동되었습니다.");
  };

  const openAssociateJokboModal = (file: FileData) => {
    if (file.isJokbo) {
      setErrorMessage("족보 파일 자체에는 다른 족보를 연결할 수 없습니다.");
      return;
    }
    setFileToAssociateJokboWith(file);
    setIsAssociateJokboModalOpen(true);
  };

  const handleConfirmAssociateJokbo = (gyoanFileId: string, jokboFileId: string | null) => {
    setFiles(prevFiles => prevFiles.map(f => 
      f.id === gyoanFileId ? { ...f, associatedJokboFileId: jokboFileId } : f
    ));
    if (selectedFile && selectedFile.id === gyoanFileId) {
      setSelectedFile(prev => prev ? { ...prev, associatedJokboFileId: jokboFileId } : null);
    }
    setIsAssociateJokboModalOpen(false);
    setFileToAssociateJokboWith(null);
    setSuccessMessage(jokboFileId ? "족보 파일이 성공적으로 연결되었습니다." : "족보 파일 연결이 해제되었습니다.");
  };
  
  const handleDissociateJokbo = (gyoanFileId: string) => {
    setFiles(prevFiles => prevFiles.map(f => 
      f.id === gyoanFileId ? { ...f, associatedJokboFileId: null } : f
    ));
     if (selectedFile && selectedFile.id === gyoanFileId) {
      setSelectedFile(prev => prev ? { ...prev, associatedJokboFileId: null } : null);
    }
    setSuccessMessage("족보 파일 연결이 해제되었습니다.");
  };

  const handleGenerateTtsScript = async (
    sourceId: string, 
    sourceName: string, 
    sourceFullText: string, 
    notesForSource: Array<IncorrectNote | ShortAnswerIncorrectNote>
  ) => {
      if (!sourceFullText && notesForSource.length === 0) {
          setErrorMessage(`"${sourceName}"에 대한 텍스트 내용이나 오답 기록이 없어 AI 음성 해설을 생성할 수 없습니다.`);
          return;
      }
      setLoadingTtsScriptFileId(sourceId);
      setIsLoading(true); 
      setTtsScripts(prev => ({ ...prev, [sourceId]: '' }));

      const script = await generateTtsScriptForWeaknessesSdk(sourceName, sourceFullText, notesForSource);
      
      setTtsScripts(prev => ({ ...prev, [sourceId]: script || `죄송합니다, "${sourceName}"에 대한 음성 해설 스크립트 생성 중 오류가 발생했거나 내용이 생성되지 않았습니다.` }));
      setLoadingTtsScriptFileId(null);
      setIsLoading(false);
  };

  const handleAnalyzeTopicWeaknesses = async (
    sourceId: string,
    sourceName: string,
    notes: Array<IncorrectNote | ShortAnswerIncorrectNote>
  ) => {
    const notesForAnalysis = notes
        .slice(0, MAX_NOTES_FOR_TOPIC_ANALYSIS)
        .map(note => ({ questionText: note.questionText, explanation: note.explanation }));
    
    if (notesForAnalysis.length === 0) {
      setErrorMessage(`"${sourceName}"에 대한 오답 기록이 없어 주제별 취약점 분석을 할 수 없습니다.`);
      setTopicWeaknessAnalysis(prev => ({ ...prev, [sourceId]: [] }));
      return;
    }
    setLoadingTopicAnalysisFileId(sourceId);
    setIsLoading(true);
    setTopicWeaknessAnalysis(prev => ({ ...prev, [sourceId]: undefined })); 

    const analysisResult = await analyzeTopicWeaknessesSdk(sourceName, notesForAnalysis);
    
    setTopicWeaknessAnalysis(prev => ({ ...prev, [sourceId]: analysisResult || [] }));
    if (!analysisResult) {
      setErrorMessage(`"${sourceName}"의 주제별 취약점 분석 중 오류가 발생했거나 결과를 받지 못했습니다.`);
    }
    setLoadingTopicAnalysisFileId(null);
    setIsLoading(false);
  };

  const handleGenerateLearningPathway = async (
    sourceId: string,
    sourceName: string,
    notes: Array<IncorrectNote | ShortAnswerIncorrectNote>,
    sourceText?: string
  ) => {
    const notesForPathway = notes.slice(0, MAX_NOTES_FOR_PATHWAY_GENERATION);
    if (notesForPathway.length === 0) {
      setErrorMessage(`"${sourceName}"에 대한 오답 기록이 없어 학습 경로를 설계할 수 없습니다.`);
      setLearningPathways(prev => ({ ...prev, [sourceId]: [] }));
      return;
    }

    const notesSummary = notesForPathway.map(n => 
      `문제: ${n.questionText}\n학생 답: ${Array.isArray(n.userAnswer) ? n.userAnswer.join(', ') : (n.userAnswer || "답변 안함")}\n정답: ${n.correctAnswer}\n해설: ${n.explanation}`
    ).join('\n\n---\n\n');

    setLoadingLearningPathwayFileId(sourceId);
    setIsLoading(true);
    setLearningPathways(prev => ({ ...prev, [sourceId]: undefined }));

    const pathwayResult = await generateLearningPathwaySdk(sourceName, notesSummary, sourceText);

    setLearningPathways(prev => ({ ...prev, [sourceId]: pathwayResult || [] }));
    if (!pathwayResult) {
      setErrorMessage(`"${sourceName}"의 정밀 학습 경로 설계 중 오류가 발생했거나 결과를 받지 못했습니다.`);
    } else {
      setSuccessMessage(`"${sourceName}"에 대한 AI 정밀 학습 경로 설계 완료!`);
    }
    setLoadingLearningPathwayFileId(null);
    setIsLoading(false);
  };


  const handleExportData = () => {
    setIsLoading(true);
    try {
      const dataToExport: ExportedAppData = {
        version: APP_DATA_VERSION,
        timestamp: new Date().toISOString(),
        data: {
          folders,
          files: files.map(({ pdfRawData, firstPageImageBase64, ...file }) => file), 
          incorrectAnswerNotes,
          shortAnswerIncorrectNotes: shortAnswerIncorrectNotes || [],
          selectAllIncorrectNotes: selectAllIncorrectNotes || [], 
          jokboSimulatedIncorrectNotes: jokboSimulatedIncorrectNotes || [], 
          settings: {
            theme,
            fontSize,
            numQuestions,
            difficulty,
            sortCriteria,
            // activeView and retryQuizOrder are part of StoredAppData, not ExportedAppData.settings
            // So they are correctly omitted here.
          },
          chatMessagesByFileId: chatMessagesByFileId || {},
          topicWeaknessAnalysis: topicWeaknessAnalysis || {},
          learningPathways: learningPathways || {},
        }
      };
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `jejuPharmAiLearnerData-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMessage("데이터 내보내기 성공!");
    } catch (error: any) {
      console.error("Error exporting data:", error);
      setErrorMessage(`데이터 내보내기 오류: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerImport = () => {
    if (importDataInputRef.current) {
      importDataInputRef.current.click();
    }
  };
  
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const imported = JSON.parse(result) as ExportedAppData;

        if (!imported.version || !imported.data) {
          throw new Error("유효하지 않은 데이터 파일 형식입니다. 'version' 또는 'data' 필드가 없습니다.");
        }
        
        if (compareVersions(imported.version, APP_DATA_VERSION) > 0) {
             if (!window.confirm(`경고: 가져오려는 데이터(${imported.version})는 현재 앱 버전(${APP_DATA_VERSION})보다 최신 버전입니다. 일부 기능이 정상 작동하지 않을 수 있습니다. 계속하시겠습니까?`)){
                setIsLoading(false);
                if (event.target) event.target.value = '';
                return;
            }
        }
        if (compareVersions(imported.version, MIN_COMPATIBLE_VERSION) < 0) { 
             throw new Error(`데이터 버전(${imported.version})이 너무 오래되어 호환되지 않습니다. (최소 ${MIN_COMPATIBLE_VERSION} 필요)`);
        }


        setFolders(imported.data.folders || []);
        const loadedFiles: FileData[] = (imported.data.files || []).map(fStorage => ({
            id: fStorage.id,
            name: fStorage.name,
            folderId: fStorage.folderId,
            extractedText: fStorage.extractedText || "",
            structuredText: fStorage.structuredText || [],
            firstPageImageBase64: null, // Initialize to null as it's not in ExportedAppData.files
            pdfRawData: undefined, 
            createdAt: fStorage.createdAt,
            fileType: fStorage.fileType,
            sections: fStorage.sections || [],
            isJokbo: fStorage.isJokbo === undefined ? false : fStorage.isJokbo,
            associatedJokboFileId: fStorage.associatedJokboFileId === undefined ? null : fStorage.associatedJokboFileId,
        }));
        setFiles(loadedFiles);

        setIncorrectAnswerNotes((imported.data.incorrectAnswerNotes || []).map(n => ({ ...n, srsLevel: n.srsLevel || 0 })));
        setShortAnswerIncorrectNotes((imported.data.shortAnswerIncorrectNotes || []).map(n => ({ ...n, srsLevel: n.srsLevel || 0 })));
        setSelectAllIncorrectNotes((imported.data.selectAllIncorrectNotes || []).map(n => ({ ...n, srsLevel: n.srsLevel || 0 }))); 
        setJokboSimulatedIncorrectNotes((imported.data.jokboSimulatedIncorrectNotes || []).map(n => ({ ...n, srsLevel: n.srsLevel || 0 }))); 
        
        if (imported.data.settings) {
            setTheme(imported.data.settings.theme || 'dark');
            setFontSize(imported.data.settings.fontSize || 16);
            setNumQuestions(imported.data.settings.numQuestions || 10);
            setDifficulty(imported.data.settings.difficulty || '보통');
            setSortCriteria(imported.data.settings.sortCriteria || 'name');
        }
        setChatMessagesByFileId(imported.data.chatMessagesByFileId || {});
        setTopicWeaknessAnalysis(imported.data.topicWeaknessAnalysis || {});
        setLearningPathways(imported.data.learningPathways || {});

        setSelectedFile(null);
        setCurrentFolderId(null);
        setActiveView('fileManager');
        setAiSuggestedSections([]);
        setLearningGuides({});
        setConceptMaps({});
        setTtsScripts({});
        // Retry quiz order will default or be set from loaded StoredAppData if it was saved there
        
        setSuccessMessage("데이터 가져오기 성공! 애플리케이션 상태가 업데이트되었습니다.");
      } catch (error: any) {
        console.error("Error importing data:", error);
        setErrorMessage(`데이터 가져오기 오류: ${error.message}`);
      } finally {
        setIsLoading(false);
        if (event.target) event.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  const handleNoteReviewed = (noteId: string, noteType: 'general' | 'shortAnswer' | 'selectAll' | 'jokboSimulated', level: RecallLevel) => {
    const now = new Date();
    let newNextReviewAt: Date = new Date(now);
    let currentSrsLevel = 0;

    const findNoteAndUpdate = (notesArray: IncorrectNote[], setter: React.Dispatch<React.SetStateAction<IncorrectNote[]>>): boolean => {
        const noteIndex = notesArray.findIndex(n => n.id === noteId);
        if (noteIndex === -1) return false;

        const note = notesArray[noteIndex];
        currentSrsLevel = note.srsLevel || 0;

        switch (level) {
            case 'again':
                newNextReviewAt.setMinutes(now.getMinutes() + 10); 
                currentSrsLevel = 0;
                break;
            case 'hard':
                newNextReviewAt.setDate(now.getDate() + 1); 
                currentSrsLevel = Math.max(0, currentSrsLevel -1); 
                if(currentSrsLevel < 1) currentSrsLevel = 1;
                break;
            case 'good':
                currentSrsLevel++;
                if (currentSrsLevel === 1) newNextReviewAt.setDate(now.getDate() + 2); 
                else if (currentSrsLevel === 2) newNextReviewAt.setDate(now.getDate() + 5); 
                else newNextReviewAt.setDate(now.getDate() + Math.min(30, currentSrsLevel * 3)); 
                break;
            case 'easy':
                currentSrsLevel += 2;
                 if (currentSrsLevel <= 2) newNextReviewAt.setDate(now.getDate() + 7); 
                 else newNextReviewAt.setDate(now.getDate() + Math.min(60, currentSrsLevel * 4)); 
                break;
        }
        
        const updatedNote = {
            ...note,
            lastReviewedAt: now.toISOString(),
            nextReviewAt: newNextReviewAt.toISOString(),
            srsLevel: currentSrsLevel,
        };
        
        const newNotes = [...notesArray];
        newNotes[noteIndex] = updatedNote;
        setter(newNotes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        return true;
    };

    let updated = false;
    if (noteType === 'general') {
        updated = findNoteAndUpdate(incorrectAnswerNotes, setIncorrectAnswerNotes);
    } else if (noteType === 'shortAnswer') {
        updated = findNoteAndUpdate(shortAnswerIncorrectNotes, setShortAnswerIncorrectNotes);
    } else if (noteType === 'selectAll') { 
        updated = findNoteAndUpdate(selectAllIncorrectNotes, setSelectAllIncorrectNotes);
    } else if (noteType === 'jokboSimulated') {
        updated = findNoteAndUpdate(jokboSimulatedIncorrectNotes, setJokboSimulatedIncorrectNotes);
    }
    
    if(updated) setSuccessMessage("복습 정보가 기록되었습니다.");
  };

  const confirmDeleteNotesBySection = (
    fileId: string, 
    sectionId: string, 
    sectionName: string, 
    notesCount: number,
    noteType: 'general' | 'shortAnswer' | 'selectAll' 
  ) => {
    if (notesCount === 0) {
      setErrorMessage("선택된 대단원에는 삭제할 오답이 없습니다.");
      return;
    }
    const sourceFile = files.find(f => f.id === fileId);
    if (!sourceFile) {
        setErrorMessage("오답을 삭제할 원본 파일을 찾을 수 없습니다.");
        return;
    }

    setModalContent({
      title: "대단원 오답 삭제 확인",
      body: <p>'{sourceFile.name}' 파일의 '{sectionName}' 대단원에 있는 {notesCount}개의 오답 노트를 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>,
      actions: (
        <>
          <button onClick={() => setIsModalOpen(false)} className="bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 text-slate-800 dark:text-gray-100 font-semibold py-2 px-4 rounded-lg mr-2">취소</button>
          <button 
            onClick={() => {
              performDeleteNotesBySection(fileId, sectionId, noteType);
              setIsModalOpen(false);
            }} 
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            삭제
          </button>
        </>
      )
    });
    setIsModalOpen(true);
  };

  const performDeleteNotesBySection = (fileId: string, sectionId: string, noteType: 'general' | 'shortAnswer' | 'selectAll') => {
    let notesSetter: React.Dispatch<React.SetStateAction<any[]>>;
    let classifiedNotes: Record<string, any[]> | null;
    let classifiedNotesSetter: React.Dispatch<React.SetStateAction<Record<string, any[]> | null>>;
    let typeName = "";

    switch(noteType) {
        case 'general':
            notesSetter = setIncorrectAnswerNotes;
            classifiedNotes = classifiedGeneralNotes;
            classifiedNotesSetter = setClassifiedGeneralNotes;
            typeName = "선택형";
            break;
        case 'shortAnswer':
            notesSetter = setShortAnswerIncorrectNotes as React.Dispatch<React.SetStateAction<any[]>>;
            classifiedNotes = classifiedShortAnswerNotes;
            classifiedNotesSetter = setClassifiedShortAnswerNotes  as React.Dispatch<React.SetStateAction<Record<string, any[]> | null>>;
            typeName = "단답형";
            break;
        case 'selectAll': 
            notesSetter = setSelectAllIncorrectNotes as React.Dispatch<React.SetStateAction<any[]>>;
            classifiedNotes = classifiedSelectAllNotes;
            classifiedNotesSetter = setClassifiedSelectAllNotes  as React.Dispatch<React.SetStateAction<Record<string, any[]> | null>>;
            typeName = "모두선택";
            break;
        
        default: return; 
    }

    let deletedCount = 0;
    notesSetter(prevNotes => {
        const notesBefore = prevNotes.length;
        const updatedNotes = prevNotes.filter(note => {
            if (note.fileContextId === fileId && note.sectionId === sectionId) {
                return false; 
            }
            return true;
        });
        deletedCount = notesBefore - updatedNotes.length;
        return updatedNotes;
    });

    if (deletedCount > 0 && classifiedNotes) {
        const newClassification: Record<string, any[]> = {};
        for (const category in classifiedNotes) {
            const notesInCategory = classifiedNotes[category].filter(n => !(n.fileContextId === fileId && n.sectionId === sectionId));
            if (notesInCategory.length > 0) {
                newClassification[category] = notesInCategory;
            }
        }
        classifiedNotesSetter(Object.keys(newClassification).length > 0 ? newClassification : null);
    }
    setSuccessMessage(`${typeName} 오답 노트 중 선택된 대단원의 오답 ${deletedCount}개가 삭제되었습니다.`);
  };

  const confirmDeleteNotesBySourceFile = (fileId: string, fileName: string, notesCount: number) => {
    if (notesCount === 0) {
      setErrorMessage(`"${fileName}" 족보에는 삭제할 AI 생성 오답이 없습니다.`);
      return;
    }
    setModalContent({
      title: "AI 족보 오답 삭제 확인",
      body: <p>원본 족보 파일 '{fileName}'을 기반으로 생성된 AI 오답 노트 {notesCount}개를 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>,
      actions: (
        <>
          <button onClick={() => setIsModalOpen(false)} className="bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 text-slate-800 dark:text-gray-100 font-semibold py-2 px-4 rounded-lg mr-2">취소</button>
          <button 
            onClick={() => {
              performDeleteJokboSimulatedNotesBySourceFile(fileId);
              setIsModalOpen(false);
            }} 
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            삭제
          </button>
        </>
      )
    });
    setIsModalOpen(true);
  };
  
  const performDeleteJokboSimulatedNotesBySourceFile = (fileId: string) => {
    let deletedCount = 0;
    setJokboSimulatedIncorrectNotes(prevNotes => {
        const notesBefore = prevNotes.length;
        const updatedNotes = prevNotes.filter(note => {
            if (note.fileContextId === fileId) {
                return false; 
            }
            return true;
        });
        deletedCount = notesBefore - updatedNotes.length;
        return updatedNotes;
    });

    if (deletedCount > 0 && classifiedJokboSimulatedNotes) {
        const newClassification: Record<string, IncorrectNote[]> = {};
        for (const category in classifiedJokboSimulatedNotes) {
            const notesInCategory = classifiedJokboSimulatedNotes[category].filter(n => n.fileContextId !== fileId);
            if (notesInCategory.length > 0) {
                newClassification[category] = notesInCategory;
            }
        }
        setClassifiedJokboSimulatedNotes(Object.keys(newClassification).length > 0 ? newClassification : null);
    }
    setSuccessMessage(`AI 족보 오답 노트 중 선택된 족보 파일 기반 오답 ${deletedCount}개가 삭제되었습니다.`);
  };

  const openMoveNoteModalHandler = (note: IncorrectNote, currentCategory: NoteCategoryType) => {
    setNoteToMoveDetails({ note, currentCategory });
    setIsMoveNoteModalOpen(true);
  };

  const handleConfirmMoveNote = (destinationCategory: NoteCategoryType) => {
    if (!noteToMoveDetails) return;

    const { note: noteToMove, currentCategory: sourceCategory } = noteToMoveDetails;
    
    
    if (sourceCategory === 'general') {
      setIncorrectAnswerNotes(prev => prev.filter(n => n.id !== noteToMove.id));
    } else if (sourceCategory === 'shortAnswer') {
      setShortAnswerIncorrectNotes(prev => prev.filter(n => n.id !== noteToMove.id));
    } else if (sourceCategory === 'selectAll') { 
      setSelectAllIncorrectNotes(prev => prev.filter(n => n.id !== noteToMove.id));
    } else if (sourceCategory === 'jokboSimulated') {
      setJokboSimulatedIncorrectNotes(prev => prev.filter(n => n.id !== noteToMove.id));
    }

    
    if (destinationCategory === 'general') {
      setIncorrectAnswerNotes(prev => [...prev, noteToMove].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } else if (destinationCategory === 'shortAnswer') {
      setShortAnswerIncorrectNotes(prev => [...prev, noteToMove as ShortAnswerIncorrectNote].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } else if (destinationCategory === 'selectAll') { 
      setSelectAllIncorrectNotes(prev => [...prev, noteToMove].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } else if (destinationCategory === 'jokboSimulated') {
      setJokboSimulatedIncorrectNotes(prev => [...prev, noteToMove].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }

    setSuccessMessage(`오답 노트가 성공적으로 이동되었습니다.`);
    setIsMoveNoteModalOpen(false);
    setNoteToMoveDetails(null);
  };


  const renderView = () => {
    switch (activeView) {
      case 'fileManager':
        return <FileManagerView
          folders={folders}
          files={files}
          currentFolderId={currentFolderId}
          setCurrentFolderId={setCurrentFolderId}
          onCreateFolder={handleCreateFolder}
          onFileUpload={handleFileUpload}
          onSelectFile={loadSelectedFileData}
          isPdfJsReady={isPdfJsReady}
          onDeleteFile={handleDeleteFile}
          onDeleteFolder={handleDeleteFolder}
          sortCriteria={sortCriteria}
          setSortCriteria={setSortCriteria}
          onExportData={handleExportData}
          onTriggerImport={handleTriggerImport}
          openMoveFileModal={openMoveFileModal}
          openAssociateJokboModal={openAssociateJokboModal}
        />;
      case 'dashboard':
        return <DashboardView
          onStartQuiz={handleStartQuiz}
          onStartSimilarJokboQuiz={handleStartSimilarJokboQuiz}
          selectedFile={selectedFile}
          files={files}
          numQuestions={numQuestions}
          setNumQuestions={setNumQuestions}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          onAiToolClick={handleAiToolClick}
          isPdfJsReady={isPdfJsReady} 
          onManageSections={() => setIsManageSectionsModalOpen(true)}
          onAutoSegmentSections={handleAutoSegmentSections}
          aiSuggestedSections={aiSuggestedSections}
          isLoadingAiSections={isLoadingAiSections}
          isLoading={isLoading} 
          chatHistory={chatMessagesByFileId[GLOBAL_ADVICE_CHAT_KEY] || []}
          onSendMessageToChatbot={handleSendMessageToChatbot}
          onResetChatHistory={handleResetGlobalAdviceChat}
          isChatbotLoading={isChatbotLoading}
          openAssociateJokboModal={openAssociateJokboModal}
          onDissociateJokbo={handleDissociateJokbo}
        />;
      case 'quiz':
        if (!generatedQuestions || generatedQuestions.length === 0 || currentQuestionIndex >= generatedQuestions.length) {
          setActiveView('dashboard'); return null;
        }
        return <QuizView
          question={generatedQuestions[currentQuestionIndex]}
          qIndex={currentQuestionIndex}
          totalQuestions={generatedQuestions.length}
          onSubmitAnswer={handleAnswerSubmit}
          onPreviousQuestion={handlePreviousQuestion}
          quizContext="quiz"
        />;
      case 'retryQuiz':
         if (!generatedQuestions || generatedQuestions.length === 0 || currentQuestionIndex >= generatedQuestions.length) {
          setActiveView('notes'); return null; 
        }
        return <QuizView
            question={generatedQuestions[currentQuestionIndex] as IncorrectNote}
            qIndex={currentQuestionIndex}
            totalQuestions={generatedQuestions.length}
            onSubmitAnswer={handleAnswerSubmit}
            onPreviousQuestion={handlePreviousQuestion}
            quizContext="retryQuiz"
            onDeepDiveFromQuiz={fetchDeepDiveAnalysis}
            onDeleteFromQuiz={handleDeleteFromRetryQuiz}
        />;
      case 'results':
        return <ResultsView
          questions={generatedQuestions}
          answers={userAnswers}
          score={quizScore}
          onViewNotes={() => setActiveView('notes')}
          onRetakeQuiz={() => {
            setCurrentQuestionIndex(0);
            setUserAnswers({});
            setQuizCompleted(false);
            // Retain the current retryQuizOrder for consistency
            setActiveView('quiz');
          }}
        />;
      case 'notes':
        return <IncorrectAnswerNoteView
          notes={incorrectAnswerNotes}
          files={files}
          onDeepDive={fetchDeepDiveAnalysis}
          onDelete={(noteId) => deleteIncorrectNoteFromLocal(noteId, 'general')}
          onRetryAllNotes={(notesToRetry) => retryAllNotes(notesToRetry, 'general', retryQuizOrder)}
          onRequestCorrectiveFeedback={handleRequestCorrectiveFeedback}
          onDeleteAllNotes={() => {
            if(window.confirm("정말로 모든 선택형 오답을 삭제하시겠습니까?")) {
                setIncorrectAnswerNotes([]);
                setClassifiedGeneralNotes(null);
                setSuccessMessage("모든 선택형 오답이 삭제되었습니다.");
            }
          }}
          onAutoClassify={() => handleAutoClassifyNotes('general')}
          isClassifying={isClassifyingGeneralNotes}
          classifiedNotesData={classifiedGeneralNotes}
          onClearClassification={() => clearClassification('general')}
          selectedFileFilter={generalNoteFileFilter}
          setSelectedFileFilter={setGeneralNoteFileFilter}
          selectedSectionFilter={generalNoteSectionFilter}
          setSelectedSectionFilter={setGeneralNoteSectionFilter}
          onNoteReviewed={(noteId, level) => handleNoteReviewed(noteId, 'general', level)}
          onDeleteNotesBySection={(fileId, sectionId, sectionName, notesCount) => 
            confirmDeleteNotesBySection(fileId, sectionId, sectionName, notesCount, 'general')}
          onOpenMoveNoteModal={openMoveNoteModalHandler}
          retryQuizOrder={retryQuizOrder}
          setRetryQuizOrder={setRetryQuizOrder}
        />;
      case 'shortAnswerNotes':
        return <ShortAnswerNoteView
          notes={shortAnswerIncorrectNotes}
          files={files}
          onDeepDive={fetchDeepDiveAnalysis}
          onDelete={(noteId) => deleteIncorrectNoteFromLocal(noteId, 'shortAnswer')}
          onRetryAllNotes={(notesToRetry) => retryAllNotes(notesToRetry, 'shortAnswer', retryQuizOrder)}
          onRequestCorrectiveFeedback={handleRequestCorrectiveFeedback}
          onDeleteAllNotes={() => {
            if(window.confirm("정말로 모든 단답형 오답을 삭제하시겠습니까?")) {
                setShortAnswerIncorrectNotes([]);
                setClassifiedShortAnswerNotes(null);
                setSuccessMessage("모든 단답형 오답이 삭제되었습니다.");
            }
          }}
          onAutoClassify={() => handleAutoClassifyNotes('shortAnswer')}
          isClassifying={isClassifyingShortAnswerNotes}
          classifiedNotesData={classifiedShortAnswerNotes}
          onClearClassification={() => clearClassification('shortAnswer')}
          selectedFileFilter={shortAnswerNoteFileFilter}
          setSelectedFileFilter={setShortAnswerNoteFileFilter}
          selectedSectionFilter={shortAnswerNoteSectionFilter}
          setSelectedSectionFilter={setShortAnswerNoteSectionFilter}
          onNoteReviewed={(noteId, level) => handleNoteReviewed(noteId, 'shortAnswer', level)}
          onDeleteNotesBySection={(fileId, sectionId, sectionName, notesCount) => 
            confirmDeleteNotesBySection(fileId, sectionId, sectionName, notesCount, 'shortAnswer')}
          onOpenMoveNoteModal={openMoveNoteModalHandler}
          retryQuizOrder={retryQuizOrder}
          setRetryQuizOrder={setRetryQuizOrder}
        />;
      case 'selectAllNotes': 
        return <SelectAllIncorrectAnswerNoteView
          notes={selectAllIncorrectNotes}
          files={files}
          onDeepDive={fetchDeepDiveAnalysis}
          onDelete={(noteId) => deleteIncorrectNoteFromLocal(noteId, 'selectAll')}
          onRetryAllNotes={(notesToRetry) => retryAllNotes(notesToRetry, 'selectAll', retryQuizOrder)}
          onRequestCorrectiveFeedback={handleRequestCorrectiveFeedback}
          onDeleteAllNotes={() => {
            if(window.confirm("정말로 모든 '모두 선택' 유형 오답을 삭제하시겠습니까?")) {
                setSelectAllIncorrectNotes([]);
                setClassifiedSelectAllNotes(null);
                setSuccessMessage("모든 '모두 선택' 유형 오답이 삭제되었습니다.");
            }
          }}
          onAutoClassify={() => handleAutoClassifyNotes('selectAll')}
          isClassifying={isClassifyingSelectAllNotes}
          classifiedNotesData={classifiedSelectAllNotes}
          onClearClassification={() => clearClassification('selectAll')}
          selectedFileFilter={selectAllNoteFileFilter}
          setSelectedFileFilter={setSelectAllNoteFileFilter}
          selectedSectionFilter={selectAllNoteSectionFilter}
          setSelectedSectionFilter={setSelectAllNoteSectionFilter}
          onNoteReviewed={(noteId, level) => handleNoteReviewed(noteId, 'selectAll', level)}
          onDeleteNotesBySection={(fileId, sectionId, sectionName, notesCount) => 
            confirmDeleteNotesBySection(fileId, sectionId, sectionName, notesCount, 'selectAll')}
          onOpenMoveNoteModal={openMoveNoteModalHandler}
          retryQuizOrder={retryQuizOrder}
          setRetryQuizOrder={setRetryQuizOrder}
        />;
      case 'jokboSimulatedNotes':
        return <JokboSimulatedIncorrectAnswerNoteView
          notes={jokboSimulatedIncorrectNotes}
          files={files}
          onDeepDive={fetchDeepDiveAnalysis}
          onDelete={(noteId) => deleteIncorrectNoteFromLocal(noteId, 'jokboSimulated')}
          onRetryAllNotes={(notesToRetry) => retryAllNotes(notesToRetry, 'jokboSimulated', retryQuizOrder)}
          onRequestCorrectiveFeedback={handleRequestCorrectiveFeedback}
          onDeleteAllNotes={() => {
             if(window.confirm("정말로 모든 AI 족보/연계 오답을 삭제하시겠습니까?")) {
                setJokboSimulatedIncorrectNotes([]);
                setClassifiedJokboSimulatedNotes(null);
                setSuccessMessage("모든 AI 족보/연계 오답이 삭제되었습니다.");
            }
          }}
          onAutoClassify={() => handleAutoClassifyNotes('jokboSimulated')}
          isClassifying={isClassifyingJokboSimulatedNotes}
          classifiedNotesData={classifiedJokboSimulatedNotes}
          onClearClassification={() => clearClassification('jokboSimulated')}
          selectedFileFilter={jokboSimulatedNoteFileFilter}
          setSelectedFileFilter={setJokboSimulatedNoteFileFilter}
          onNoteReviewed={(noteId, level) => handleNoteReviewed(noteId, 'jokboSimulated', level)}
          onDeleteNotesBySourceFile={(fileId, fileName, notesCount) => 
            confirmDeleteNotesBySourceFile(fileId, fileName, notesCount)}
          onOpenMoveNoteModal={openMoveNoteModalHandler}
          retryQuizOrder={retryQuizOrder}
          setRetryQuizOrder={setRetryQuizOrder}
        />;
      case 'analysis':
        return <LearningAnalysisView
          onNavigateBack={() => setActiveView('dashboard')}
          incorrectAnswerNotes={[...incorrectAnswerNotes, ...shortAnswerIncorrectNotes, ...selectAllIncorrectNotes, ...jokboSimulatedIncorrectNotes]}
          files={files}
          onGenerateAsciiConceptMap={handleGenerateAsciiConceptMap}
          conceptMaps={conceptMaps}
          onGenerateLearningGuide={handleGenerateLearningGuide}
          learningGuides={learningGuides}
          isLoading={isLoading || loadingAiToolFileId !== null || loadingTargetedQuizFileId !== null || loadingTtsScriptFileId !== null || loadingTopicAnalysisFileId !== null || loadingLearningPathwayFileId !== null } 
          loadingAiToolFileId={loadingAiToolFileId}
          onGenerateTargetedQuiz={handleGenerateTargetedQuiz}
          loadingTargetedQuizFileId={loadingTargetedQuizFileId}
          ttsScripts={ttsScripts}
          onGenerateTtsScript={handleGenerateTtsScript}
          loadingTtsScriptFileId={loadingTtsScriptFileId}
          topicWeaknessAnalysis={topicWeaknessAnalysis}
          onAnalyzeTopicWeaknesses={handleAnalyzeTopicWeaknesses}
          loadingTopicAnalysisFileId={loadingTopicAnalysisFileId}
          learningPathways={learningPathways}
          onGenerateLearningPathway={handleGenerateLearningPathway}
          loadingLearningPathwayFileId={loadingLearningPathwayFileId}
        />;
      case 'aiToolExplanation':
        return <AiToolExplanationView
          toolName={currentAiToolName}
          explanation={aiToolExplanation}
          onBack={() => setActiveView('dashboard')}
          isLoading={isLoading}
        />;
      case 'deepDive':
        const sourceFileForDeepDive = currentDeepDiveQuestion?.fileContextId && currentDeepDiveQuestion.fileContextId !== '족보'
          ? files.find(f => f.id === currentDeepDiveQuestion.fileContextId)
          : null;
        return <DeepDiveView
          originalQuestion={currentDeepDiveQuestion}
          analysis={deepDiveContent}
          isLoading={isLoading}
          onBack={() => setActiveView(previousViewForDeepDive || 'notes')}
          onSolveQuestion={startDeepDiveQuiz}
          selectedFileFirstPageImage={sourceFileForDeepDive?.firstPageImageBase64 || null}
          selectedFilePdfRawData={sourceFileForDeepDive?.pdfRawData}
          files={files}
        />;
      case 'deepDiveQuiz':
        return <DeepDiveQuizView
          question={currentSolvingQuestion}
          onBack={() => setActiveView('deepDive')}
        />;
      case 'correctiveFeedback':
        return <CorrectiveFeedbackView
          feedback={correctiveFeedbackContent}
          isLoading={isLoading}
          onBack={() => setActiveView('notes')}
          onSolvePracticeQuestion={(question) => {
            setActiveQuizContext(null); 
            setGeneratedQuestions([question]);
            setCurrentQuestionIndex(0);
            setUserAnswers({});
            setQuizCompleted(false);
            setActiveView('retryQuiz');
          }}
        />;
      default:
        return <p>알 수 없는 뷰입니다.</p>;
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-200'} text-slate-900 dark:text-gray-100 transition-colors duration-300`}>
      <AppHeader
        currentView={activeView}
        onNavigate={setActiveView}
        selectedFileName={selectedFile ? selectedFile.name : null}
        isFileSelected={!!selectedFile}
        theme={theme}
        toggleTheme={toggleTheme}
        increaseFontSize={increaseFontSize}
        decreaseFontSize={decreaseFontSize}
        showFileSelectionAlert={() => setErrorMessage("이 기능을 사용하려면 먼저 파일 관리자에서 파일을 선택해주세요.")}
      />
      <main className="w-full max-w-5xl mx-auto p-4 bg-white dark:bg-slate-800 shadow-lg rounded-b-lg min-h-[calc(100vh-150px)]">
        {successMessage && (
          <div className="p-3 mb-4 text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-700 dark:bg-opacity-30 rounded-lg text-center fixed top-20 left-1/2 transform -translate-x-1/2 z-50 shadow-lg" role="alert">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-3 mb-4 text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-700 dark:bg-opacity-30 rounded-lg text-center fixed top-20 left-1/2 transform -translate-x-1/2 z-50 shadow-lg" role="alert">
            <div className="flex items-center justify-center">
              <span className="mr-2">{errorMessage}</span>
              <button onClick={() => setErrorMessage('')} className="ml-auto -mx-1.5 -my-1.5 bg-red-100 dark:bg-red-700 text-red-500 rounded-lg focus:ring-2 focus:ring-red-400 p-1.5 hover:bg-red-200 dark:hover:bg-red-600 inline-flex h-8 w-8 dark:text-red-300" aria-label="Dismiss">
                <span className="sr-only">Dismiss</span>
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        {renderView()}
      </main>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalContent.title}
        showCloseButton={true}
      >
        <div>{modalContent.body}</div>
        {modalContent.actions && (
          <div className="mt-4 flex justify-end">
            {modalContent.actions}
          </div>
        )}
      </Modal>
      {selectedFile && !selectedFile.isJokbo && (
        <ManageSectionsModal
          isOpen={isManageSectionsModalOpen}
          onClose={() => setIsManageSectionsModalOpen(false)}
          file={selectedFile}
          onSaveSections={handleSaveSections}
        />
      )}
       {fileToMove && (
        <MoveFileModal
          isOpen={isFileMoveModalOpen}
          onClose={() => setIsFileMoveModalOpen(false)}
          fileToMove={fileToMove}
          folders={folders}
          onConfirmMove={handleConfirmMoveFile}
        />
      )}
       {fileToAssociateJokboWith && (
        <AssociateJokboModal
          isOpen={isAssociateJokboModalOpen}
          onClose={() => setIsAssociateJokboModalOpen(false)}
          gyoanFile={fileToAssociateJokboWith}
          allJokboFiles={files.filter(f => f.isJokbo)}
          onConfirmAssociation={handleConfirmAssociateJokbo}
        />
      )}
      {noteToMoveDetails && (
        <MoveNoteModal
          isOpen={isMoveNoteModalOpen}
          onClose={() => setIsMoveNoteModalOpen(false)}
          noteToMoveDetails={noteToMoveDetails}
          onConfirmMove={handleConfirmMoveNote}
        />
      )}
      <input type="file" accept=".json" ref={importDataInputRef} onChange={handleImportData} className="hidden" />
    </div>
  );
}

export default App;
