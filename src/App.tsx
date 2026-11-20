import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Award,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronRight,
  BookOpenCheck,
  BrainCircuit,
  Settings,
  ListFilter,
  Check,
  AlertCircle,
  Maximize2,
  Minimize2,
  ExternalLink,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Infinity as InfinityIcon
} from "lucide-react";
import { Answer, Question, ExamMode, ExamSession, QuestionFormat } from "./types";
import { allQuestions as examQuestions } from "./questionBank";
import { CATEGORIES, EXAM_TOPICS, topicOf } from "./examTopics";
import { evidence } from "./evidenceBank";
import { DoubtfulMarks, loadDoubtful, saveDoubtful, toggleDoubtful } from "./doubtful";
import EvidenceBlock from "./components/EvidenceBlock";
import DoubtfulToggle from "./components/DoubtfulToggle";
import AskDialog, { AskButton } from "./components/AskDialog";
import { AskContext } from "./askPrompt";
import FormattedText, { FormattedExplanation } from "./components/FormattedText";
import QuestionBody from "./components/questions/QuestionBody";
import {
  AnswerHistory,
  infiniteQueue,
  loadHistory,
  pickPracticeQuestions,
  recordResults,
  saveHistory,
  statusOf,
} from "./answerHistory";
import { formatOf, isAnswered, isCorrect } from "./grading";
import { buildSessionLayout, MOCK_EXAM_SIZE, pickMockExam, shuffle } from "./sessionBuilder";

const FORMAT_LABELS: Record<QuestionFormat | "domc", string> = {
  multiple_choice: "Multiple choice",
  domc: "DOMC",
  fill_blank: "Fill in the blank",
  matching: "Matching",
  build_list: "Build list",
  hotspot: "Hotspot",
};

type Screen = "WELCOME" | "EXAM" | "RESULT";

/** Results-page button that starts the same kind of session again, with fresh questions. */
const NEW_SESSION_LABELS: Record<ExamMode, string> = {
  MOCK_EXAM: "Start a new mock exam",
  QUICK_QUIZ: "Start a new quiz",
  DOMAIN_PRACTICE: "Practice this topic again",
  INFINITE: "Continue infinite practice",
};

const QUIZ_SIZES = [5, 10, 20, 30, 50];
const QUIZ_SIZE_KEY = "dbt-exam-prep:quiz-size:v1";

const MODE_LABELS: Record<ExamMode, string> = {
  MOCK_EXAM: "Full Mock Exam",
  QUICK_QUIZ: "Quick Practice Quiz",
  DOMAIN_PRACTICE: "Topic Practice",
  INFINITE: "Infinite Practice",
};

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** URL hash for a screen: #/, #/results, #/exam/<mode>[/<domain>]. */
function hashFor(screen: Screen, session: ExamSession | null): string {
  if (screen === "RESULT") return "#/results";
  if (screen === "EXAM" && session) {
    const domain = session.targetDomain ? `/${slugify(session.targetDomain)}` : "";
    return `#/exam/${slugify(session.mode)}${domain}`;
  }
  return "#/";
}

function screenForHash(hash: string): Screen {
  if (hash.startsWith("#/exam")) return "EXAM";
  if (hash.startsWith("#/results")) return "RESULT";
  return "WELCOME";
}

const LEAVE_SESSION_PROMPT = "Leave this session without submitting? Your answers will not be scored.";

