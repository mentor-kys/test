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

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ===== 시험지 불러오기 =====
async function loadOpenExams() {
  const { data, error } = await sbClient
    .from('exams')
    .select('*')
    .eq('is_closed', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
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

// ===== 시작 화면: 응시 가능한 시험지 목록 =====
let openExamsCache = [];

async function getCompletedExamIds(name) {
  if (!name) return new Set();
  const { data, error } = await sbClient
    .from('results')
    .select('exam_id')
    .eq('student_name', name);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.exam_id));
}

function renderExamRows(exams, completedIds) {
  const container = el('examSelectList');
  if (exams.length === 0) {
    container.textContent = '현재 응시 가능한 시험지가 없습니다. 멘토에게 문의하세요.';
    return;
  }
  container.innerHTML = exams.map((exam) => {
    const taken = completedIds.has(exam.id);
    return `
      <div class="list-row ${taken ? 'exam-taken' : 'clickable-row'}" data-exam-id="${exam.id}" data-exam-name="${escapeHtml(exam.name)}" ${taken ? 'data-taken="true"' : ''}>
        <div class="list-row-main">
          <div class="list-row-title">${escapeHtml(exam.name)}</div>
          ${taken ? '<div class="list-row-sub">이미 응시했습니다</div>' : ''}
        </div>
        <div class="muted">${taken ? '' : '›'}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-exam-id]:not([data-taken])').forEach((rowEl) => {
    rowEl.addEventListener('click', () => handleSelectExam(Number(rowEl.dataset.examId), rowEl.dataset.examName));
  });
}

async function loadAndRenderExamList() {
  const container = el('examSelectList');
  container.textContent = '불러오는 중...';
  try {
    openExamsCache = await loadOpenExams();
    const completedIds = await getCompletedExamIds(el('studentName').value.trim());
    renderExamRows(openExamsCache, completedIds);
  } catch (e) {
    container.textContent = '시험지 목록을 불러오는 중 오류가 발생했습니다: ' + e.message;
  }
}

async function refreshCompletionState() {
  if (openExamsCache.length === 0) return;
  const completedIds = await getCompletedExamIds(el('studentName').value.trim());
  renderExamRows(openExamsCache, completedIds);
}

async function handleSelectExam(examId, examName) {
  const name = el('studentName').value.trim();
  el('startError').classList.add('hidden');

  if (!name) {
    el('startError').textContent = '이름을 입력해주세요.';
    el('startError').classList.remove('hidden');
    return;
  }

  el('loadingMsg').classList.remove('hidden');

  try {
    const { data: existing } = await sbClient
      .from('results')
      .select('id')
      .eq('student_name', name)
      .eq('exam_id', examId)
      .limit(1);
    if (existing && existing.length > 0) {
      el('startError').textContent = '이미 응시한 시험지입니다.';
      el('startError').classList.remove('hidden');
      await refreshCompletionState();
      return;
    }

    const exam = await loadExamById(examId);
    if (!exam || exam.questions.length === 0) {
      el('startError').textContent = '시험지를 불러올 수 없습니다. 멘토에게 문의하세요.';
      el('startError').classList.remove('hidden');
      return;
    }
    currentExam = exam;
    studentName = name;
    el('startConfirmText').innerHTML = `"${escapeHtml(examName)}" 시험을 시작하시겠습니까?<br />시작하면 15분 타이머가 시작됩니다.`;
    el('startConfirmOverlay').classList.remove('hidden');
  } catch (e) {
    el('startError').textContent = '시험지를 불러오는 중 오류가 발생했습니다: ' + e.message;
    el('startError').classList.remove('hidden');
  } finally {
    el('loadingMsg').classList.add('hidden');
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
  el('examInfoBox').textContent = `총 ${currentExam.questions.length}문제 · 제한시간 15분`;
  const list = el('questionList');
  list.innerHTML = currentExam.questions.map((q, i) => `
    <div class="question-item">
      <div class="q-row">
        <span class="q-num">${i + 1}.</span>
        <span class="q-text">${escapeHtml(q.question_text)}</span>
      </div>
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
  const detail = currentExam.questions.map((q, i) => ({
    question: q.question_text,
    student_answer: answers[i] || '',
  }));

  try {
    const { error } = await sbClient.from('results').insert({
      exam_id: currentExam.id,
      exam_name: currentExam.name,
      student_name: studentName,
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

  el('studentName').addEventListener('blur', refreshCompletionState);

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

  const resumed = await tryResumeDraft();
  if (!resumed) {
    loadAndRenderExamList();
  }
});
