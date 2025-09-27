// 에디터 관리 모듈

class EditorManager {
    constructor() {
        this.editor = null;
        this.preview = null;
        this.currentFile = null;
        this.isDirty = false;
        this.autoSaveTimer = null;
        
        this.init();
    }

    // 에디터 초기화
    init() {
        this.editor = document.getElementById('editor');
        this.preview = document.getElementById('preview');
        this.titleInput = document.getElementById('file-title');
        
        if (this.editor) {
            this.bindEditorEvents();
            this.setupAutoPreview();
        }

        if (this.titleInput) {
            this.bindTitleEvents();
        }
    }

    // 제목 입력 필드 이벤트 바인딩
    bindTitleEvents() {
        this.titleInput.addEventListener('input', () => {
            this.isDirty = true;
        });

        this.titleInput.addEventListener('keydown', (e) => {
            // Backspace와 Delete는 제목에서는 허용
            if (e.key === 'Enter') {
                e.preventDefault();
                this.editor.focus();
            }
        });
    }

    // 에디터 이벤트 바인딩
    bindEditorEvents() {
        // 입력 이벤트
        this.editor.addEventListener('input', debounce(() => {
            this.handleInput();
        }, 300));

        // 키보드 단축키
        this.editor.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });

        // 포커스 이벤트
        this.editor.addEventListener('focus', () => {
            this.handleFocus();
        });

        this.editor.addEventListener('blur', () => {
            this.handleBlur();
        });

        // 스크롤 동기화 (에디터와 미리보기)
        this.editor.addEventListener('scroll', debounce(() => {
            this.syncPreviewScroll();
        }, 100));
    }

    // 입력 처리 (임시 저장 기능 제거)
    handleInput() {
        this.isDirty = true;
        this.updatePreview();
        this.updateStats();
        
        // 앱의 핸들러 호출
        if (window.app) {
            window.app.handleEditorInput();
        }
    }

    // 키보드 단축키 처리
    handleKeydown(e) {
        // Backspace와 Delete 키 금지 (작성 중인 글 삭제 방지)
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            showError('작성 중인 내용은 삭제할 수 없습니다.');
            return;
        }

        // Ctrl+S (저장)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (window.app) {
                window.app.handleSave();
            }
        }

        // Tab 키 처리 (4칸 공백)
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            
            this.editor.value = this.editor.value.substring(0, start) + 
                               '    ' + 
                               this.editor.value.substring(end);
            
            this.editor.selectionStart = this.editor.selectionEnd = start + 4;
            this.handleInput();
        }
    }

    // 포커스 처리
    handleFocus() {
        const editorSection = document.querySelector('.editor-section');
        if (editorSection) {
            editorSection.classList.add('focused');
        }
    }

    // 블러 처리
    handleBlur() {
        const editorSection = document.querySelector('.editor-section');
        if (editorSection) {
            editorSection.classList.remove('focused');
        }
    }

    // 자동 미리보기 설정
    setupAutoPreview() {
        // 초기 미리보기 업데이트
        this.updatePreview();
    }

    // 미리보기 업데이트
    updatePreview() {
        if (!this.preview || !window.marked) return;
        
        const content = this.editor.value;
        
        if (content.trim()) {
            try {
                // marked 옵션 설정
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: false
                });
                
                this.preview.innerHTML = marked.parse(content);
            } catch (error) {
                console.error('Markdown parsing error:', error);
                this.preview.innerHTML = '<p style="color: #ff4444;">마크다운 파싱 오류가 발생했습니다.</p>';
            }
        } else {
            this.preview.innerHTML = '<p style="color: #999; font-style: italic;">미리보기가 여기에 표시됩니다...</p>';
        }
    }

    // 통계 업데이트
    updateStats() {
        const charCount = document.getElementById('char-count');
        const editorStats = document.querySelector('.editor-stats');
        
        if (!charCount) return;
        
        const content = this.editor.value;
        const count = countCharacters(content);
        
        charCount.textContent = count;
        
        // 스타일 업데이트
        if (editorStats) {
            editorStats.classList.remove('warning', 'success');
            if (count >= 1000) {
                editorStats.classList.add('success');
            } else if (count >= 800) {
                editorStats.classList.add('warning');
            }
        }
        
        // 저장 버튼 상태 업데이트
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn && !this.editor.disabled) {
            saveBtn.disabled = count < 1000;
        }
    }

    // 미리보기 스크롤 동기화
    syncPreviewScroll() {
        if (!this.preview) return;
        
        const editorScrollTop = this.editor.scrollTop;
        const editorScrollHeight = this.editor.scrollHeight - this.editor.clientHeight;
        const previewScrollHeight = this.preview.scrollHeight - this.preview.clientHeight;
        
        if (editorScrollHeight > 0 && previewScrollHeight > 0) {
            const scrollRatio = editorScrollTop / editorScrollHeight;
            this.preview.scrollTop = scrollRatio * previewScrollHeight;
        }
    }

    // 파일 로드
    loadFile(fileName, content, commitInfo = null) {
        this.currentFile = fileName;
        this.editor.value = content || '';
        this.editor.disabled = false;
        this.isDirty = false;
        
        // 제목 필드 업데이트
        if (this.titleInput) {
            const displayName = this.getDisplayNameFromPath(fileName);
            this.titleInput.value = displayName;
            this.titleInput.disabled = false;
        }
        
        // 작성 시간 업데이트 (커밋 정보가 있으면 실제 시간 표시)
        if (window.app && commitInfo && commitInfo.date) {
            window.app.updateWritingTime(commitInfo.date);
        } else if (window.app) {
            window.app.updateWritingTime();
        }
        
        // UI 업데이트
        this.updatePreview();
        this.updateStats();
        
        // 에디터 포커스
        setTimeout(() => {
            this.editor.focus();
            this.editor.setSelectionRange(this.editor.value.length, this.editor.value.length);
        }, 100);
    }

    // 파일 경로에서 표시 이름 추출
    getDisplayNameFromPath(filePath) {
        // .md 확장자만 제거하고 전체 경로 반환
        return filePath.replace('.md', '');
    }

    // 새 파일 생성
    newFile(fileName = null) {
        const today = formatDate(new Date());
        const defaultFileName = `${today}.md`;
        
        this.loadFile(fileName || defaultFileName, '');
    }

    // 에디터 비활성화 (과거 파일 읽기 전용)
    disableEditor() {
        if (this.editor) {
            this.editor.disabled = true;
            this.editor.style.backgroundColor = '#f5f5f5';
            this.editor.style.color = '#666';
        }

        if (this.titleInput) {
            this.titleInput.disabled = true;
            this.titleInput.style.backgroundColor = '#f5f5f5';
            this.titleInput.style.color = '#666';
        }
        
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '읽기 전용';
            saveBtn.style.backgroundColor = '#ccc';
        }
    }

    // 에디터 활성화
    enableEditor() {
        if (this.editor) {
            this.editor.disabled = false;
            this.editor.style.backgroundColor = '#fff';
            this.editor.style.color = '#333';
        }

        if (this.titleInput) {
            this.titleInput.disabled = false;
            this.titleInput.style.backgroundColor = 'transparent';
            this.titleInput.style.color = '#333';
        }
        
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.textContent = '저장하기';
            saveBtn.style.backgroundColor = '#000';
        }
        
        this.updateStats();
    }

    // 현재 파일명 가져오기 (제목 입력 필드 기준)
    getCurrentFileName() {
        if (this.titleInput && this.titleInput.value.trim()) {
            const title = this.titleInput.value.trim();
            return title.endsWith('.md') ? title : `${title}.md`;
        }
        return this.currentFile || `${formatDate(new Date())}.md`;
    }

    // 현재 내용 가져오기
    getContent() {
        return this.editor ? this.editor.value : '';
    }

    // 내용 설정
    setContent(content) {
        if (this.editor) {
            this.editor.value = content;
            this.updatePreview();
            this.updateStats();
        }
    }

    // 변경사항 여부 확인
    hasChanges() {
        return this.isDirty;
    }

    // 변경사항 저장됨 표시
    markSaved() {
        this.isDirty = false;
    }

    // 에디터 정리
    cleanup() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
    }

    // 마크다운 도구 (향후 확장용)
    insertMarkdown(type, text = '') {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end);
        
        let insertText = '';
        let cursorOffset = 0;
        
        switch (type) {
            case 'bold':
                insertText = `**${selectedText || text || '굵은 텍스트'}**`;
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'italic':
                insertText = `*${selectedText || text || '기울임 텍스트'}*`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'heading':
                insertText = `## ${selectedText || text || '제목'}`;
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'list':
                insertText = `- ${selectedText || text || '목록 항목'}`;
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'quote':
                insertText = `> ${selectedText || text || '인용문'}`;
                cursorOffset = selectedText ? 0 : 0;
                break;
        }
        
        this.editor.value = this.editor.value.substring(0, start) + 
                           insertText + 
                           this.editor.value.substring(end);
        
        const newCursorPos = start + insertText.length + cursorOffset;
        this.editor.setSelectionRange(newCursorPos, newCursorPos);
        this.editor.focus();
        
        this.handleInput();
    }
}

// 전역 EditorManager 인스턴스
window.editorManager = new EditorManager();
