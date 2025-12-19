<h1 align="center">
  <img src="public/logo.png" alt="difit" width="260">
</h1>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.zh.md">简体中文</a> | 한국어
</p>

![difit screenshot](docs/images/screenshot.png)

**difit**은 GitHub 스타일 뷰어로 로컬 git diff를 보고 검토할 수 있는 CLI 도구입니다. 깔끔한 시각적 효과와 함께 코멘트를 AI용 프롬프트로 복사할 수 있습니다. AI 시대의 로컬 코드 리뷰 도구!

## ⚡ 빠른 시작

먼저 시도해 보세요

```bash
npx difit  # WebUI에서 최신 커밋 diff 보기
```

설치하여 사용

```bash
npm install -g difit
difit  # WebUI에서 최신 커밋 diff 보기
```

## 🚀 사용법

### 기본 사용법

```bash
difit <target>                    # 단일 커밋 diff 보기
difit <target> [compare-with]     # 두 커밋/브랜치 비교
difit --pr <github-pr-url>        # GitHub 풀 리퀘스트 검토
```

### 단일 커밋 검토

```bash
difit          # HEAD (최신) 커밋
difit 6f4a9b7  # 특정 커밋
difit feature  # feature 브랜치의 최신 커밋
```

### 두 커밋 비교

```bash
difit @ main         # main 브랜치와 비교 (@는 HEAD의 별칭)
difit feature main   # 브랜치 간 비교
difit . origin/main  # 작업 디렉토리와 원격 main 비교
```

### 특수 인수

difit은 일반적인 diff 시나리오를 위한 특수 키워드를 지원합니다:

```bash
difit .        # 모든 커밋되지 않은 변경 사항 (스테이징 영역 + 미스테이징)
difit staged   # 스테이징 영역 변경 사항
difit working  # 미스테이징 변경 사항만
```

### GitHub PR

```bash
difit --pr https://github.com/owner/repo/pull/123
```

difit은 다음 방법으로 GitHub 인증을 자동으로 처리합니다:

1. **GitHub CLI** (권장): `gh auth login`으로 로그인한 경우 기존 자격 증명 사용
2. **환경 변수**: `GITHUB_TOKEN` 환경 변수 설정
3. **인증 없음**: 공개 저장소는 인증 없이 작동 (속도 제한 있음)

#### GitHub Enterprise Server

Enterprise Server PR의 경우 귀하의 Enterprise Server 인스턴스에서 생성된 토큰을 설정해야 합니다:

1. `https://YOUR-ENTERPRISE-SERVER/settings/tokens`로 이동
2. 적절한 범위로 개인 액세스 토큰 생성
3. `GITHUB_TOKEN` 환경 변수로 설정

### 표준 입력

파이프를 사용하여 표준 입력을 통해 통합 diff를 전달하면 모든 도구의 diff를 difit으로 볼 수 있습니다.

```bash
# 다른 도구의 diff 보기
diff -u file1.txt file2.txt | difit

# 저장된 패치 검토
cat changes.patch | difit

# 머지 베이스와 비교
git diff --merge-base main feature | difit

# 기존 파일 전체를 신규 추가처럼 검토
git diff -- /dev/null path/to/file | difit
```

## ⚙️ CLI 옵션

