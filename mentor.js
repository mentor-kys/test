let sbClient = null;
let selectedStudent = '';
let selectedExamId = null;
let selectedExamName = '';

const SCREENS = [
  'lockScreen',
  'menuScreen',
  'registerScreen',
  'resultsListScreen',
  'studentExamsScreen',
  'examDetailScreen',
];

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

function showMentorScreen(name) {
  SCREENS.forEach((id) => el(id).classList.toggle('hidden', id !== name));
}

// ===== 잠금 =====
function handleUnlock() {
  const pw = el('pwInput').value;
  if (pw === MENTOR_PASSWORD) {
    sessionStorage.setItem('mentorUnlocked', '1');
    showMentorScreen('menuScreen');
  } else {
    el('lockError').textContent = '비밀번호가 올바르지 않습니다.';
    el('lockError').classList.remove('hidden');
  }
}

function checkUnlocked() {
  if (sessionStorage.getItem('mentorUnlocked') === '1') {
    showMentorScreen('menuScreen');
  }
}

// ===== 문제 등록 =====
function parseQuestionBlocks(text) {
  const blocks = text.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const parsed = [];
  let skipped = 0;

  blocks.forEach((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      skipped++;
      return;
    }
    const answer = lines[lines.length - 1];
    const question = lines.slice(0, -1).join(' ');
    if (!question || !answer) {
      skipped++;
      return;
    }
    parsed.push({ question_text: question, answer_text: answer });
  });

  return { parsed, skipped };
}

async function loadExamListIntoView() {
  const container = el('examListMentor');
  container.textContent = '불러오는 중...';

  const { data: exams, error } = await sbClient
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.textContent = '불러오기 실패: ' + error.message;
    return;
  }
  if (!exams || exams.length === 0) {
    container.textContent = '등록된 시험지가 없습니다.';
    return;
  }

  const { data: allQuestions } = await sbClient.from('questions').select('exam_id');
  const countByExam = {};
  (allQuestions || []).forEach((q) => {
    countByExam[q.exam_id] = (countByExam[q.exam_id] || 0) + 1;
  });

  container.innerHTML = exams.map((exam, i) => {
    const date = new Date(exam.created_at).toLocaleString('ko-KR');
    const count = countByExam[exam.id] || 0;
    return `
      <div class="list-row">
        <div class="list-row-main">
          <div class="list-row-title">${escapeHtml(exam.name)} ${i === 0 ? '<span class="muted">(현재 시험)</span>' : ''}</div>
          <div class="list-row-sub">${date} · 문제 ${count}개</div>
        </div>
      </div>
    `;
  }).join('');
}

async function handleSubmitExam() {
  const examName = el('examName').value.trim();
  const bulkText = el('bulkQuestions').value;
  el('registerError').classList.add('hidden');
  el('registerSuccess').classList.add('hidden');

  if (!examName) {
    el('registerError').textContent = '시험지 이름을 입력해주세요.';
    el('registerError').classList.remove('hidden');
    return;
  }

  const { parsed, skipped } = parseQuestionBlocks(bulkText);
  if (parsed.length === 0) {
    el('registerError').textContent = '등록할 수 있는 문제가 없습니다. 형식을 확인해주세요.';
    el('registerError').classList.remove('hidden');
    return;
  }

  el('submitExamBtn').disabled = true;

  try {
    const { data: exam, error: examErr } = await sbClient
      .from('exams')
      .insert({ name: examName })
      .select()
      .single();
    if (examErr) throw examErr;

    const rows = parsed.map((q, i) => ({
      exam_id: exam.id,
      question_text: q.question_text,
      answer_text: q.answer_text,
      order_num: i,
    }));
    const { error: qErr } = await sbClient.from('questions').insert(rows);
    if (qErr) throw qErr;

    el('registerSuccess').textContent = `"${examName}" 시험지에 문제 ${parsed.length}개를 등록했습니다.` +
      (skipped > 0 ? ` (형식이 맞지 않아 건너뛴 블록 ${skipped}개)` : '');
    el('registerSuccess').classList.remove('hidden');
    el('examName').value = '';
    el('bulkQuestions').value = '';
    loadExamListIntoView();
  } catch (e) {
    el('registerError').textContent = '등록 실패: ' + e.message;
    el('registerError').classList.remove('hidden');
  } finally {
    el('submitExamBtn').disabled = false;
  }
}

