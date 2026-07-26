const EXAM_DURATION_MS = 15 * 60 * 1000;
const DRAFT_KEY = 'examDraft_v1';

let sbClient = null;
let currentExam = null; // { id, name, questions: [...] }
let studentName = '';
let endTime = 0;
let timerInterval = null;

function initSupabase() {
  if (!window.supabase) throw new Error('Supabase 라이브러리를 불러오지 못했습니다.');
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

function el(id) { return document.getElementById(id); }

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function normalize(str) {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isCorrect(studentAnswer, answerText) {
  const accepted = answerText.split('|').map(normalize);
  return accepted.includes(normalize(studentAnswer));
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ===== 시험지 불러오기 =====
async function loadLatestExam() {
  const { data: exams, error: examErr } = await sbClient
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (examErr) throw examErr;
  if (!exams || exams.length === 0) return null;

  const exam = exams[0];
  const { data: questions, error: qErr } = await sbClient
    .from('questions')
    .select('*')
    .eq('exam_id', exam.id)
    .order('order_num', { ascending: true });
  if (qErr) throw qErr;

  return { id: exam.id, name: exam.name, questions: questions || [] };
}

async function loadExamById(examId) {
  const { data: exam, error: examErr } = await sbClient
    .from('exams')
    .select('*')
    .eq('id', examId)
    .maybeSingle();
  if (examErr || !exam) return null;

  const { data: questions, error: qErr } = await sbClient
    .from('questions')
    .select('*')
    .eq('exam_id', exam.id)
    .order('order_num', { ascending: true });
  if (qErr) throw qErr;

  return { id: exam.id, name: exam.name, questions: questions || [] };
}

// ===== 답안 임시저장(자동저장) =====
function saveDraft(answers) {
  const draft = {
    examId: currentExam.id,
    examName: currentExam.name,
    studentName,
    endTime,
    answers,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function getCurrentAnswers() {
  const answers = {};
  document.querySelectorAll('.answer-input').forEach((input) => {
    answers[input.dataset.index] = input.value;
  });
  return answers;
}

// ===== 화면 전환 =====
function showScreen(name) {
  ['startScreen', 'examScreen', 'doneScreen'].forEach((id) => {
    el(id).classList.toggle('hidden', id !== name);
  });
}

// ===== 시작 화면 =====
async function handleStart() {
  const name = el('studentName').value.trim();
  el('startError').classList.add('hidden');

  if (!name) {
    el('startError').textContent = '이름을 입력해주세요.';
    el('startError').classList.remove('hidden');
    return;
  }

  el('loadingMsg').classList.remove('hidden');
  el('startBtn').disabled = true;

  try {
    const exam = await loadLatestExam();
    if (!exam || exam.questions.length === 0) {
      el('startError').textContent = '등록된 시험지가 없습니다. 멘토에게 문의하세요.';
      el('startError').classList.remove('hidden');
      return;
    }
    currentExam = exam;
    studentName = name;
    el('startConfirmOverlay').classList.remove('hidden');
  } catch (e) {
    el('startError').textContent = '시험지를 불러오는 중 오류가 발생했습니다: ' + e.message;
    el('startError').classList.remove('hidden');
  } finally {
    el('loadingMsg').classList.add('hidden');
    el('startBtn').disabled = false;
  }
}

function runCountdown(onDone) {
  const overlay = el('countdownOverlay');
  const numberEl = el('countdownNumber');
  overlay.classList.remove('hidden');
  let count = 3;
  numberEl.textContent = String(count);
  const tick = () => {
    count--;
    if (count <= 0) {
      overlay.classList.add('hidden');
      onDone();
      return;
    }
    numberEl.textContent = String(count);
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

function renderQuestions() {
  el('examTitle').textContent = currentExam.name;
  const list = el('questionList');
  list.innerHTML = currentExam.questions.map((q, i) => `
    <div class="question-item">
      <div class="q-index">문제 ${i + 1} / ${currentExam.questions.length}</div>
      <div class="q-text">${escapeHtml(q.question_text)}</div>
      <input type="text" class="answer-input" data-index="${i}" placeholder="답을 입력하세요" />
    </div>
  `).join('');

  list.querySelectorAll('.answer-input').forEach((input) => {
    input.addEventListener('input', () => {
      saveDraft(getCurrentAnswers());
    });
  });
}

function restoreAnswers(answers) {
  if (!answers) return;
  document.querySelectorAll('.answer-input').forEach((input) => {
    const v = answers[input.dataset.index];
    if (v !== undefined) input.value = v;
  });
}

function beginExam(restoredAnswers) {
  showScreen('examScreen');
  renderQuestions();
  if (restoredAnswers) restoreAnswers(restoredAnswers);
  saveDraft(getCurrentAnswers());
  startTimer();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const tick = () => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      clearInterval(timerInterval);
      el('timerBar').textContent = '0:00';
      finishExam(true);
      return;
    }
    el('timerBar').textContent = formatTime(remaining);
    el('timerBar').classList.toggle('low', remaining < 60000);
  };
  tick();
  timerInterval = setInterval(tick, 500);
}

// ===== 제출 =====
async function finishExam(auto) {
  if (timerInterval) clearInterval(timerInterval);

  const answers = getCurrentAnswers();
  const detail = currentExam.questions.map((q, i) => {
    const studentAnswer = answers[i] || '';
    const correct = isCorrect(studentAnswer, q.answer_text);
    return {
      question: q.question_text,
      correct_answer: q.answer_text,
      student_answer: studentAnswer,
      is_correct: correct,
    };
  });
  const score = detail.filter((d) => d.is_correct).length;

  try {
    const { error } = await sbClient.from('results').insert({
      exam_id: currentExam.id,
      exam_name: currentExam.name,
      student_name: studentName,
      score,
      total: currentExam.questions.length,
      detail,
    });
    if (error) throw error;
  } catch (e) {
    alert('결과 저장 중 오류가 발생했습니다: ' + e.message);
  }

  clearDraft();
  el('doneMsg').textContent = auto
    ? '응시 시간이 종료되어 자동으로 제출되었습니다. 수고하셨습니다.'
    : '수고하셨습니다. 결과는 멘토 선생님이 확인하실 예정입니다.';
  showScreen('doneScreen');
}

function handleEndExamClick() {
  el('endConfirmOverlay').classList.remove('hidden');
}

// ===== 새로고침 복구 =====
async function tryResumeDraft() {
  const draft = loadDraft();
  if (!draft) return false;

  el('loadingMsg').classList.remove('hidden');
  try {
    const exam = await loadExamById(draft.examId);
    if (!exam || exam.questions.length === 0) {
      clearDraft();
      return false;
    }
    currentExam = exam;
    studentName = draft.studentName;
    endTime = draft.endTime;

    if (draft.endTime <= Date.now()) {
      showScreen('examScreen');
      renderQuestions();
      restoreAnswers(draft.answers);
      await finishExam(true);
      return true;
    }

    beginExam(draft.answers);
    return true;
  } catch (e) {
    clearDraft();
    return false;
  } finally {
    el('loadingMsg').classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  initSupabase();

  el('startBtn').addEventListener('click', handleStart);

  el('startCancelBtn').addEventListener('click', () => {
    el('startConfirmOverlay').classList.add('hidden');
  });
  el('startConfirmBtn').addEventListener('click', () => {
    el('startConfirmOverlay').classList.add('hidden');
    runCountdown(() => {
      endTime = Date.now() + EXAM_DURATION_MS;
      beginExam(null);
    });
  });

  el('endExamBtn').addEventListener('click', handleEndExamClick);
  el('endCancelBtn').addEventListener('click', () => {
    el('endConfirmOverlay').classList.add('hidden');
  });
  el('endConfirmBtn').addEventListener('click', () => {
    el('endConfirmOverlay').classList.add('hidden');
    finishExam(false);
  });

  await tryResumeDraft();
});
