# 모닝페이지 웹 애플리케이션 계획서

## 📝 프로젝트 개요
옵시디언과 유사한 인터페이스를 가진 모닝페이지 작성 웹 애플리케이션입니다. GitHub Private Repository와 연동하여 매일 1000자 이상의 글을 작성하고 관리할 수 있습니다.

## 🎯 핵심 기능

### 1. 파일 관리 시스템
- **옵시디언 스타일 파일 트리**: 좌측 사이드바에 폴더 구조 표시
- **파일 생성**: 날짜별 자동 파일명 생성 (YYYY-MM-DD.md)
- **파일 조회**: 기존 작성글 열람 및 마크다운 렌더링

### 2. 글 작성 시스템
- **마크다운 지원**: 실시간 마크다운 미리보기
- **글자수 제한**: 최소 1000자 이상 필수
- **실시간 글자수 카운터**: 현재 글자수/1000자 표시
- **글자 삭제 제한**: 작성된 내용 삭제 불가 (append-only)
- **수동 저장**: 사용자가 직접 저장 버튼 클릭 시에만 저장

### 3. 작성 현황 시스템
- **깃허브 잔디 스타일**: 연간 작성 현황 히트맵
- **시간별 색상 구분**:
  - 🟢 초록색: 10시 이전 작성
  - 🟡 노란색: 10시~14시 작성  
  - 🟠 주황색: 14시 이후 작성
- **연속 작성일**: 스트릭 표시

### 4. GitHub 연동
- **GitHub API 활용**: Repository 파일 관리
- **자동 커밋/푸시**: 글 저장 시 자동으로 Private Repository에 반영
- **파일 동기화**: 기존 파일들을 웹에서 조회 가능

## 🔐 보안 및 인증 시스템

### 인증 방식: GitHub Personal Access Token (PAT)
```
장점:
- GitHub API 공식 인증 방식
- Fine-grained permissions 설정 가능
- 특정 Repository만 접근 권한 부여
- Token 만료일 설정 가능

보안 조치:
- Token은 localStorage에 암호화 저장
- HTTPS 통신만 허용
- Repository 삭제 권한 제외
- 읽기/쓰기 권한만 부여
```

### 로그인 플로우
1. **Repository URL 입력**: `https://github.com/username/morning-pages-private`
2. **GitHub PAT 입력**: `ghp_xxxxxxxxxxxxxxxxxxxx`
3. **Token 유효성 검증**: GitHub API로 토큰 검사
4. **Repository 접근 권한 확인**: 해당 Private Repository 접근 가능한지 확인
5. **암호화하여 localStorage 저장**: CryptoJS로 토큰 암호화 후 저장
6. **자동 로그인 설정** (선택사항): 30일간 자동 로그인 유지

### GitHub Personal Access Token 생성 가이드
```
1. GitHub.com → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. "Generate new token (classic)" 클릭
4. Token name: "Morning Pages Web App"
5. Expiration: 90 days 또는 1 year
6. Select scopes: ☑️ repo (Full control of private repositories)
7. Generate token → 생성된 토큰을 복사하여 웹앱에 입력
```

### API 호출 예시
```javascript
// 파일 저장 API 호출
const saveToGitHub = async (token, owner, repo, content) => {
  const fileName = `${new Date().toISOString().split('T')[0]}.md`;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: `Morning page ${fileName}`,
      content: btoa(unescape(encodeURIComponent(content)))
    })
  });
};
```

### 로그아웃 및 보안
- 로그아웃 시 localStorage 완전 삭제
- Token 만료 시 자동 로그아웃
- 브라우저 종료 시 세션 정리 옵션

## 🏗️ 아키텍처 설계