// ===== 시험지 확인: 응시자 목록 =====
async function loadStudentListIntoView() {
  const container = el('studentListMentor');
  container.textContent = '불러오는 중...';

  const { data, error } = await sbClient
    .from('results')
    .select('student_name, submitted_at')
    .order('submitted_at', { ascending: false });

  if (error) {
    container.textContent = '불러오기 실패: ' + error.message;
    return;
  }
  if (!data || data.length === 0) {
    container.textContent = '아직 제출된 결과가 없습니다.';
    return;
  }

  const seen = new Map();
  data.forEach((r) => {
    if (!seen.has(r.student_name)) seen.set(r.student_name, r.submitted_at);
  });

  container.innerHTML = Array.from(seen.entries()).map(([name, lastAt]) => `
    <div class="list-row clickable-row" data-student="${escapeHtml(name)}">
      <div class="list-row-main">
        <div class="list-row-title">${escapeHtml(name)}</div>
        <div class="list-row-sub">최근 응시: ${new Date(lastAt).toLocaleString('ko-KR')}</div>
      </div>
      <div class="muted">›</div>
    </div>
  `).join('');

  container.querySelectorAll('[data-student]').forEach((rowEl) => {
    rowEl.addEventListener('click', () => openStudentExams(rowEl.dataset.student));
  });
}

async function openStudentExams(studentName) {
  selectedStudent = studentName;
  showMentorScreen('studentExamsScreen');
  el('studentExamsTitle').textContent = `${studentName} 님이 응시한 시험지`;
  const container = el('studentExamsList');
  container.textContent = '불러오는 중...';

  const { data, error } = await sbClient
    .from('results')
    .select('exam_id, exam_name, score, total, submitted_at')
    .eq('student_name', studentName)
    .order('submitted_at', { ascending: false });

  if (error) {
    container.textContent = '불러오기 실패: ' + error.message;
    return;
  }
  if (!data || data.length === 0) {
    container.textContent = '응시 기록이 없습니다.';
    return;
  }

  const seen = new Map();
  data.forEach((r) => {
    if (!seen.has(r.exam_id)) seen.set(r.exam_id, r);
  });

  container.innerHTML = Array.from(seen.values()).map((r) => `
    <div class="list-row clickable-row" data-exam-id="${r.exam_id}" data-exam-name="${escapeHtml(r.exam_name)}">
      <div class="list-row-main">
        <div class="list-row-title">${escapeHtml(r.exam_name)}</div>
        <div class="list-row-sub">${r.score} / ${r.total} · ${new Date(r.submitted_at).toLocaleString('ko-KR')}</div>
      </div>
      <div class="muted">›</div>
    </div>
  `).join('');

  container.querySelectorAll('[data-exam-id]').forEach((rowEl) => {
    rowEl.addEventListener('click', () => openExamDetail(
      studentName,
      Number(rowEl.dataset.examId),
      rowEl.dataset.examName,
    ));
  });
}

async function openExamDetail(studentName, examId, examName) {
  selectedExamId = examId;
  selectedExamName = examName;
  showMentorScreen('examDetailScreen');
  el('examDetailTitle').textContent = `${studentName} — ${examName}`;
  const container = el('examDetailContent');
  container.textContent = '불러오는 중...';

  const { data, error } = await sbClient
    .from('results')
    .select('*')
    .eq('student_name', studentName)
    .eq('exam_id', examId)
    .order('submitted_at', { ascending: false });

  if (error) {
    container.textContent = '불러오기 실패: ' + error.message;
    return;
  }
  if (!data || data.length === 0) {
    container.textContent = '기록이 없습니다.';
    return;
  }

  container.innerHTML = data.map((r, i) => {
    const date = new Date(r.submitted_at).toLocaleString('ko-KR');
    const detailHtml = (r.detail || []).map((d) => `
      <div class="answer-row">
        <div>
          <div>${escapeHtml(d.question)}</div>
          <div class="muted">답: ${escapeHtml(d.student_answer) || '(미입력)'}</div>
        </div>
        <div class="${d.is_correct ? 'mark-good' : 'mark-bad'}">${d.is_correct ? 'O' : 'X'}</div>
      </div>
    `).join('');

    return `
      <div class="card" style="margin-bottom:12px;">
        <div class="list-row-sub">${date} · ${r.score} / ${r.total}</div>
        ${detailHtml}
      </div>
    `;
  }).join('');
}

// ===== 이벤트 연결 =====
window.addEventListener('DOMContentLoaded', () => {
  initSupabase();

  el('unlockBtn').addEventListener('click', handleUnlock);
  el('pwInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleUnlock(); });

  el('goRegisterBtn').addEventListener('click', () => {
    showMentorScreen('registerScreen');
    loadExamListIntoView();
  });
  el('goResultsBtn').addEventListener('click', () => {
    showMentorScreen('resultsListScreen');
    loadStudentListIntoView();
  });

  el('backFromRegisterBtn').addEventListener('click', () => showMentorScreen('menuScreen'));
  el('backFromResultsBtn').addEventListener('click', () => showMentorScreen('menuScreen'));
  el('backFromStudentExamsBtn').addEventListener('click', () => showMentorScreen('resultsListScreen'));
  el('backFromExamDetailBtn').addEventListener('click', () => openStudentExams(selectedStudent));

  el('submitExamBtn').addEventListener('click', handleSubmitExam);
  el('refreshStudentsBtn').addEventListener('click', loadStudentListIntoView);

  checkUnlocked();
});