| 플래그           | 기본값       | 설명                                                              |
| ---------------- | ------------ | ----------------------------------------------------------------- |
| `<target>`       | HEAD         | 커밋 해시, 태그, HEAD~n, 브랜치 또는 특수 인수                    |
| `[compare-with]` | -            | 비교할 선택적 두 번째 커밋 (둘 사이의 diff 표시)                  |
| `--pr <url>`     | -            | 검토할 GitHub PR URL (예: https://github.com/owner/repo/pull/123) |
| `--port`         | 4966         | 선호 포트; 사용 중인 경우 +1로 대체                               |
| `--host`         | 127.0.0.1    | 서버를 바인딩할 호스트 주소 (외부 액세스는 0.0.0.0 사용)          |
| `--no-open`      | false        | 브라우저를 자동으로 열지 않음                                     |
| `--mode`         | side-by-side | 표시 모드: `inline` 또는 `side-by-side`                           |
| `--tui`          | false        | WebUI 대신 터미널 UI 모드 사용                                    |
| `--clean`        | false        | 시작 시 모든 기존 코멘트와 열람된 파일 표시 초기화                |

## 💬 코멘트 시스템

difit은 AI 코딩 에이전트에 피드백을 쉽게 제공할 수 있는 리뷰 코멘트 시스템을 포함합니다:

1. **코멘트 추가**: diff 줄의 코멘트 버튼을 클릭하거나 드래그하여 범위 선택
2. **코멘트 편집**: 편집 버튼으로 기존 코멘트 편집
3. **프롬프트 생성**: 코멘트에는 AI 코딩 에이전트용 컨텍스트를 포맷하는 "프롬프트 복사" 버튼 포함
4. **모두 복사**: "모든 프롬프트 복사"를 사용하여 구조화된 형식으로 모든 코멘트 복사
5. **영구 저장**: 코멘트는 커밋별로 브라우저 localStorage에 저장

### 코멘트 프롬프트 형식

```sh
src/components/Button.tsx:L42   # 이 줄은 자동으로 추가됩니다
이 변수 이름을 더 설명적으로 만드세요
```

범위 선택의 경우:

```sh
src/components/Button.tsx:L42-L48   # 이 줄은 자동으로 추가됩니다
이 부분은 불필요합니다
```

## 🎨 구문 강조 언어

- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **웹 기술**: HTML, CSS, JSON, XML, Markdown
- **셸 스크립트**: `.sh`, `.bash`, `.zsh`, `.fish`
- **백엔드 언어**: PHP, SQL, Ruby, Java, Scala
- **시스템 언어**: C, C++, C#, Rust, Go
- **모바일 언어**: Swift, Kotlin, Dart
- **기타**: Python, Protobuf, YAML, Solidity, Vim 스크립트

## 🔍 자동 생성 파일 감지

difit은 생성된 파일을 자동으로 식별하고 접어서 뷰를 깔끔하게 유지합니다. 여기에는 다음이 포함됩니다:

- 잠금 파일 (`package-lock.json`, `go.mod`, `Cargo.lock`, `Gemfile.lock` 등)
- 축소된 파일 (`*.min.js`, `*.min.css`)
- 소스 맵 (`*.map`)
- 생성된 코드:
  - Orval (`*.msw.ts`, `*.zod.ts`, `*.api.ts`)
  - Dart (`*.g.dart`, `*.freezed.dart`)
  - C# (`*.g.cs`, `*.designer.cs`)
  - Protobuf (`*.pb.go`, `*.pb.cc`, `*.pb.h`)
- 프레임워크:
  - Ruby on Rails (`db/schema.rb`)
  - Laravel (`_ide_helper.php`)
  - Gradle (`gradle.lockfile`)
  - Python (`uv.lock`, `pdm.lock`)
- 일반적인 생성 파일 (`*.generated.cs`, `*.generated.ts`, `*.generated.js`)
- 콘텐츠 기반 감지:
  - `@generated` 마커가 포함된 파일
  - `DO NOT EDIT` 헤더가 포함된 파일
  - 언어별 생성 헤더 (Go, Python 등)

## 🛠️ 개발

```bash
# 의존성 설치
pnpm install

# 개발 서버 시작 (핫 리로드 포함)
# Vite 개발 서버와 CLI를 NODE_ENV=development로 동시에 실행
pnpm run dev

# 프로덕션 서버 빌드 및 시작
pnpm run start <target>

# 프로덕션용 빌드
pnpm run build

# 테스트 실행
pnpm test

# 린트 및 포맷
pnpm run lint
pnpm run format
pnpm run typecheck
```

### 개발 워크플로우

- **`pnpm run dev`**: Vite 개발 서버 (핫 리로드 포함)와 CLI 서버를 동시에 시작
- **`pnpm run start <target>`**: 모든 것을 빌드하고 프로덕션 서버 시작 (최종 빌드 테스트용)
- **개발 모드**: 핫 리로드와 빠른 개발을 위해 Vite의 개발 서버 사용
- **프로덕션 모드**: 빌드된 정적 파일 제공 (npx 및 프로덕션 빌드에서 사용)

## 🏗️ 아키텍처

- **CLI**: 포괄적인 검증을 갖춘 Commander.js로 인수 구문 분석
- **백엔드**: diff 처리를 위한 simple-git이 포함된 Express 서버
- **GitHub 통합**: 자동 인증 (GitHub CLI + 환경 변수)을 갖춘 GitHub API용 Octokit
- **프론트엔드**: React 18 + TypeScript + Vite
- **스타일링**: GitHub과 유사한 다크 테마를 갖춘 Tailwind CSS v4
- **구문 강조**: 동적 언어 로딩을 갖춘 Prism.js
- **테스트**: 동일 위치에 배치된 테스트 파일을 사용하는 Vitest 단위 테스트
- **품질**: ESLint, Prettier, lefthook 사전 커밋 훅

## 📋 요구 사항

- Node.js ≥ 21.0.0
- 검토할 커밋이 포함된 Git 저장소

## 📄 라이선스

MIT
