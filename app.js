let sbClient = null;
let questions = [];
let studentName = '';

function initSupabase() {
  if (!window.supabase) throw new Error('Supabase 라이브러리를 불러오지 못했습니다.');
  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

function normalize(str) {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isCorrect(studentAnswer, answerText) {
  const accepted = answerText.split('|').map(normalize);
  return accepted.includes(normalize(studentAnswer));
}

function el(id) { return document.getElementById(id); }

async function loadQuestions() {
  const { data, error } = await sbClient
    .from('questions')
    .select('*')
    .order('order_num', { ascending: true });
  if (error) throw error;
  return data || [];
}

function renderQuestions() {
  const list = el('questionList');
  list.innerHTML = questions.map((q, i) => `
    <div class="question-item">
      <div class="q-index">문제 ${i + 1} / ${questions.length}</div>
      <div class="q-text">${escapeHtml(q.question_text)}</div>
      <input type="text" class="answer-input" data-index="${i}" placeholder="답을 입력하세요" />
    </div>
  `).join('');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

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
    questions = await loadQuestions();
    if (questions.length === 0) {
      el('startError').textContent = '등록된 문제가 없습니다. 멘토에게 문의하세요.';
      el('startError').classList.remove('hidden');
      return;
    }
    studentName = name;
    renderQuestions();
    el('startScreen').classList.add('hidden');
    el('examScreen').classList.remove('hidden');
  } catch (e) {
    el('startError').textContent = '문제를 불러오는 중 오류가 발생했습니다: ' + e.message;
    el('startError').classList.remove('hidden');
  } finally {
    el('loadingMsg').classList.add('hidden');
    el('startBtn').disabled = false;
  }
}

async function handleSubmit() {
  const inputs = document.querySelectorAll('.answer-input');
  const detail = [];
  let score = 0;

  inputs.forEach((input) => {
    const i = Number(input.dataset.index);
    const q = questions[i];
    const studentAnswer = input.value;
    const correct = isCorrect(studentAnswer, q.answer_text);
    if (correct) score++;
    detail.push({
      question: q.question_text,
      correct_answer: q.answer_text,
      student_answer: studentAnswer,
      is_correct: correct,
    });
  });

  el('submitBtn').disabled = true;

  try {
    const { error } = await sbClient.from('results').insert({
      student_name: studentName,
      score,
      total: questions.length,
      detail,
    });
    if (error) throw error;
  } catch (e) {
    alert('결과 저장 중 오류가 발생했습니다: ' + e.message + '\n(점수는 아래에 표시되지만 멘토에게는 전달되지 않았을 수 있어요)');
  }

  showResult(score, detail);
}

function showResult(score, detail) {
  el('examScreen').classList.add('hidden');
  el('resultScreen').classList.remove('hidden');
  el('resultName').textContent = studentName + ' 님의 결과';
  el('resultScore').textContent = `${score} / ${detail.length}`;

  el('resultDetail').innerHTML = detail.map((d, i) => `
    <div class="answer-row">
      <div>
        <div><strong>${i + 1}.</strong> ${escapeHtml(d.question)}</div>
        <div class="muted">내 답: ${escapeHtml(d.student_answer) || '(미입력)'}</div>
        ${!d.is_correct ? `<div class="muted">정답: ${escapeHtml(d.correct_answer.split('|')[0])}</div>` : ''}
      </div>
      <div class="${d.is_correct ? 'mark-good' : 'mark-bad'}">${d.is_correct ? 'O' : 'X'}</div>
    </div>
  `).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  el('startBtn').addEventListener('click', handleStart);
  el('submitBtn').addEventListener('click', handleSubmit);
});
