-- Supabase 대시보드 -> SQL Editor 에서 이 파일 내용을 전체 복사해서 실행하세요.

create table questions (
  id bigint generated always as identity primary key,
  question_text text not null,
  answer_text text not null,
  order_num integer not null default 0,
  created_at timestamptz not null default now()
);

create table results (
  id bigint generated always as identity primary key,
  student_name text not null,
  score integer not null,
  total integer not null,
  detail jsonb not null,
  submitted_at timestamptz not null default now()
);

alter table questions enable row level security;
alter table results enable row level security;

-- 이 사이트는 별도 로그인 시스템 없이 멘토 페이지 비밀번호로만 보호되므로,
-- 아래 정책은 "누구나 읽고 쓸 수 있게" 열어둡니다.
create policy "questions select all" on questions for select using (true);
create policy "questions insert all" on questions for insert with check (true);
create policy "questions delete all" on questions for delete using (true);

create policy "results select all" on results for select using (true);
create policy "results insert all" on results for insert with check (true);
