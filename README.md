# 영어 멘토멘티 시험 사이트

순수 HTML/CSS/JS + Supabase(DB) + Vercel(배포) 구조입니다.

## 파일 구성
- `index.html` + `app.js` — 학생용 시험 응시 페이지
- `mentor.html` + `mentor.js` — 멘토용 문제 등록 / 결과 조회 페이지 (비밀번호로 잠김)
- `style.css` — 공통 스타일
- `config.js` — Supabase 연결 정보 + 멘토 비밀번호 (직접 채워 넣어야 함)
- `supabase-schema.sql` — Supabase에 만들 테이블 정의

## 처음 설정하는 방법 (순서대로)

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 접속 → 로그인 → "New project" 클릭
2. 이름은 아무거나 (예: english-mentor-test), 비밀번호는 잘 기억해둘 것 (지금 만드는 로그인 비밀번호와는 다른, DB 관리자용)
3. 프로젝트가 만들어질 때까지 1분 정도 기다리기

### 2. 테이블 만들기
1. 왼쪽 메뉴에서 "SQL Editor" 클릭
2. 이 폴더의 `supabase-schema.sql` 파일 내용을 전체 복사
3. SQL Editor에 붙여넣고 우측 하단 "Run" 클릭
4. 왼쪽 메뉴 "Table Editor"에서 `exams`, `questions`, `results` 테이블이 생겼는지 확인

(이미 예전 버전을 실행한 적이 있다면 이 스크립트가 기존 테이블을 지우고 새로 만듭니다. 아직 실제 시험 데이터가 없다면 안전합니다.)

### 3. 연결 정보 가져오기
1. 왼쪽 메뉴 톱니바퀴(Project Settings) → "API" 클릭
2. "Project URL" 값을 복사
3. "anon public" 키 값을 복사

### 4. config.js 채워 넣기
`config.js` 파일을 열어서:
- `YOUR_SUPABASE_URL` 자리에 Project URL 붙여넣기
- `YOUR_SUPABASE_ANON_KEY` 자리에 anon public 키 붙여넣기
- `MENTOR_PASSWORD` 값을 원하는 비밀번호로 변경 (멘토 페이지 잠금용, 학생들에게는 알려주지 않기)

### 5. GitHub에 올리기
터미널(이 폴더에서)에서:
```bash
git init
git add .
git commit -m "Initial commit"
```
그 다음 GitHub에서 새 저장소(예: english-mentor-test)를 만들고, 저장소 페이지에 나오는 안내에 따라:
```bash
git remote add origin https://github.com/사용자이름/저장소이름.git
git branch -M main
git push -u origin main
```

### 6. Vercel로 배포하기
1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. "Add New..." → "Project" → 방금 만든 GitHub 저장소 선택
3. 별도 설정 없이 "Deploy" 클릭 (프레임워크 없는 순수 HTML이라 빌드 설정 불필요)
4. 배포 완료되면 나오는 주소가 실제 사이트 주소

## 사용 방법

### 학생
1. 배포된 주소로 접속 → 이름 입력 → 가운데 "시험 응시" 버튼 클릭
2. 확인 창에서 "확인" → 3, 2, 1 카운트다운 → 문제 전체가 한 번에 표시됨
3. 문제 아래 입력 칸에 답을 적으면 자동으로 임시저장됨 (새로고침해도 답과 남은 시간이 유지됨)
4. 맨 아래 "시험 종료" 버튼 → 확인하면 제출, 또는 15분이 다 되면 자동으로 제출됨
5. 제출 후에는 점수 없이 "제출 완료"만 표시됩니다 (학생 화면에는 채점 결과가 보이지 않음)

### 멘토
1. 시작 화면 맨 아래 "멘토 로그인" 클릭 (또는 주소 뒤에 `/mentor.html`)
2. 비밀번호 입력 후 "시험 문제 등록" 또는 "시험지 확인" 선택

**시험 문제 등록**: 시험지 이름을 적고, 아래 칸에 문제를 붙여넣습니다. 문제와 문제 사이는 빈 줄로 구분하고, 각 블록의 마지막 줄이 정답, 그 위 줄들이 문제 내용입니다.
```
사과를 영어로 쓰시오.
apple

바나나를 영어로 쓰시오.
banana|Banana
```
정답을 여러 개 인정하려면 `|`로 구분하세요 (예: `apple|Apple`). 등록할 때마다 새 시험지가 만들어지고, **학생은 항상 가장 최근에 등록한 시험지를 응시**합니다.

**시험지 확인**: 응시한 학생 이름 목록 → 이름을 누르면 그 학생이 본 시험지 목록 → 시험지를 누르면 그때 제출한 답안과 채점 결과(O/X)를 확인할 수 있습니다.

## 참고
- 채점은 공백 정리 + 대소문자 무시 후 비교합니다.
- 시험 시간은 15분으로 고정되어 있습니다. 바꾸고 싶으면 `app.js` 맨 위 `EXAM_DURATION_MS` 값을 수정하세요 (예: 20분 = `20 * 60 * 1000`).
- 멘토 페이지 비밀번호는 브라우저 코드에 그대로 들어있는 방식이라 완전히 안전하지는 않습니다. 학교 활동 수준의 가벼운 잠금으로 사용하세요.
