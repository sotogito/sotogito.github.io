// 메인 애플리케이션 로직

class MorningPagesApp {
    constructor() {
        this.currentUser = null;
        this.currentRepo = null;
        this.isInitialized = false;
        
        this.bindEvents();
        this.init();
    }

    // 애플리케이션 초기화
    async init() {
        try {
            // 자동 로그인 시도
            const autoLoginResult = await authManager.tryAutoLogin();
            
            if (autoLoginResult.success) {
                await this.handleSuccessfulLogin(
                    autoLoginResult.token,
                    autoLoginResult.repoInfo,
                    autoLoginResult.repoData
                );
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showLoginScreen();
        }
        
        this.isInitialized = true;
    }

    // 이벤트 바인딩
    bindEvents() {
        // 로그인 폼 이벤트
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // 토큰 가이드 모달
        const tokenGuide = document.getElementById('token-guide');
        const tokenModal = document.getElementById('token-modal');
        const modalClose = tokenModal?.querySelector('.modal-close');

        if (tokenGuide && tokenModal) {
            tokenGuide.addEventListener('click', (e) => {
                e.preventDefault();
                tokenModal.classList.remove('hidden');
            });
        }

        if (modalClose && tokenModal) {
            modalClose.addEventListener('click', () => {
                tokenModal.classList.add('hidden');
            });
        }

        // 모달 배경 클릭으로 닫기
        if (tokenModal) {
            tokenModal.addEventListener('click', (e) => {
                if (e.target === tokenModal) {
                    tokenModal.classList.add('hidden');
                }
            });
        }

        // 로그아웃 버튼
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // 에디터 이벤트
        const editor = document.getElementById('editor');
        const saveBtn = document.getElementById('save-btn');
        
        if (editor) {
            editor.addEventListener('input', this.handleEditorInput.bind(this));
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', this.handleSave.bind(this));
        }

        // 윈도우 리사이즈 이벤트
        window.addEventListener('resize', debounce(this.handleResize.bind(this), 250));
    }

    // 로그인 처리
    async handleLogin(e) {
        e.preventDefault();
        
        const repoUrl = document.getElementById('repo-url').value.trim();
        const token = document.getElementById('access-token').value.trim();
        const rememberMe = document.getElementById('remember-login').checked;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        if (!repoUrl || !token) {
            showError('Repository URL과 Access Token을 모두 입력해주세요.');
            return;
        }

        showLoading(submitBtn, '로그인 중...');

        try {
            const result = await authManager.login(repoUrl, token, rememberMe);
            
            if (result.success) {
                await this.handleSuccessfulLogin(token, parseRepoUrl(repoUrl), result.repoData);
                showSuccess('로그인되었습니다.');
            } else {
                showError(result.error);
            }
        } catch (error) {
            showError('로그인 중 오류가 발생했습니다.');
            console.error('Login error:', error);
        } finally {
            hideLoading(submitBtn, '로그인');
        }
    }

    // 성공적인 로그인 후 처리
    async handleSuccessfulLogin(token, repoInfo, repoData) {
        this.currentRepo = { ...repoInfo, data: repoData };
        
        // 사용자 정보 가져오기
        this.currentUser = await authManager.getUserInfo();
        
        // UI 업데이트
        this.updateUserInfo();
        this.showMainScreen();
        
        // GitHub API 초기화
        if (window.githubAPI) {
            window.githubAPI.init(token, repoInfo.owner, repoInfo.repo);
        }
        
        // 파일 매니저 초기화
        if (window.fileManager) {
            await window.fileManager.loadFiles();
        }
        
        // 히트맵 초기화
        if (window.heatmapManager) {
            await window.heatmapManager.init();
        }
        
        // 오늘 날짜 파일 자동 생성/로드
        await this.loadTodayFile();
    }

    // 사용자 정보 UI 업데이트
    updateUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (userInfo && this.currentUser && this.currentRepo) {
            userInfo.textContent = `${this.currentUser.login} / ${this.currentRepo.data.name}`;
        }
    }

    // 오늘 날짜 파일 로드/생성
    async loadTodayFile() {
        const today = formatDate(new Date());
        const fileName = `${today}.md`;
        
        try {
            // 오늘 파일이 이미 있는지 확인
            const existingContent = await window.githubAPI.getFile(fileName);
            
            if (existingContent) {
                // 기존 파일 로드
                this.loadFileContent(fileName, existingContent);
            } else {
                // 새 파일 준비
                this.prepareNewFile(fileName);
            }
        } catch (error) {
            console.error('Failed to load today file:', error);
            this.prepareNewFile(fileName);
        }
    }

    // 파일 내용 로드
    loadFileContent(fileName, content) {
        const editor = document.getElementById('editor');
        const currentFileSpan = document.getElementById('current-file');
        
        if (editor) {
            editor.value = content;
            this.updateCharCount();
        }
        
        if (currentFileSpan) {
            currentFileSpan.textContent = fileName;
        }
    }

