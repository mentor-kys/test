-- Supabase 대시보드 -> SQL Editor 에서 이 파일 내용을 전체 복사해서 실행하세요.
-- (이미 예전 버전의 questions/results 테이블을 만들었다면, 이 스크립트가 지우고 새로 만듭니다.
--  아직 실제 시험 데이터가 없다면 안전하게 실행하셔도 됩니다.)

drop table if exists results;
drop table if exists questions;
drop table if exists exams;

create table exams (
  id bigint generated always as identity primary key,
  name text not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table questions (
  id bigint generated always as identity primary key,
  exam_id bigint not null references exams(id) on delete cascade,
  question_text text not null,
  order_num integer not null default 0,
  created_at timestamptz not null default now()
);

create table results (
  id bigint generated always as identity primary key,
  exam_id bigint not null references exams(id) on delete cascade,
  exam_name text not null,
  student_name text not null,
  total integer not null,
  detail jsonb not null,
  submitted_at timestamptz not null default now()
);

alter table exams enable row level security;
alter table questions enable row level security;
alter table results enable row level security;

-- 이 사이트는 별도 로그인 시스템 없이 멘토 페이지 비밀번호로만 보호되므로,
-- 아래 정책은 "누구나 읽고 쓸 수 있게" 열어둡니다.
create policy "exams select all" on exams for select using (true);
create policy "exams insert all" on exams for insert with check (true);
create policy "exams update all" on exams for update using (true) with check (true);
create policy "exams delete all" on exams for delete using (true);

create policy "questions select all" on questions for select using (true);
create policy "questions insert all" on questions for insert with check (true);

create policy "results select all" on results for select using (true);
create policy "results insert all" on results for insert with check (true);
