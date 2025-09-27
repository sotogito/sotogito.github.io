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
            // 자동 로그인 체크박스가 선택되었을 때만 자동 로그인 시도
            const canAutoLogin = authManager.canAutoLogin();
            
            if (canAutoLogin) {
                const autoLoginResult = await authManager.tryAutoLogin();
                
                if (autoLoginResult.success) {
                    // 자동 로그인 성공 시 폼에 정보 채우기
                    this.fillLoginForm(autoLoginResult.repoInfo, autoLoginResult.token);
                    
                    await this.handleSuccessfulLogin(
                        autoLoginResult.token,
                        autoLoginResult.repoInfo,
                        autoLoginResult.repoData
                    );
                } else {
                    this.showLoginScreen();
                    // 저장된 정보가 있다면 폼에 채우기
                    this.loadSavedLoginInfo();
                }
            } else {
                this.showLoginScreen();
                // 저장된 정보가 있다면 폼에 채우기 (자동 로그인은 안 함)
                this.loadSavedLoginInfo();
            }
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showLoginScreen();
            this.loadSavedLoginInfo();
        }
        
        this.isInitialized = true;
    }

    // 로그인 폼에 정보 채우기
    fillLoginForm(repoInfo, token) {
        const repoUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}`;
        const repoUrlInput = document.getElementById('repo-url');
        const tokenInput = document.getElementById('access-token');
        
        if (repoUrlInput) repoUrlInput.value = repoUrl;
        if (tokenInput) tokenInput.value = token;
    }

    // 저장된 로그인 정보 로드 (자동 로그인 체크박스 상관없이)
    loadSavedLoginInfo() {
        const repoInfo = authManager.getRepoInfo();
        const token = authManager.getToken();
        
        if (repoInfo && token) {
            this.fillLoginForm(repoInfo, token);
            // 자동 로그인이 활성화되어 있다면 체크박스도 체크
            const rememberCheckbox = document.getElementById('remember-login');
            if (rememberCheckbox && authManager.canAutoLogin()) {
                rememberCheckbox.checked = true;
            }
        }
    }

    // 모든 캐시 삭제
    clearAllCache() {
        if (confirm('모든 저장된 로그인 정보와 캐시를 삭제하시겠습니까?\n\n이상한 문자들이 나타나는 문제도 함께 해결됩니다.')) {
            // AuthManager의 모든 데이터 삭제
            authManager.logout();
            
            // 모든 저장소 완전 삭제
            try {
                localStorage.clear();
                sessionStorage.clear();
                
                // IndexedDB도 삭제 시도
                if ('indexedDB' in window) {
                    indexedDB.deleteDatabase('morning-pages');
                }
                
                // 서비스 워커 캐시 삭제 시도
                if ('caches' in window) {
                    caches.keys().then(function(names) {
                        for (let name of names) {
                            caches.delete(name);
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to clear storage:', error);
            }
            
            // 폼 초기화
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.reset();
            }
            
            // 에디터 초기화
            const editor = document.getElementById('editor');
            const titleInput = document.getElementById('file-title');
            if (editor) editor.value = '';
            if (titleInput) titleInput.value = '';
            
            showSuccess('모든 캐시가 삭제되었습니다. 페이지를 새로고침합니다.');
            
            // 강제 새로고침 (캐시 무시)
            setTimeout(() => {
                location.reload(true);
            }, 1000);
        }
    }

    // 이벤트 바인딩
    bindEvents() {
        // 로그인 폼 이벤트
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLoginAttempt.bind(this));
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

        // 수키피 확인 모달
        const sukipiModal = document.getElementById('sukipi-modal');
        const sukipiYes = document.getElementById('sukipi-yes');
        const sukipiNo = document.getElementById('sukipi-no');

        if (sukipiYes) {
            sukipiYes.addEventListener('click', () => {
                sukipiModal.classList.add('hidden');
                this.proceedWithLogin();
            });
        }

        if (sukipiNo) {
            sukipiNo.addEventListener('click', async () => {
                sukipiModal.classList.add('hidden');
                await this.handleUnauthorizedAccess();
            });
        }

        // 캐시 삭제 버튼
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearAllCache();
            });
        }

        // 파일/폴더 생성 버튼
        const newFileBtn = document.getElementById('new-file-btn');
        const newFolderBtn = document.getElementById('new-folder-btn');
        const createModal = document.getElementById('create-modal');
        const createConfirm = document.getElementById('create-confirm');

        if (newFileBtn) {
            newFileBtn.addEventListener('click', () => {
                this.showCreateModal('file');
            });
        }

        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => {
                this.showCreateModal('folder');
            });
        }

        if (createConfirm) {
            createConfirm.addEventListener('click', () => {
                this.handleCreateFileOrFolder();
            });
        }

        // 생성 모달 닫기
        const createModalCloses = createModal?.querySelectorAll('.modal-close');
        createModalCloses?.forEach(close => {
            close.addEventListener('click', () => {
                createModal.classList.add('hidden');
                // 입력 필드 초기화
                const pathInput = document.getElementById('create-path');
                if (pathInput) {
                    pathInput.value = '';
                }
            });
        });

        if (createModal) {
            createModal.addEventListener('click', (e) => {
                if (e.target === createModal) {
                    createModal.classList.add('hidden');
                    // 입력 필드 초기화
                    const pathInput = document.getElementById('create-path');
                    if (pathInput) {
                        pathInput.value = '';
                    }
                }
            });
        }

        // 편집 모달 이벤트
        const editModal = document.getElementById('edit-modal');
        const editConfirm = document.getElementById('edit-confirm');
        const deleteFile = document.getElementById('delete-file');

        if (editConfirm) {
            editConfirm.addEventListener('click', () => {
                const newPath = document.getElementById('edit-path').value;
                if (window.fileManager) {
                    window.fileManager.handleFileEdit(newPath);
                }
            });
        }

        if (deleteFile) {
            deleteFile.addEventListener('click', () => {
                if (window.fileManager) {
                    window.fileManager.handleFileDelete();
                }
            });
        }

        // 편집 모달 닫기
        const editModalCloses = editModal?.querySelectorAll('.modal-close');
        editModalCloses?.forEach(close => {
            close.addEventListener('click', () => {
                editModal.classList.add('hidden');
            });
        });

        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) {
                    editModal.classList.add('hidden');
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

    // 로그인 시도 (수키피 확인 먼저)
    handleLoginAttempt(e) {
        e.preventDefault();
        
        const repoUrl = document.getElementById('repo-url').value.trim();
        const token = document.getElementById('access-token').value.trim();

        if (!repoUrl || !token) {
            showError('Repository URL과 Access Token을 모두 입력해주세요.');
            return;
        }

        // 입력값 임시 저장
        this.tempLoginData = { repoUrl, token };
        
        // 수키피 확인 모달 표시
        const sukipiModal = document.getElementById('sukipi-modal');
        if (sukipiModal) {
            sukipiModal.classList.remove('hidden');
        }
    }

    // 실제 로그인 처리 (수키피 맞습니다)
    async proceedWithLogin() {
        if (!this.tempLoginData) return;

        const { repoUrl, token } = this.tempLoginData;
        const rememberMe = document.getElementById('remember-login').checked;
        const submitBtn = document.querySelector('button[type="submit"]');

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
            this.tempLoginData = null;
        }
    }

    // 수키피 아닙니다 - 이메일 발송
    async handleUnauthorizedAccess() {
        try {
            // 사용자 IP 가져오기
            const userIP = await this.getUserIP();
            
            // 이메일 데이터 준비
            const emailData = {
                to: 'sotogitoarchive@gmail.com',
                subject: '모닝페이지 무단 접근 시도',
                body: `수키피가 아닌 사람이 모닝페이지에 접근을 시도했습니다.\n\n시간: ${new Date().toLocaleString('ko-KR')}\nIP: ${userIP}\n\n입력된 정보:\nRepository: ${this.tempLoginData?.repoUrl || 'N/A'}`
            };

            // 실제 이메일 발송 (EmailJS 등 사용 시 여기에 구현)
            console.log('이메일 알림 발송:', emailData);
            
            // 로그인도 진행 (이메일은 발송하지만 로그인은 허용)
            await this.proceedWithLogin();
            
            showSuccess('로그인되었습니다. 관리자에게 알림이 전송되었습니다.');
            
        } catch (error) {
            console.error('Failed to send notification:', error);
            // 이메일 발송 실패해도 로그인은 진행
            await this.proceedWithLogin();
            showSuccess('로그인되었습니다.');
        }
    }

    // 사용자 IP 가져오기
    async getUserIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'Unknown';
        }
    }

    // 무단 접근 처리 메서드 제거됨

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
        const now = new Date();
        const today = formatDate(now);
        
        try {
            // 항상 오늘 작성한 가장 최신 글을 찾아서 표시
            const latestTodayFile = await this.findLatestTodayFile(today);
            
            if (latestTodayFile) {
                // 가장 최신 파일 로드
                const content = await window.githubAPI.getFile(latestTodayFile);
                if (content) {
                    // editorManager.loadFile을 사용해서 제목도 함께 설정
                    if (window.editorManager) {
                        window.editorManager.loadFile(latestTodayFile, content);
                    } else {
                        this.loadFileContent(latestTodayFile, content);
                    }
                    return;
                }
            }
            
            // 오늘 작성한 파일이 없으면 기본 파일 처리
            const fileName = `${today}.md`;
            const existingContent = await window.githubAPI.getFile(fileName);
            
            if (existingContent) {
                // 기존 파일 로드 (오늘 파일이므로 편집 가능)
                if (window.editorManager) {
                    window.editorManager.loadFile(fileName, existingContent);
                } else {
                    this.loadFileContent(fileName, existingContent);
                }
            } else {
                // 새 파일 준비 (편집 가능)
                this.prepareNewFile(fileName);
            }
        } catch (error) {
            console.error('Failed to load today file:', error);
            this.prepareNewFile(`${today}.md`);
        }
    }

    // 오늘 작성한 가장 최신 파일 찾기
    async findLatestTodayFile(today) {
        try {
            if (!window.fileManager) return null;
            
            // 모든 파일 중에서 오늘 날짜로 시작하는 파일들 찾기
            const todayFiles = window.fileManager.files.filter(file => {
                const fileName = file.fullPath || file.name;
                return fileName.includes(today);
            });
            
            if (todayFiles.length === 0) return null;
            
            // 파일명으로 정렬하여 가장 최신 파일 반환 (알파벳 순으로 마지막이 최신)
            todayFiles.sort((a, b) => {
                const nameA = a.fullPath || a.name;
                const nameB = b.fullPath || b.name;
                return nameB.localeCompare(nameA);
            });
            
            return todayFiles[0].fullPath || todayFiles[0].name;
        } catch (error) {
            console.error('Failed to find latest today file:', error);
            return null;
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
        const titleInput = document.getElementById('file-title');
        
        if (editor) {
            editor.value = '';
            editor.focus();
        }
        
        if (titleInput) {
            // 파일명에서 .md 제거하여 제목 설정
            titleInput.value = fileName.replace('.md', '');
        }
        
        // 새 파일은 편집 가능하게 설정
        if (window.editorManager) {
            window.editorManager.enableEditor();
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
        const titleInput = document.getElementById('file-title');
        
        if (!editor || countCharacters(editor.value) < 1000) {
            showError('최소 1000자 이상 작성해주세요.');
            return;
        }

        // 현재 파일명 가져오기 (제목 입력 필드에서)
        let fileName = titleInput ? titleInput.value.trim() : '';
        if (!fileName) {
            fileName = formatDate(new Date());
        }
        if (!fileName.endsWith('.md')) {
            fileName += '.md';
        }

        showLoading(saveBtn, '저장 중...');

        try {
            const content = editor.value;
            const result = await window.githubAPI.saveFile(fileName, content);
            
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
                
                // 저장 후에는 계속 편집 가능 (같은 날이면)
                const isEditable = window.fileManager ? window.fileManager.isFileEditable(fileName) : true;
                if (isEditable) {
                    saveBtn.textContent = '저장하기';
                    showSuccess('저장되었습니다. 계속 편집할 수 있습니다.');
                } else {
                    // 하루가 지났으면 읽기 전용
                    window.editorManager.disableEditor();
                }
                
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

    // 파일/폴더 생성 모달 표시
    showCreateModal(type) {
        const modal = document.getElementById('create-modal');
        const title = document.getElementById('create-modal-title');
        const pathInput = document.getElementById('create-path');
        
        if (!modal || !title || !pathInput) return;
        
        if (type === 'file') {
            title.textContent = '새 파일 생성';
        } else {
            title.textContent = '새 폴더 생성';
        }
        
        pathInput.placeholder = '';
        pathInput.value = '';
        
        modal.classList.remove('hidden');
        pathInput.focus();
    }

    // 파일/폴더 생성 처리
    async handleCreateFileOrFolder() {
        const pathInput = document.getElementById('create-path');
        const modal = document.getElementById('create-modal');
        
        if (!pathInput) {
            showError('입력 필드를 찾을 수 없습니다.');
            return;
        }
        
        let path = pathInput.value.trim();
        
        try {
            // 파일 생성 로직
            let fileName, title;
            const today = formatDate(new Date());
            
            if (path.includes('/')) {
                // 슬래시가 있는 경우
                if (path.endsWith('/')) {
                    // "2025/09/" -> "2025/09/2025-01-27.md"
                    fileName = `${path}${today}.md`;
                    title = `${path}${today}`;
                } else {
                    // "2025/09/new" -> "2025/09/2025-01-27 new.md"
                    const parts = path.split('/');
                    const lastPart = parts.pop();
                    const folderPath = parts.join('/');
                    
                    fileName = `${folderPath}/${today} ${lastPart}.md`;
                    title = `${folderPath}/${today} ${lastPart}`;
                }
            } else {
                // 슬래시가 없는 경우
                if (path.endsWith('.md')) {
                    // "test.md" -> "test.md" (그대로)
                    fileName = path;
                    title = path.replace('.md', '');
                } else if (path === '') {
                    // 빈 입력 -> "2025-01-27.md"
                    fileName = `${today}.md`;
                    title = today;
                } else {
                    // "new" -> "2025-01-27 new.md"
                    fileName = `${today} ${path}.md`;
                    title = `${today} ${path}`;
                }
            }
                
            // 파일 생성
            if (window.editorManager) {
                window.editorManager.loadFile(fileName, '');
                // 제목 필드에 올바른 제목 설정
                const titleInput = document.getElementById('file-title');
                if (titleInput) {
                    titleInput.value = title;
                }
            }
            showSuccess('새 파일이 생성되었습니다.');
            
            modal.classList.add('hidden');
            
        } catch (error) {
            console.error('Failed to create file/folder:', error);
            showError('생성에 실패했습니다.');
        }
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