    // 새 파일 준비
    prepareNewFile(fileName) {
        const editor = document.getElementById('editor');
        const currentFileSpan = document.getElementById('current-file');
        
        if (editor) {
            editor.value = '';
            editor.focus();
        }
        
        if (currentFileSpan) {
            currentFileSpan.textContent = fileName;
        }
        
        this.updateCharCount();
    }

    // 에디터 입력 처리
    handleEditorInput() {
        this.updateCharCount();
        this.updatePreview();
        this.updateWritingTime();
    }

    // 글자수 업데이트
    updateCharCount() {
        const editor = document.getElementById('editor');
        const charCount = document.getElementById('char-count');
        const saveBtn = document.getElementById('save-btn');
        const editorStats = document.querySelector('.editor-stats');
        
        if (!editor || !charCount) return;
        
        const count = countCharacters(editor.value);
        charCount.textContent = count;
        
        // 글자수에 따른 스타일 변경
        if (editorStats) {
            editorStats.classList.remove('warning', 'success');
            if (count >= 1000) {
                editorStats.classList.add('success');
            } else if (count >= 800) {
                editorStats.classList.add('warning');
            }
        }
        
        // 저장 버튼 활성화/비활성화
        if (saveBtn) {
            saveBtn.disabled = count < 1000;
        }
    }

    // 마크다운 미리보기 업데이트
    updatePreview() {
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        
        if (!editor || !preview || !window.marked) return;
        
        const markdown = editor.value;
        if (markdown.trim()) {
            preview.innerHTML = marked.parse(markdown);
        } else {
            preview.innerHTML = '<p style="color: #999; font-style: italic;">미리보기가 여기에 표시됩니다...</p>';
        }
    }

    // 작성 시간 업데이트
    updateWritingTime() {
        const writingTime = document.getElementById('writing-time');
        if (writingTime) {
            writingTime.textContent = `작성 시간: ${getCurrentTime()}`;
        }
    }

    // 저장 처리
    async handleSave() {
        const editor = document.getElementById('editor');
        const saveBtn = document.getElementById('save-btn');
        const currentFile = document.getElementById('current-file').textContent;
        
        if (!editor || countCharacters(editor.value) < 1000) {
            showError('최소 1000자 이상 작성해주세요.');
            return;
        }

        showLoading(saveBtn, '저장 중...');

        try {
            const content = editor.value;
            const result = await window.githubAPI.saveFile(currentFile, content);
            
            if (result.success) {
                showSuccess('저장되었습니다!');
                
                // 파일 목록 새로고침
                if (window.fileManager) {
                    await window.fileManager.loadFiles();
                }
                
                // 히트맵 업데이트
                if (window.heatmapManager) {
                    await window.heatmapManager.updateHeatmap();
                }
                
                // 에디터 비활성화 (하루에 한 번만 저장)
                editor.disabled = true;
                saveBtn.disabled = true;
                saveBtn.textContent = '저장 완료';
                
            } else {
                showError(result.error || '저장에 실패했습니다.');
            }
        } catch (error) {
            showError('저장 중 오류가 발생했습니다.');
            console.error('Save error:', error);
        } finally {
            if (!editor.disabled) {
                hideLoading(saveBtn, '저장하기');
            }
        }
    }

    // 로그아웃 처리
    handleLogout() {
        if (confirm('로그아웃하시겠습니까?')) {
            authManager.logout();
            this.currentUser = null;
            this.currentRepo = null;
            this.showLoginScreen();
            showSuccess('로그아웃되었습니다.');
        }
    }

    // 윈도우 리사이즈 처리
    handleResize() {
        // 모바일/데스크톱 전환 시 레이아웃 조정
        if (isMobile()) {
            this.adjustMobileLayout();
        } else {
            this.adjustDesktopLayout();
        }
    }

    // 모바일 레이아웃 조정
    adjustMobileLayout() {
        // 모바일에서는 미리보기를 하단으로 이동
        const previewSection = document.querySelector('.preview-section');
        if (previewSection) {
            previewSection.style.order = '3';
        }
    }

    // 데스크톱 레이아웃 조정
    adjustDesktopLayout() {
        const previewSection = document.querySelector('.preview-section');
        if (previewSection) {
            previewSection.style.order = '0';
        }
    }

    // 로그인 화면 표시
    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const mainScreen = document.getElementById('main-screen');
        
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (mainScreen) mainScreen.classList.add('hidden');
        
        // 폼 초기화
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.reset();
    }

    // 메인 화면 표시
    showMainScreen() {
        const loginScreen = document.getElementById('login-screen');
        const mainScreen = document.getElementById('main-screen');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (mainScreen) mainScreen.classList.remove('hidden');
        
        // 초기 UI 업데이트
        this.updateWritingTime();
        this.updateCharCount();
        this.updatePreview();
    }
}

// DOM 로드 완료 후 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MorningPagesApp();
});