### 폴더 구조
```
morning-page/
├── index.html                 # 메인 애플리케이션
├── login.html                 # 로그인 페이지
├── assets/
│   ├── css/
│   │   ├── main.css          # 메인 스타일
│   │   ├── login.css         # 로그인 스타일
│   │   ├── editor.css        # 에디터 스타일
│   │   └── heatmap.css       # 히트맵 스타일
│   ├── js/
│   │   ├── app.js            # 메인 애플리케이션 로직
│   │   ├── auth.js           # 인증 관리
│   │   ├── github-api.js     # GitHub API 연동
│   │   ├── editor.js         # 에디터 기능
│   │   ├── file-manager.js   # 파일 관리
│   │   ├── heatmap.js        # 작성 현황 히트맵
│   │   └── utils.js          # 유틸리티 함수
│   └── libs/
│       ├── marked.min.js     # 마크다운 파서
│       └── crypto-js.min.js  # 암호화 라이브러리
└── README.md                 # 이 파일
```

### 기술 스택
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **마크다운**: Marked.js
- **암호화**: CryptoJS
- **API**: GitHub REST API v4
- **스토리지**: localStorage (암호화된 토큰)

## 🚨 모닝페이지 작성 규칙 및 주의사항

### 작성 규칙
1. **최소 글자수**: 반드시 1000자 이상 작성
2. **일일 1회**: 하루에 한 번만 저장 가능
3. **삭제 금지**: 작성된 내용은 수정/삭제 불가
4. **연속성**: 매일 작성하여 습관 형성
5. **시간 권장**: 가능한 오전 10시 이전 작성

### 모닝페이지 가이드라인
- **의식의 흐름대로**: 생각나는 대로 자유롭게 작성
- **검열 금지**: 맞춤법이나 문법에 신경 쓰지 말 것
- **판단 중단**: 작성 중 내용을 평가하지 말 것
- **개인적 성찰**: 감정, 생각, 꿈, 계획 등 자유롭게
- **창의성 발휘**: 아이디어나 영감을 자유롭게 기록

### 추가 기능 아이디어
- **단어 구름**: 자주 사용하는 단어 시각화
- **감정 분석**: 작성된 글의 감정 상태 분석
- **주제 태그**: 자동 주제 분류 및 태그 생성
- **통계 대시보드**: 작성 패턴, 시간대 분석
- **목표 설정**: 월별/연별 작성 목표 설정

## 🔧 구현 단계

### Phase 1: 기본 구조
1. HTML 레이아웃 및 CSS 스타일링
2. 로그인 시스템 구현
3. GitHub API 연동 기초

### Phase 2: 핵심 기능
1. 파일 트리 및 파일 관리
2. 마크다운 에디터 구현
3. 글자수 카운터 및 제한

### Phase 3: 고급 기능
1. 작성 현황 히트맵
2. 자동 저장 및 동기화
3. 반응형 디자인 최적화

### Phase 4: 보안 및 최적화
1. 보안 강화 및 에러 처리
2. 성능 최적화
3. 사용자 경험 개선

## 🛡️ 보안 고려사항

### 데이터 보호
- PAT 토큰 암호화 저장
- HTTPS 강제 사용
- XSS 방지 코드 적용
- CSRF 보호 메커니즘

### 접근 제어
- Repository별 권한 제한
- 읽기/쓰기 권한만 허용
- 삭제/관리자 권한 제외
- 토큰 만료 관리

### 에러 처리
- API 호출 실패 시 재시도 로직
- 네트워크 오류 대응
- 토큰 만료 자동 감지
- 사용자 친화적 에러 메시지

## 📱 사용자 경험 (UX)

### 반응형 디자인
- 모바일/태블릿/데스크톱 최적화
- 터치 친화적 인터페이스
- 키보드 단축키 지원

### 접근성
- 스크린 리더 지원
- 키보드 네비게이션
- 고대비 모드 지원
- 폰트 크기 조절

## 🚀 배포 및 유지보수

### GitHub Pages 배포
- 자동 배포 워크플로우
- 브랜치 보호 규칙
- 버전 관리 전략

### 모니터링
- 에러 로그 수집
- 사용량 통계
- 성능 모니터링

---

이 계획서는 보안을 고려한 실현 가능한 설계로, GitHub Pages에서 안전하게 운영할 수 있는 모닝페이지 애플리케이션을 구현하는 것을 목표로 합니다.
