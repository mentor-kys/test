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
4. 왼쪽 메뉴 "Table Editor"에서 `questions`, `results` 테이블이 생겼는지 확인

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
- 학생: 배포된 주소(`.../index.html` 또는 그냥 루트 주소)로 접속 → 이름 입력 → 시험 응시
- 멘토: 주소 뒤에 `/mentor.html` 붙여서 접속 → 비밀번호 입력 → 문제 등록 / 결과 확인

## 참고
- 정답은 여러 개 인정하고 싶으면 `config.js`가 아니라 문제 등록 화면에서 정답 입력 시 `|`로 구분해서 넣으면 됩니다. 예: `apple|Apple|APPLE`
- 채점은 공백 정리 + 대소문자 무시 후 비교합니다.
- 멘토 페이지 비밀번호는 브라우저 코드에 그대로 들어있는 방식이라 완전히 안전하지는 않습니다. 학교 활동 수준의 가벼운 잠금으로 사용하세요.
