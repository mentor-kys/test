let sbClient = null;

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

// ===== 잠금 =====
function handleUnlock() {
  const pw = el('pwInput').value;
  if (pw === MENTOR_PASSWORD) {
    sessionStorage.setItem('mentorUnlocked', '1');
    el('lockScreen').classList.add('hidden');
    el('mainScreen').classList.remove('hidden');
    loadQuestionsIntoList();
  } else {
    el('lockError').textContent = '비밀번호가 올바르지 않습니다.';
    el('lockError').classList.remove('hidden');
  }
}

function checkUnlocked() {
  if (sessionStorage.getItem('mentorUnlocked') === '1') {
    el('lockScreen').classList.add('hidden');
    el('mainScreen').classList.remove('hidden');
    loadQuestionsIntoList();
  }
}

// ===== 탭 전환 =====
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      el('tabQuestions').classList.toggle('hidden', tab !== 'questions');
      el('tabResults').classList.toggle('hidden', tab !== 'results');
      if (tab === 'results') loadResultsIntoList();
    });
  });
}

// ===== 문제 관리 =====
async function loadQuestionsIntoList() {
  const container = el('questionListMentor');
  container.textContent = '불러오는 중...';
  const { data, error } = await sbClient
    .from('questions')
    .select('*')
    .order('order_num', { ascending: true });

  if (error) {
    container.textContent = '불러오기 실패: ' + error.message;
    return;
  }

  if (!data || data.length === 0) {
    container.textContent = '등록된 문제가 없습니다.';
    return;
  }

  container.innerHTML = data.map((q) => `
    <div class="list-row">
      <div class="list-row-main">
        <div class="list-row-title">${escapeHtml(q.question_text)}</div>
        <div class="list-row-sub">정답: ${escapeHtml(q.answer_text)}</div>
      </div>
      <button class="danger" data-id="${q.id}">삭제</button>
    </div>
  `).join('');

  container.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteQuestion(btn.dataset.id));
  });
}

async function handleAddQuestion() {
  const questionText = el('newQuestion').value.trim();
  const answerText = el('newAnswer').value.trim();
  el('addError').classList.add('hidden');

  if (!questionText || !answerText) {
    el('addError').textContent = '문제와 정답을 모두 입력해주세요.';
    el('addError').classList.remove('hidden');
    return;
  }

  el('addQuestionBtn').disabled = true;

  const { data: existing } = await sbClient.from('questions').select('order_num').order('order_num', { ascending: false }).limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].order_num + 1 : 0;

  const { error } = await sbClient.from('questions').insert({
    question_text: questionText,
    answer_text: answerText,
    order_num: nextOrder,
  });

  el('addQuestionBtn').disabled = false;

  if (error) {
    el('addError').textContent = '추가 실패: ' + error.message;
    el('addError').classList.remove('hidden');
    return;
  }

  el('newQuestion').value = '';
  el('newAnswer').value = '';
  loadQuestionsIntoList();
}

async function handleDeleteQuestion(id) {
  if (!confirm('이 문제를 삭제할까요?')) return;
  const { error } = await sbClient.from('questions').delete().eq('id', id);
  if (error) {
    alert('삭제 실패: ' + error.message);
    return;
  }
  loadQuestionsIntoList();
}

// ===== 결과 조회 =====
async function loadResultsIntoList() {
  const container = el('resultListMentor');
  container.textContent = '불러오는 중...';

  const { data, error } = await sbClient
    .from('results')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    container.textContent = '불러오기 실패: ' + error.message;
    return;
  }

  if (!data || data.length === 0) {
    container.textContent = '아직 제출된 결과가 없습니다.';
    return;
  }

  container.innerHTML = data.map((r, i) => {
    const date = new Date(r.submitted_at).toLocaleString('ko-KR');
    const detailId = `detail-${i}`;
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
      <div class="list-row" style="flex-direction: column; align-items: stretch;">
        <div class="row" style="justify-content: space-between; align-items: center;">
          <div class="list-row-main">
            <div class="list-row-title">${escapeHtml(r.student_name)} — ${r.score} / ${r.total}</div>
            <div class="list-row-sub">${date}</div>
          </div>
          <button class="secondary" data-toggle="${detailId}">상세보기</button>
        </div>
        <div id="${detailId}" class="hidden" style="margin-top:10px;">${detailHtml}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('button[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      el(btn.dataset.toggle).classList.toggle('hidden');
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  setupTabs();
  el('unlockBtn').addEventListener('click', handleUnlock);
  el('pwInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleUnlock(); });
  el('addQuestionBtn').addEventListener('click', handleAddQuestion);
  el('refreshResultsBtn').addEventListener('click', loadResultsIntoList);
  checkUnlocked();
});