export default function App() {
  // Screens state
  const [screen, setScreen] = useState<Screen>("WELCOME");

  // Active Session
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [sidebarFilter, setSidebarFilter] = useState<"ALL" | "FLAGGED" | "UNANSWERED">("ALL");

  // Sidebar visibility & drag resize state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(288);
  const isDraggingSidebarRef = useRef<boolean>(false);

  // Global settings
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(true); // Practice mode allows checking answers instantly
  const [isPaused, setIsPaused] = useState(false);
  const [userCheckedCurrent, setUserCheckedCurrent] = useState(false); // In practice mode, has user checked answer on current Q?
  // "Ask about this question": the open dialog (question context plus any selected quote), and a short "copied" notice.
  const [ask, setAsk] = useState<{ context: AskContext; quote: string } | null>(null);
  const [askCopied, setAskCopied] = useState(false);
  const [selectionAsk, setSelectionAsk] = useState<{ id: number; text: string; left: number; top: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync fullscreen state with browser events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen request error:", err);
    }
  };

  // Handle dragging sidebar to resize or collapse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSidebarRef.current) return;
      const newWidth = e.clientX;
      if (newWidth < 140) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
        setSidebarWidth(Math.min(500, Math.max(200, newWidth)));
      }
    };

    const handleMouseUp = () => {
      if (isDraggingSidebarRef.current) {
        isDraggingSidebarRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingSidebarRef.current || !e.touches[0]) return;
      const newWidth = e.touches[0].clientX;
      if (newWidth < 140) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
        setSidebarWidth(Math.min(500, Math.max(200, newWidth)));
      }
    };

    const handleTouchEnd = () => {
      if (isDraggingSidebarRef.current) {
        isDraggingSidebarRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const startDraggingSidebar = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDraggingSidebarRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  // Active Timer state (represented as elapsed / remaining seconds)
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run timer for full MOCK_EXAM mode
    if (session && session.mode === "MOCK_EXAM" && !session.completed && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, isPaused]);

  // Format seconds to HH:MM:SS format
  /** Switches screen and records it in the URL so browser back/forward work. */
  const goTo = (next: Screen, sessionForHash: ExamSession | null = session) => {
    setScreen(next);
    const hash = hashFor(next, sessionForHash);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  };

  /** Abandons an unsubmitted session and returns to the dashboard. */
  const exitSession = () => {
    setSession(null);
    setIsPaused(false);
    goTo("WELCOME", null);
  };

  // Sessions are not persisted, so a reload always starts on the dashboard.
  useEffect(() => {
    if (window.location.hash !== "#/") window.history.replaceState(null, "", "#/");
  }, []);

  // Browser back/forward: confirm before abandoning an active session.
  useEffect(() => {
    const onPopState = () => {
      const target = screenForHash(window.location.hash);
      const inActiveSession = screen === "EXAM" && session && !session.completed;

      if (inActiveSession && target !== "EXAM") {
        if (confirm(LEAVE_SESSION_PROMPT)) {
          exitSession();
        } else {
          window.history.pushState(null, "", hashFor("EXAM", session));
        }
        return;
      }

      const reachable =
        target === "WELCOME" ||
        (target === "EXAM" && session && !session.completed) ||
        (target === "RESULT" && session?.completed);
      if (reachable) {
        setScreen(target);
      } else {
        window.history.replaceState(null, "", "#/");
        setScreen("WELCOME");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [screen, session]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
      h.toString().padStart(2, "0"),
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0")
    ].join(":");
  };

  const getCategoryShortTag = (category: string) => topicOf(category)?.short ?? category;
  const getCategoryColorStyles = (category: string) => topicOf(category)?.color ?? "bg-gray-50 text-gray-800 border-gray-200";

  // Graded-answer history across sessions; drives which questions practice modes pick.
  const [answerHistory, setAnswerHistory] = useState<AnswerHistory>(() => loadHistory());
  // Question ids already recorded in the current session, so submitting does not record them twice.
  const recordedInSessionRef = useRef<Set<number>>(new Set());

  const recordGraded = (results: { questionId: number; correct: boolean }[]) => {
    if (results.length === 0) return;
    results.forEach((r) => recordedInSessionRef.current.add(r.questionId));
    setAnswerHistory((prev) => {
      const next = recordResults(prev, results);
      saveHistory(next);
      return next;
    });
  };

  // Questions marked doubtful in this browser; left out of new sessions.
  const [doubtful, setDoubtful] = useState<DoubtfulMarks>(() => loadDoubtful());
  const toggleDoubtfulMark = (questionId: number) => {
    setDoubtful((prev) => {
      const next = toggleDoubtful(prev, questionId);
      saveDoubtful(next);
      return next;
    });
  };
  const doubtfulIds = Object.keys(doubtful).map(Number);

  // Questions served in sessions: those with documented evidence for their key, minus doubtful ones.
  const studyBank = useMemo(() => examQuestions.filter((q) => evidence[q.id] && !doubtful[q.id]), [doubtful]);

  const progressCounts = useMemo(() => {
    const counts = { correct: 0, wrong: 0, unseen: 0 };
    studyBank.forEach((q) => counts[statusOf(answerHistory, q.id)]++);
    return counts;
  }, [answerHistory, studyBank]);

  const resetAnswerHistory = () => {
    if (!confirm("Clear your answer history? Practice quizzes will treat every question as unseen.")) return;
    saveHistory({});
    setAnswerHistory({});
  };

  // Quick quiz length, remembered in this browser.
  const [quizSize, setQuizSize] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem(QUIZ_SIZE_KEY));
      return QUIZ_SIZES.includes(saved) ? saved : 10;
    } catch {
      return 10;
    }
  });
  const chooseQuizSize = (size: number) => {
    setQuizSize(size);
    try {
      window.localStorage.setItem(QUIZ_SIZE_KEY, String(size));
    } catch {
      // Storage unavailable: the choice lasts for this page load.
    }
  };

  // Session Constructors
  const startNewSession =(mode: ExamMode, domainFilter?: string) => {
    let selectedQuestionsList: Question[] = [];

    if (mode === "MOCK_EXAM") {
      // 65 questions in the real exam's mix of formats and domains.
      selectedQuestionsList = pickMockExam(studyBank);
      setTimeLeft(120 * 60); // 120 minutes (7,200 seconds) countdown
    } else if (mode === "QUICK_QUIZ") {
      selectedQuestionsList = pickPracticeQuestions(studyBank, answerHistory, shuffle, quizSize);
      setTimeLeft(0); // For practice, counts UP
    } else if (mode === "INFINITE") {
      // The whole bank once, never-answered questions first; the user ends the session whenever they like.
      selectedQuestionsList = infiniteQueue(studyBank, answerHistory, shuffle);
      setTimeLeft(0);
    } else if (mode === "DOMAIN_PRACTICE" && domainFilter) {
      selectedQuestionsList = pickPracticeQuestions(
        studyBank.filter((q) => q.category === domainFilter),
        answerHistory,
        shuffle
      );
      setTimeLeft(0); // Count UP
    }
    recordedInSessionRef.current = new Set();

    const newSession: ExamSession = {
      id: Math.random().toString(36).substring(2, 9),
      mode,
      targetDomain: domainFilter,
      startTime: Date.now(),
      timeSpent: 0,
      ...buildSessionLayout(selectedQuestionsList, mode === "MOCK_EXAM" ? "mock" : "practice"),
      userAnswers: {},
      flaggedQuestions: [],
      completed: false
    };

    setSession(newSession);
    setCurrentQuestionIndex(0);
    setUserCheckedCurrent(false);
    setIsPaused(false);
    goTo("EXAM", newSession);
  };

  // Active question getters
  const currentQuestion: Question | undefined = session?.questions[currentQuestionIndex];

  const presentationOf = (q: Question) => session?.presentations[q.id] ?? "standard";
  const answeredCount = session
    ? session.questions.filter((q) => isAnswered(q, session.userAnswers[q.id], presentationOf(q))).length
    : 0;
  const currentIsAnswered = !!session && !!currentQuestion && isAnswered(currentQuestion, session.userAnswers[currentQuestion.id], presentationOf(currentQuestion));

  // Opens "Ask about this question" for a question of the session, as the user sees it right now.
  const openAsk = (questionId: number, quote = "") => {
    if (!session) return;
    const index = session.questions.findIndex((q) => q.id === questionId);
    if (index < 0) return;
    const question = session.questions[index];
    const onResults = screen === "RESULT";
    const revealed = onResults || (index === currentQuestionIndex && userCheckedCurrent);
    setSelectionAsk(null);
    setAsk({
      quote,
      context: {
        question,
        presentation: presentationOf(question),
        answer: session.userAnswers[question.id],
        revealed,
        position: `${onResults ? "reviewing results, " : ""}question ${index + 1} of ${session.questions.length} in a ${MODE_LABELS[session.mode]}`,
        displayOrder: session.poolOrder[question.id],
      },
    });
  };

  // Selecting text inside a question offers "Ask about this" next to the selection.
  useEffect(() => {
    const onSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
      const node = selection && selection.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
      const host = (node instanceof Element ? node : node?.parentElement)?.closest<HTMLElement>("[data-ask-id]");
      if (!host || text.length < 2 || ask) return setSelectionAsk(null);
      const box = selection!.getRangeAt(0).getBoundingClientRect();
      setSelectionAsk({
        id: Number(host.dataset.askId),
        text: text.slice(0, 400),
        left: Math.max(8, Math.min(window.innerWidth - 140, box.left + box.width / 2 - 60)),
        top: Math.max(8, box.top - 40),
      });
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, [ask]);

  // Stores the answer to the current question (each format component builds its own Answer value).
  const setCurrentAnswer = (answer: Answer) => {
    if (!session || !currentQuestion || userCheckedCurrent) return;
    const questionId = currentQuestion.id;
    setSession((prev) => (prev ? { ...prev, userAnswers: { ...prev.userAnswers, [questionId]: answer } } : null));
  };

  // Practice mode: reveal the answer to the current question and record the result.
  const checkCurrentAnswer = () => {
    if (!session || !currentQuestion) return;
    setUserCheckedCurrent(true);
    if (recordedInSessionRef.current.has(currentQuestion.id)) return;
    const correct = isCorrect(currentQuestion, session.userAnswers[currentQuestion.id], presentationOf(currentQuestion));
    recordGraded([{ questionId: currentQuestion.id, correct }]);
  };

  // Flag toggle
  const toggleFlagCurrent = () => {
    if (!session || !currentQuestion) return;
    const qId = currentQuestion.id;

    setSession((prev) => {
      if (!prev) return null;
      const exists = prev.flaggedQuestions.includes(qId);
      const updatedFlagged = exists
        ? prev.flaggedQuestions.filter((id) => id !== qId)
        : [...prev.flaggedQuestions, qId];

      return {
        ...prev,
        flaggedQuestions: updatedFlagged
      };
    });
  };

  // Handle auto submit or manual submit
  const handleAutoSubmit = () => {
    submitExam();
  };

  // Calculate scores and direct metrics
  const submitExam = () => {
    if (!session) return;

    // Infinite practice ends whenever the user stops: only the questions they answered are scored and reviewed.
    const graded =
      session.mode === "INFINITE"
        ? session.questions.filter((q) => isAnswered(q, session.userAnswers[q.id], presentationOf(q)))
        : session.questions;
    if (graded.length === 0) {
      exitSession();
      return;
    }

    let correctCount = 0;
    const categoryScores: { [category: string]: { correct: number; total: number } } = {};
    const newlyGraded: { questionId: number; correct: boolean }[] = [];

    graded.forEach((q) => {
      const answer = session.userAnswers[q.id];
      const presentation = presentationOf(q);

      // Initialize domain stats
      if (!categoryScores[q.category]) {
        categoryScores[q.category] = { correct: 0, total: 0 };
      }
      categoryScores[q.category].total += 1;

      const correct = isCorrect(q, answer, presentation);
      if (correct) {
        correctCount += 1;
        categoryScores[q.category].correct += 1;
      }

      // Unanswered questions stay unseen in the history.
      if (isAnswered(q, answer, presentation) && !recordedInSessionRef.current.has(q.id)) {
        newlyGraded.push({ questionId: q.id, correct });
      }
    });
    recordGraded(newlyGraded);

    const scorePercentage = Math.round((correctCount / graded.length) * 100);
    // Only the full-length mock exam is judged against the exam's 65% pass mark; practice sessions are too short to predict a result.
    const hasPassed = session.mode === "MOCK_EXAM" ? scorePercentage >= 65 : undefined;

    const timeEllapsed =
      session.mode === "MOCK_EXAM"
        ? 120 * 60 - timeLeft
        : 0;

    const finalSessionObj = {
      ...session,
      questions: graded,
      completed: true,
      score: scorePercentage,
      passed: hasPassed,
      timeSpent: timeEllapsed
    };

    setSession(finalSessionObj);
    goTo("RESULT", finalSessionObj);
  };

  // Filter sidebar question list
  const filteredQuestions = useMemo(() => {
    if (!session) return [];
    return session.questions.map((q, idx) => ({ q, idx })).filter(({ q }) => {
      const isFlagged = session.flaggedQuestions.includes(q.id);
      const answered = isAnswered(q, session.userAnswers[q.id], session.presentations[q.id]);

      if (sidebarFilter === "FLAGGED") return isFlagged;
      if (sidebarFilter === "UNANSWERED") return !answered;
      return true;
    });
  }, [session, sidebarFilter]);



  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB] font-sans text-[#1A1A1A] select-text">
      
      {/* ===================== WELCOME / DASHBOARD SCREEN ===================== */}
      {screen === "WELCOME" && (
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-8 md:gap-12">
          
          {/* Header Introduction Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-[#FF694B] text-white text-xs font-bold uppercase tracking-wider rounded">Unofficial</span>
                <span className="px-3 py-1 bg-[#1A1A1A] text-white text-xs font-mono rounded">dbt Core 1.11</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                dbt Analytics Engineering exam prep
              </h1>
              <p className="mt-2 text-md text-gray-600 max-w-3xl select-text">
                Practice questions for the dbt Analytics Engineering Certification exam. A personal project, not affiliated with or endorsed by dbt Labs.
              </p>
            </div>

            {/* Full screen control */}
            <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
              <button
                onClick={toggleFullscreen}
                className="px-3.5 py-2 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Full screen"}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            
            {/* Configure Session + Exam Modes */}
            <div className="w-full flex flex-col gap-8">
              
              {/* Start practicing layout */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-[#FF694B]" />
                  Launch a New Practice Session
                </h2>

                {/* Answer history summary */}
                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                    <span className="font-bold text-gray-900">Your progress</span>
                    <span className="flex items-center gap-1.5 text-gray-700">
                      <span className="w-2 h-2 rounded-full bg-green-600"></span>
                      {progressCounts.correct} answered correctly
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-700">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      {progressCounts.wrong} to review
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-700">
                      <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                      {progressCounts.unseen} not answered yet
                    </span>
                  </div>
                  {progressCounts.unseen < studyBank.length && (
                    <button
                      onClick={resetAnswerHistory}
                      className="text-[11px] font-semibold text-gray-500 hover:text-red-600 cursor-pointer transition-colors self-start sm:self-auto"
                    >
                      Reset progress
                    </button>
                  )}
                </div>

                {doubtfulIds.length > 0 && (
                  <div className="-mt-3 mb-6 px-4 py-3 bg-amber-50 rounded-xl border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                    <span>
                      <strong>{doubtfulIds.length}</strong> question{doubtfulIds.length === 1 ? "" : "s"} marked doubtful and left out of sessions: {doubtfulIds.sort((a, b) => a - b).join(", ")}
                    </span>
                    <button
                      onClick={() => {
                        if (!confirm("Bring every doubtful question back into sessions?")) return;
                        saveDoubtful({});
                        setDoubtful({});
                      }}
                      className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 cursor-pointer self-start sm:self-auto"
                    >
                      Clear marks
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  
                  {/* Mode 1 */}
                  <div className="flex flex-col justify-between p-5 border border-gray-200 rounded-xl bg-[#FFF5F2]/20 hover:bg-[#FFF5F2]/40 transition-colors duration-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF694B]/5 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300"></div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-[#FF694B] rounded-lg text-white flex items-center justify-center font-bold">
                          <Award className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase tracking-wider rounded">
                          120 Min Timed
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-md mb-1">Full Mock Exam</h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-4">
                        {MOCK_EXAM_SIZE} questions in the exam's mix of formats, across all seven topics, under a 120-minute countdown. No answer hints during the test.
                      </p>
                    </div>
                    <button
                      onClick={() => startNewSession("MOCK_EXAM")}
                      className="w-full py-2.5 bg-[#1A1A1A] hover:bg-[#FF694B] text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> Start Simulation
                    </button>
                  </div>

                  {/* Mode 2 */}
                  <div className="flex flex-col justify-between p-5 border border-gray-200 rounded-xl bg-white hover:border-[#FF694B]/40 transition-all duration-200 relative overflow-hidden group">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-[#1A1A1A] rounded-lg text-white flex items-center justify-center font-bold">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider rounded">
                          Untimed
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-md mb-1">Quick Practice Quiz</h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-4">
                        {quizSize} untimed questions with study overlays, drawn from questions you have not answered yet or got wrong last time.
                      </p>
                      <div className="flex items-center gap-2 mb-4" role="group" aria-label="Number of questions">
                        <span className="text-[11px] text-gray-500 font-medium">Questions</span>
                        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                          {QUIZ_SIZES.map((size) => (
                            <button
                              key={size}
                              type="button"
                              aria-pressed={quizSize === size}
                              onClick={() => chooseQuizSize(size)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                quizSize === size ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => startNewSession("QUICK_QUIZ")}
                      className="w-full py-2.5 bg-white border border-gray-300 hover:border-[#FF694B] hover:text-[#FF694B] text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <BookOpenCheck className="w-3.5 h-3.5" /> Start Practice
                    </button>
                  </div>

                  {/* Mode 3 */}
                  <div className="flex flex-col justify-between p-5 border border-gray-200 rounded-xl bg-white hover:border-[#FF694B]/40 transition-all duration-200 relative overflow-hidden group">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg text-gray-700 flex items-center justify-center font-bold">
                          <Settings className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider rounded">
                          Untimed
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-md mb-1">Topic Practice</h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-4">
                        One of the seven exam topics, untimed. Covers the topic's questions you have not answered yet or got wrong last time.
                      </p>
                    </div>
                    
                    {/* Select Category and Run */}
                    <div className="space-y-1.5 mt-2">
                      <select
                        onChange={(e) => startNewSession("DOMAIN_PRACTICE", e.target.value)}
                        defaultValue=""
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-[#FF694B] bg-white cursor-pointer"
                      >
                        <option value="" disabled>Choose a topic...</option>
                        {EXAM_TOPICS.map((t, i) => (
                          <option key={t.name} value={t.name}>
                            {i + 1}. {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mode 4 */}
                  <div className="flex flex-col justify-between p-5 border border-gray-200 rounded-xl bg-white hover:border-[#FF694B]/40 transition-all duration-200 relative overflow-hidden group">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 bg-[#FFF5F2] rounded-lg text-[#FF694B] flex items-center justify-center font-bold">
                          <InfinityIcon className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider rounded">
                          Untimed
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-md mb-1">Infinite Practice</h3>
                      <p className="text-xs text-gray-600 leading-relaxed mb-4">
                        Every question in the bank, one after another, each at most once: questions you have never answered first, then
                        the ones you got wrong, then the rest, oldest first. Stop whenever you like; the review covers what you answered.
                      </p>
                    </div>
                    <button
                      onClick={() => startNewSession("INFINITE")}
                      className="w-full py-2.5 bg-white border border-gray-300 hover:border-[#FF694B] hover:text-[#FF694B] text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <InfinityIcon className="w-3.5 h-3.5" /> Start Infinite Practice
                    </button>
                  </div>

                </div>

                {/* Instant Feedback Settings Bar */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FF694B]/10 flex items-center justify-center text-[#FF694B]">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Study mode with Inline Explanations</p>
                      <p className="text-[11px] text-gray-500">Reveal detailed logic, schema guidelines, and solutions instantly inside practice sessions.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPracticeMode(!isPracticeMode)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                      isPracticeMode
                        ? "bg-[#FF694B] text-white shrink-0"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300 shrink-0"
                    }`}
                  >
                    {isPracticeMode ? "ON (Recommended)" : "OFF"}
                  </button>
                </div>
              </div>

              {/* Official exam outline */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-10 h-10 bg-gray-900 text-white flex items-center justify-center rounded-xl font-bold text-sm">
                    dbt
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Exam guide (dbt Core 1.11)</h2>
                    <p className="text-xs text-gray-500">
                      Based on the{" "}
                      <a
                        href="https://www.getdbt.com/dbt-assets/certifications/dbt-certificate-study-guide-version-1-11"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF694B] hover:underline"
                      >
                        official dbt Labs study guide
                      </a>

                      , which lists what each topic covers. dbt Labs publishes no weight per topic.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-xs">
                  {[
                    ["Questions", "65, some unscored"],
                    ["Time", "2 hours"],
                    ["Pass mark", "65%"],
                    ["Score", "Shown on submit"],
                  ].map(([label, value]) => (
                    <div key={label} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{label}</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-600 mb-2">
                  <strong>Question formats:</strong> multiple choice, fill-in-the-blank, matching, hotspot, build list and DOMC (one option at a time, yes or no).
                </p>
                <p className="text-xs text-gray-600 mb-6">
                  <strong>Pace:</strong> about 1 minute 50 seconds per question. Answer what you know on a first pass, flag the rest, and keep 10 minutes to check nothing is blank.
                </p>

                <div className="space-y-2">
                  {EXAM_TOPICS.map((topic, i) => {
                    const inBank = studyBank.filter((q) => q.category === topic.name).length;
                    return (
                      <div key={topic.name} className="flex flex-wrap items-center justify-between gap-3 p-3 border border-gray-200 rounded-xl">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-6 h-6 shrink-0 rounded border text-[11px] font-bold flex items-center justify-center ${topic.color}`}>{i + 1}</span>
                          <span className="text-sm font-semibold text-gray-900">{topic.name}</span>
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-gray-500">{inBank} questions</span>
                          {inBank > 0 && (
                            <button
                              onClick={() => startNewSession("DOMAIN_PRACTICE", topic.name)}
                              className="px-3 py-1.5 border border-gray-300 hover:border-[#FF694B] hover:text-[#FF694B] text-gray-700 rounded-lg text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                            >
                              Practice
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ===================== ACTIVE EXAM CORE INTERFACE ===================== */}
      {screen === "EXAM" && session && currentQuestion && (
        <div id="exam-dashboard" className="flex flex-col overflow-hidden h-dvh shrink-0">
          
          {/* Top Navigation / Progress Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 bg-[#FF694B] rounded flex items-center justify-center text-white font-black text-sm shrink-0">dbt</div>
              <div className="h-6 w-px bg-gray-200 shrink-0"></div>

              {/* Sidebar toggle button in header */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isSidebarOpen
                    ? "bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700"
                    : "bg-[#FFF5F2] hover:bg-[#FFEAE4] border-[#FF694B]/30 text-[#FF694B] font-semibold shadow-xs"
                }`}
                title={isSidebarOpen ? "Hide question sidebar" : "Show question sidebar"}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                <span className="hidden sm:inline">{isSidebarOpen ? "Hide Sidebar" : "Show Questions"}</span>
              </button>

              <div className="hidden sm:block h-6 w-px bg-gray-200 shrink-0"></div>
              <nav aria-label="Breadcrumb" className="text-xs md:text-sm flex items-center gap-1.5 min-w-0">
                <button
                  onClick={() => {
                    if (confirm(LEAVE_SESSION_PROMPT)) exitSession();
                  }}
                  className="text-gray-500 hover:text-[#FF694B] font-medium cursor-pointer transition-colors"
                >
                  Dashboard
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                <h1 className="font-semibold text-gray-900 truncate" aria-current="page">
                  {MODE_LABELS[session.mode]}
                  {session.targetDomain && <span className="hidden md:inline text-gray-500 font-normal">: {session.targetDomain}</span>}
                </h1>
              </nav>
            </div>

            <div className="flex items-center gap-3 md:gap-5">
              {/* Timer metrics - ONLY for Full Mock Exam */}
              {session.mode === "MOCK_EXAM" ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1">
                      Time Remaining
                    </span>
                    <span
                      className={`text-sm md:text-lg font-mono font-medium leading-none ${
                        timeLeft < 300 ? "text-red-600 animate-pulse font-bold" : "text-gray-950"
                      }`}
                    >
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Untimed Practice</span>
                </div>
              )}

              {/* Fullscreen toggle button */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600 cursor-pointer transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Proctored Mode"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  if (confirm(LEAVE_SESSION_PROMPT)) exitSession();
                }}
                className="px-4 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Exit
              </button>

              {/* Submit button directly inside header for rapid end */}
              <button
                onClick={() => {
                  const prompt =
                    session.mode === "INFINITE"
                      ? "End infinite practice and see the results for the questions you answered?"
                      : "Are you sure you want to end your exam session and submit responses for evaluation?";
                  if (confirm(prompt)) submitExam();
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {session.mode === "INFINITE" ? "End & Review" : "Submit & End"}
              </button>
            </div>
          </header>

          {/* Main Workspace Frame */}
          <div className="flex-1 min-h-0 flex overflow-hidden relative">
            
            {/* Sidebar with Grid selector */}
            {isSidebarOpen && (
              <aside
                style={{ width: `${sidebarWidth}px` }}
                className="hidden md:flex bg-white border-r border-gray-200 flex-col shrink-0 relative select-none"
              >
                {/* Progress Tracking Widget with Collapse icon */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-[11px] font-bold uppercase text-gray-500 mb-2">
                      <span>Your Progress</span>
                      <span>
                        {answeredCount} of {session.questions.length} Questions
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#FF694B] h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${(answeredCount / session.questions.length) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer shrink-0"
                    title="Hide sidebar (Click to hide, or drag border to collapse)"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

              {/* Sidebar filter options */}
              <div className="p-3 border-b border-gray-100 bg-white flex items-center justify-between gap-1.5 shrink-0">
                <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                  <ListFilter className="w-3 h-3" /> Filter
                </span>
                <div className="flex bg-gray-100 rounded p-0.5 gap-0.5">
                  {(["ALL", "FLAGGED", "UNANSWERED"] as const).map((filterOpt) => (
                    <button
                      key={filterOpt}
                      onClick={() => setSidebarFilter(filterOpt)}
                      className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                        sidebarFilter === filterOpt
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-400 hover:text-gray-900"
                      }`}
                    >
                      {filterOpt}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Interactive Grid List */}
              <div className="flex-1 overflow-y-auto p-4 bg-white/70">
                {filteredQuestions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    No matching questions.
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {filteredQuestions.map(({ q, idx }) => {
                      const isActive = idx === currentQuestionIndex;
                      const answered = isAnswered(q, session.userAnswers[q.id], session.presentations[q.id]);
                      const isFlagged = session.flaggedQuestions.includes(q.id);

                      let styleClasses = "border-gray-200 bg-white text-gray-700 hover:border-gray-400";

                      if (isActive) {
                        styleClasses = "bg-[#1A1A1A] border-[#1A1A1A] text-white font-bold scale-105 shadow-sm";
                      } else if (isFlagged) {
                        styleClasses = "border-[#FF694B] bg-[#FFF5F2] text-[#FF694B] font-semibold";
                      } else if (answered) {
                        styleClasses = "border-gray-300 bg-gray-100 text-gray-500 hover:bg-gray-200";
                      }

                      return (
                        <button
                          key={q.id}
                          onClick={() => {
                            setCurrentQuestionIndex(idx);
                            setUserCheckedCurrent(false);
                          }}
                          className={`w-10 h-10 rounded border flex items-center justify-center text-xs font-medium cursor-pointer transition-all duration-150 ${styleClasses}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sidebar Legend Indicator */}
              <div className="p-4 border-t border-gray-200 text-[11px] text-gray-500 bg-gray-50/50 flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-[#1A1A1A]"></span>
                  <span className="font-semibold text-gray-700">Current Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded border border-gray-300 bg-gray-100"></span>
                  <span>Answered Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded border border-[#FF694B] bg-[#FFF5F2]"></span>
                  <span className="text-[#FF694B] font-medium">Flagged for Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded border border-gray-200 bg-white"></span>
                  <span>Unanswered Question</span>
                </div>
              </div>
            </aside>
          )}

            {/* Divider Handle: Drag to resize or collapse, Click chevron to hide */}
            {isSidebarOpen ? (
              <div
                onMouseDown={startDraggingSidebar}
                onTouchStart={startDraggingSidebar}
                className="hidden md:flex relative w-2 hover:w-2.5 bg-gray-100 hover:bg-[#FF694B]/20 transition-all cursor-col-resize z-20 items-center justify-center select-none group shrink-0"
                title="Drag to resize or collapse sidebar, or click chevron to hide"
              >
                <div className="w-0.5 h-10 bg-gray-300 group-hover:bg-[#FF694B] rounded-full transition-colors"></div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSidebarOpen(false);
                  }}
                  className="absolute left-1/2 -translate-x-1/2 w-4 h-11 bg-white border border-gray-300 hover:border-[#FF694B] hover:text-[#FF694B] text-gray-400 hover:bg-[#FFF5F2] rounded-r-md flex items-center justify-center shadow-xs cursor-pointer transition-all group-hover:scale-105"
                  title="Hide sidebar (Click or drag left to collapse)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* When Collapsed: Drag-to-expand strip & Floating Questions badge */
              <>
                <div
                  onMouseDown={startDraggingSidebar}
                  onTouchStart={startDraggingSidebar}
                  className="hidden md:flex w-2.5 hover:w-3.5 bg-gray-100 hover:bg-[#FF694B]/30 border-r border-gray-200 transition-all cursor-col-resize z-20 select-none items-center justify-center group shrink-0"
                  title="Drag right to expand sidebar"
                >
                  <div className="w-0.5 h-10 bg-gray-300 group-hover:bg-[#FF694B] rounded-full transition-colors"></div>
                </div>

                <div className="absolute top-4 left-4 z-30 hidden md:block">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(true);
                      if (sidebarWidth < 200) setSidebarWidth(288);
                    }}
                    className="px-3 py-1.5 bg-white border border-gray-300 hover:border-[#FF694B] hover:text-[#FF694B] text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md cursor-pointer transition-all hover:scale-102"
                    title="Show question sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4 text-[#FF694B]" />
                    <span>Questions ({answeredCount}/{session.questions.length})</span>
                  </button>
                </div>
              </>
            )}

            {/* Content Area for active question */}
            <section className="flex-1 min-h-0 bg-white flex flex-col overflow-hidden relative">
              <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 pb-32 md:pb-32">
                <div className="max-w-3xl mx-auto w-full" data-ask-id={currentQuestion.id}>
                  
                  {/* Category, Difficulty, and Pre-Answer Docs Reference Link */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${getCategoryColorStyles(currentQuestion.category)}`}>
                        {currentQuestion.category}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-[10px] font-bold uppercase tracking-wider rounded text-gray-600">
                        {currentQuestion.difficulty}
                      </span>
                      <span className="px-2 py-1 bg-white border border-gray-300 text-[10px] font-bold uppercase tracking-wider rounded text-gray-700">
                        {FORMAT_LABELS[presentationOf(currentQuestion) === "domc" ? "domc" : formatOf(currentQuestion)]}
                      </span>

                      {/* Official dbt Documentation Reference Link - Always accessible before answering */}
                      {currentQuestion.references && (
                        <a
                          href={currentQuestion.references}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#FFF5F2] hover:bg-[#FFEAE4] text-[#FF694B] border border-[#FF694B]/30 hover:border-[#FF694B] transition-all hover:shadow-xs group cursor-pointer"
                          title="Open official dbt documentation topic for this question in a new tab"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#FF694B]" />
                          <span>Official dbt Docs</span>
                          <ExternalLink className="w-3 h-3 text-[#FF694B]/70 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                      )}
                      <AskButton onClick={() => openAsk(currentQuestion.id)} />
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-gray-400 font-medium">
                        Question {currentQuestionIndex + 1} of {session.questions.length}
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <h2 className="text-md md:text-lg font-medium leading-relaxed text-gray-900 mb-6 select-text">
                    <FormattedText text={currentQuestion.questionText} />
                  </h2>

                  {/* Code snippet and answer area, per question format */}
                  <QuestionBody
                    question={currentQuestion}
                    presentation={presentationOf(currentQuestion)}
                    answer={session.userAnswers[currentQuestion.id]}
                    onAnswer={setCurrentAnswer}
                    revealed={userCheckedCurrent}
                    domcOrder={session.domcOrder[currentQuestion.id]}
                    displayOrder={session.poolOrder[currentQuestion.id]}
                  />

                  {/* Practice Answer validation panel */}
                  {isPracticeMode && session.mode !== "MOCK_EXAM" && (
                    <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col gap-4">
                      
                      {!userCheckedCurrent ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            onClick={checkCurrentAnswer}
                            disabled={!currentIsAnswered}
                            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              currentIsAnswered
                                ? "bg-gray-900 border border-gray-900 text-white hover:bg-[#FF694B] hover:border-[#FF694B]"
                                : "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            Check Answer
                          </button>

                          {currentQuestion.references && (
                            <a
                              href={currentQuestion.references}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#FF694B] font-medium transition-colors cursor-pointer group"
                              title="Open official dbt documentation on this topic in a new tab"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#FF694B]" />
                              <span>Need a hint? Read the official dbt topic documentation</span>
                              <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#FF694B] group-hover:translate-x-0.5 transition-all" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-xs md:text-sm leading-relaxed select-text"
                        >
                          <div className="flex items-center gap-2 mb-3 select-none">
                            <span className="p-1 px-2.5 bg-gray-900 text-white font-bold rounded uppercase tracking-wider text-[10px]">
                              Solution Analysis
                            </span>
                            {currentQuestion.dbtVersionFocus && (
                              <span className="px-2 py-0.5 bg-[#FF694B]/10 text-[#FF694B] font-bold rounded uppercase tracking-wider text-[9px]">
                                {currentQuestion.dbtVersionFocus}
                              </span>
                            )}
                          </div>
                          
                          <FormattedExplanation explanation={currentQuestion.explanation} className="mb-3" />

                          <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-4">Source</p>
                          <EvidenceBlock questionId={currentQuestion.id} />

                          <DoubtfulToggle
                            marked={!!doubtful[currentQuestion.id]}
                            onToggle={() => toggleDoubtfulMark(currentQuestion.id)}
                          />
                        </motion.div>
                      )}

                    </div>
                  )}

                </div>
              </div>

              {/* Lower Navigation bar */}
              <div className="absolute bottom-0 left-0 right-0 h-20 border-t border-gray-100 bg-white flex items-center justify-between px-6 md:px-10 z-10 shadow-lg">
                
                {/* Previous trigger */}
                <button
                  onClick={() => {
                    if (currentQuestionIndex > 0) {
                      setCurrentQuestionIndex((prev) => prev - 1);
                      setUserCheckedCurrent(false);
                    }
                  }}
                  disabled={currentQuestionIndex === 0}
                  className={`flex items-center gap-2 text-xs md:text-sm font-semibold transition-colors cursor-pointer ${
                    currentQuestionIndex === 0
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex items-center gap-2.5">
                  {/* Flag Toggle */}
                  <button
                    onClick={toggleFlagCurrent}
                    className={`px-3 md:px-5 py-2 border rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 cursor-pointer transition-all ${
                      session.flaggedQuestions.includes(currentQuestion.id)
                        ? "bg-[#FFF5F2] border-[#FF694B] text-[#FF694B]"
                        : "border-gray-300 hover:border-[#FF694B] text-gray-500 hover:text-[#FF694B]"
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {session.flaggedQuestions.includes(currentQuestion.id) ? "Flagged!" : "Flag for Review"}
                    </span>
                  </button>

                  {/* Next / Submit trigger */}
                  {currentQuestionIndex < session.questions.length - 1 ? (
                    <button
                      onClick={() => {
                        setCurrentQuestionIndex((prev) => prev + 1);
                        setUserCheckedCurrent(false);
                      }}
                      className="px-6 md:px-10 py-2 bg-[#1A1A1A] hover:bg-[#FF694B] text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm("You have reached the final question. Submit all answers for grading?")) {
                          submitExam();
                        }
                      }}
                      className="px-6 md:px-10 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      Submit Exam
                    </button>
                  )}
                </div>

              </div>

            </section>

          </div>

          {/* Pause Modal overlay */}
          {isPaused && (
            <div className="absolute inset-0 bg-white/95 z-[100] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-[#FFF5F2] rounded-full flex items-center justify-center text-[#FF694B] mb-4">
                <Pause className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Simulated Practice Paused</h2>
              <p className="text-gray-500 text-xs md:text-sm max-w-sm mb-6 leading-relaxed">
                Your practice clock is temporarily suspended, and the questions list is masked to preserve validation integrity.
              </p>
              <button
                onClick={() => setIsPaused(false)}
                className="px-8 py-3 bg-[#FF694B] hover:bg-[#FF694B]/90 text-white font-bold text-xs uppercase tracking-widest rounded-full transition-colors cursor-pointer"
              >
                Resume Practice Timer
              </button>
            </div>
          )}

        </div>
      )}

      {/* ===================== SCORE REPORT / RESULTS SCREEN ===================== */}
      {screen === "RESULT" && session && (
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">
          
          {/* Top Navigation & Fullscreen Toolbar */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200">
            <button
              onClick={() => goTo("WELCOME")}
              className="px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Back to Dashboard
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => startNewSession(session.mode, session.targetDomain)}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#FF694B] text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5" /> {NEW_SESSION_LABELS[session.mode]}
              </button>
              <button
                onClick={toggleFullscreen}
                className="px-3.5 py-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                title={isFullscreen ? "Exit Fullscreen" : "Full screen"}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? "Exit Fullscreen" : "Full Screen"}</span>
              </button>
            </div>
          </div>

          {/* Header Status Result */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden">

            {session.passed === undefined ? (
              <div className="flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
                <div className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 bg-[#FFF5F2] text-[#FF694B]">
                  <BookOpenCheck className="w-10 h-10" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                    {MODE_LABELS[session.mode]}
                  </span>
                  <h1 className="text-2xl font-bold text-gray-900 mt-2">
                    {session.questions.filter((q) => isCorrect(q, session.userAnswers[q.id], session.presentations[q.id])).length} of {session.questions.length} correct
                  </h1>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">
                    Practice sessions have no pass mark: they are too short to predict an exam result. Take the full mock exam for a pass or fail against the 65% target.
                  </p>
                </div>
              </div>
            ) : (
            <div className="flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center shrink-0 ${
                session.passed ? "bg-green-100 text-green-600 animate-bounce" : "bg-red-100 text-red-500"
              }`}>
                {session.passed ? (
                  <CheckCircle className="w-10 h-10" />
                ) : (
                  <XCircle className="w-10 h-10" />
                )}
              </div>
              <div>
                <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  session.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                  {session.passed ? "PASS" : "FAIL"} - 65% Target Required
                </span>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">
                  {session.passed
                    ? "Congratulations! You Passed!"
                    : "Below Target Threshold"}
                </h1>
                <p className="text-xs text-gray-500 mt-1 max-w-md">
                  {session.passed
                    ? "Excellent performance! You demonstrate robust alignment with the modern dbt curriculum features (v1.10 & v1.11)."
                    : "Work through problem areas below, review standard logs, contracts, and try other targeted practices before testing again."}
                </p>
              </div>
            </div>
            )}

            {/* Score Ring Gauge */}
            <div className="flex flex-col items-center shrink-0">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">My Score</span>
              <div className="relative flex items-center justify-center">
                
                {/* SVG Progress Circle */}
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke="#F3F4F6"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="42"
                    stroke={session.passed === undefined ? "#FF694B" : session.passed ? "#16A34A" : "#EF4444"}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={
                      (2 * Math.PI * 42) * (1 - (session.score ?? 0) / 100)
                    }
                  />
                </svg>
                <span className="absolute text-xl font-mono font-bold text-gray-900">
                  {session.score}%
                </span>
              </div>
            </div>

          </div>

          {/* Performance Category breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            {/* Domain percentages */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-md uppercase tracking-wider font-bold text-gray-400 mb-6 flex items-center gap-2">
                <Award className="w-4 h-4 text-[#FF694B]" />
                Performance by exam topic
              </h2>

              <div className="space-y-5">
                {/* Map unique category names */}
                {CATEGORIES.map((catName) => {
                  let total = 0;
                  let correct = 0;

                  session.questions.forEach((q) => {
                    if (q.category === catName) {
                      total += 1;
                      if (isCorrect(q, session.userAnswers[q.id], session.presentations[q.id])) {
                        correct += 1;
                      }
                    }
                  });

                  if (total === 0) return null;

                  const percent = Math.round((correct / total) * 100);
                  let evaluation = "Focus Zone";
                  let textBadgeStyle = "bg-red-50 text-red-700 border-red-100";
                  let scaleColor = "bg-red-500 block";

                  if (percent >= 75) {
                    evaluation = "Proficient";
                    textBadgeStyle = "bg-green-50 text-green-700 border-green-100";
                    scaleColor = "bg-green-600 block";
                  } else if (percent >= 50) {
                    evaluation = "Marginally Proficient";
                    textBadgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
                    scaleColor = "bg-amber-500 block";
                  }

                  return (
                    <div key={catName} className="space-y-2">
                      <div className="flex justify-between items-center gap-4 text-xs font-semibold">
                        <span className="text-gray-800 truncate block text-[11px]">{catName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${textBadgeStyle}`}>
                            {evaluation}
                          </span>
                          <span className="text-gray-900 font-mono">{correct}/{total} ({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-300 ${scaleColor}`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons footer */}
              <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={() => startNewSession(session.mode, session.targetDomain)}
                  className="flex-auto whitespace-nowrap px-5 py-3 bg-[#1A1A1A] hover:bg-[#FF694B] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> {NEW_SESSION_LABELS[session.mode]}
                </button>
                <button
                  onClick={() => goTo("WELCOME")}
                  className="flex-auto whitespace-nowrap px-5 py-3 border border-gray-300 hover:border-[#FF694B] hover:text-[#FF694B] text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Back to Dashboard
                </button>
              </div>

            </div>

            {/* Next steps: weakest topics in this session */}
            <div className="bg-[#1A1A1A] text-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-md uppercase tracking-wider font-bold text-gray-400 mb-4 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-[#FF694B]" />
                What to practice next
              </h2>
              {(() => {
                const byTopic = CATEGORIES.map((name) => {
                  const qs = session.questions.filter((q) => q.category === name);
                  const correct = qs.filter((q) => isCorrect(q, session.userAnswers[q.id], session.presentations[q.id])).length;
                  return { name, total: qs.length, correct, missed: qs.length - correct };
                })
                  .filter((t) => t.missed > 0)
                  .sort((a, b) => b.missed - a.missed || a.correct / a.total - b.correct / b.total);
                if (byTopic.length === 0) {
                  return <p className="text-xs text-gray-300">No missed questions in this session.</p>;
                }
                return (
                  <ul className="space-y-3">
                    {byTopic.slice(0, 3).map((t) => (
                      <li key={t.name} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">{t.name}</p>
                          <p className="text-[11px] text-gray-400">
                            Missed {t.missed} of {t.total}
                          </p>
                        </div>
                        <button
                          onClick={() => startNewSession("DOMAIN_PRACTICE", t.name)}
                          className="shrink-0 px-3 py-1.5 border border-gray-600 hover:border-[#FF694B] hover:text-[#FF694B] text-gray-200 rounded-lg text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                        >
                          Practice
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

          </div>

          {/* Complete Questions review checklist */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <ListFilter className="w-5 h-5 text-[#FF694B]" />
              Detailed Problem Analysis & Choices Review
            </h2>

            <div className="space-y-6 divide-y divide-gray-100">
              {session.questions.map((q, idx) => {
                const answeredCorrectly = isCorrect(q, session.userAnswers[q.id], session.presentations[q.id]);

                return (
                  <div key={q.id} data-ask-id={q.id} className={`pt-6 ${idx === 0 ? "pt-0" : ""}`}>
                    
                    {/* Status header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          answeredCorrectly ? "bg-green-600" : "bg-red-500"
                        }`}>
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm">
                          Question {idx + 1} ({getCategoryShortTag(q.category)} · {FORMAT_LABELS[session.presentations[q.id] === "domc" ? "domc" : formatOf(q)]})
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <AskButton onClick={() => openAsk(q.id)} />
                        {answeredCorrectly ? (
                          <span className="px-2.5 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold rounded flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" /> Correct
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold rounded flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Incorrect
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question text */}
                    <p className="text-xs md:text-sm font-medium text-gray-800 leading-relaxed mb-4 select-text">
                      <FormattedText text={q.questionText} />
                    </p>

                    {/* The answer as given, with the correct answer marked */}
                    <div className="mb-4">
                      <QuestionBody
                        question={q}
                        presentation={session.presentations[q.id] ?? "standard"}
                        answer={session.userAnswers[q.id]}
                        onAnswer={() => {}}
                        revealed
                        readOnly
                        domcOrder={session.domcOrder[q.id]}
                        displayOrder={session.poolOrder[q.id]}
                      />
                    </div>

                    {/* Display analysis block */}
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-xs leading-relaxed text-gray-600 select-text">
                      <p className="font-bold text-gray-900 mb-2 select-none">Explanation:</p>
                      <FormattedExplanation explanation={q.explanation} className="mb-2" />
                      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-4 select-none">Source</p>
                      <EvidenceBlock questionId={q.id} />
                      <DoubtfulToggle marked={!!doubtful[q.id]} onToggle={() => toggleDoubtfulMark(q.id)} />
                    </div>

                  </div>
                );
              })}
            </div>

          </div>

        </div>
      )}

      {selectionAsk && !ask && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => openAsk(selectionAsk.id, selectionAsk.text)}
          style={{ position: "fixed", left: selectionAsk.left, top: selectionAsk.top }}
          className="z-50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold shadow-lg hover:bg-[#FF694B] cursor-pointer"
        >
          Ask about this
        </button>
      )}
      {ask && (
        <AskDialog
          context={ask.context}
          quote={ask.quote}
          onClose={() => setAsk(null)}
          onCopied={() => {
            setAskCopied(true);
            setTimeout(() => setAskCopied(false), 2500);
          }}
        />
      )}
      {askCopied && (
        <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold shadow-lg">
          Copied. Paste it into your LLM.
        </div>
      )}
    </div>
  );
}
