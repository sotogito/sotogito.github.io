// 파일 관리 모듈

class FileManager {
    constructor() {
        this.files = [];
        this.currentFile = null;
        this.fileTree = null;
        
        this.init();
    }

    // 파일 매니저 초기화
    init() {
        this.fileTree = document.getElementById('file-tree');
        this.bindEvents();
    }

    // 이벤트 바인딩
    bindEvents() {
        // 파일 트리 클릭 이벤트는 동적으로 바인딩됨
    }

    // 파일 목록 로드
    async loadFiles() {
        try {
            if (!window.githubAPI) {
                throw new Error('GitHub API가 초기화되지 않았습니다.');
            }

            const files = await window.githubAPI.getMarkdownFiles();
            this.files = files;
            this.renderFileTree();
            
            return files;
        } catch (error) {
            console.error('Failed to load files:', error);
            showError('파일 목록을 불러오는데 실패했습니다.');
            return [];
        }
    }

    // 파일 트리 렌더링
    renderFileTree() {
        if (!this.fileTree) return;
        
        // 파일이 없는 경우
        if (this.files.length === 0) {
            this.fileTree.innerHTML = `
                <div class="file-item empty">
                    <span style="color: #999; font-style: italic;">아직 작성된 글이 없습니다</span>
                </div>
            `;
            return;
        }

        // 파일 목록 생성
        const fileElements = this.files.map(file => {
            const date = this.extractDateFromFileName(file.name);
            const displayName = date ? this.formatDisplayName(file.name, date) : file.name;
            
            return `
                <div class="file-item" data-file="${file.name}">
                    <span class="file-name">${displayName}</span>
                    <span class="file-date">${this.formatFileDate(date)}</span>
                </div>
            `;
        }).join('');

        this.fileTree.innerHTML = fileElements;
        
        // 파일 클릭 이벤트 바인딩
        this.bindFileClickEvents();
    }

    // 파일 클릭 이벤트 바인딩
    bindFileClickEvents() {
        const fileItems = this.fileTree.querySelectorAll('.file-item[data-file]');
        
        fileItems.forEach(item => {
            item.addEventListener('click', async () => {
                const fileName = item.dataset.file;
                await this.openFile(fileName);
            });
        });
    }

    // 파일 열기
    async openFile(fileName) {
        try {
            // 로딩 상태 표시
            const fileItem = this.fileTree.querySelector(`[data-file="${fileName}"]`);
            if (fileItem) {
                fileItem.classList.add('loading');
            }

            // 파일 내용 가져오기
            const content = await window.githubAPI.getFile(fileName);
            
            if (content !== null) {
                // 에디터에 로드
                if (window.editorManager) {
                    window.editorManager.loadFile(fileName, content);
                }
                
                // 현재 파일 업데이트
                this.setCurrentFile(fileName);
                
                // 오늘 파일인지 확인하여 에디터 활성화/비활성화
                const today = formatDate(new Date());
                const isToday = fileName.startsWith(today);
                
                if (!isToday) {
                    // 과거 파일은 읽기 전용
                    window.editorManager.disableEditor();
                } else {
                    // 오늘 파일은 편집 가능 (이미 저장된 경우 제외)
                    window.editorManager.enableEditor();
                }
            } else {
                showError('파일을 불러올 수 없습니다.');
            }
        } catch (error) {
            console.error('Failed to open file:', error);
            showError('파일을 여는데 실패했습니다.');
        } finally {
            // 로딩 상태 해제
            const fileItem = this.fileTree.querySelector(`[data-file="${fileName}"]`);
            if (fileItem) {
                fileItem.classList.remove('loading');
            }
        }
    }

    // 현재 파일 설정
    setCurrentFile(fileName) {
        // 이전 선택 해제
        const prevSelected = this.fileTree.querySelector('.file-item.active');
        if (prevSelected) {
            prevSelected.classList.remove('active');
        }
        
        // 새 선택 활성화
        const newSelected = this.fileTree.querySelector(`[data-file="${fileName}"]`);
        if (newSelected) {
            newSelected.classList.add('active');
        }
        
        this.currentFile = fileName;
    }

    // 파일명에서 날짜 추출
    extractDateFromFileName(fileName) {
        const match = fileName.match(/(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
    }

    // 표시용 파일명 포맷
    formatDisplayName(fileName, date) {
        if (date) {
            const dateObj = new Date(date);
            const options = { 
                month: 'long', 
                day: 'numeric',
                weekday: 'short'
            };
            const formatted = dateObj.toLocaleDateString('ko-KR', options);
            return formatted;
        }
        return fileName.replace('.md', '');
    }

    // 파일 날짜 포맷
    formatFileDate(date) {
        if (!date) return '';
        
        const dateObj = new Date(date);
        const today = new Date();
        const diffTime = today - dateObj;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return '오늘';
        } else if (diffDays === 1) {
            return '어제';
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else {
            return date;
        }
    }

    // 새 파일 생성
    async createNewFile(fileName = null) {
        const today = formatDate(new Date());
        const defaultFileName = `${today}.md`;
        const newFileName = fileName || defaultFileName;
        
        // 에디터에 새 파일 로드
        if (window.editorManager) {
            window.editorManager.newFile(newFileName);
        }
        
        // 파일 트리에서 선택 해제
        const prevSelected = this.fileTree.querySelector('.file-item.active');
        if (prevSelected) {
            prevSelected.classList.remove('active');
        }
        
        this.currentFile = newFileName;
    }

    // 파일 검색
    searchFiles(query) {
        if (!query.trim()) {
            this.renderFileTree();
            return;
        }
        
        const filteredFiles = this.files.filter(file => 
            file.name.toLowerCase().includes(query.toLowerCase())
        );
        
        const originalFiles = this.files;
        this.files = filteredFiles;
        this.renderFileTree();
        this.files = originalFiles;
    }

    // 파일 통계
    getFileStats() {
        const totalFiles = this.files.length;
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        
        const thisMonthFiles = this.files.filter(file => {
            const date = this.extractDateFromFileName(file.name);
            if (!date) return false;
            
            const fileDate = new Date(date);
            return fileDate.getMonth() === thisMonth && 
                   fileDate.getFullYear() === thisYear;
        }).length;
        
        return {
            total: totalFiles,
            thisMonth: thisMonthFiles
        };
    }

    // 연속 작성일 계산
    getStreakDays() {
        if (this.files.length === 0) return 0;
        
        const dates = this.files
            .map(file => this.extractDateFromFileName(file.name))
            .filter(date => date)
            .map(date => new Date(date))
            .sort((a, b) => b - a); // 최신순 정렬
        
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        for (const date of dates) {
            date.setHours(0, 0, 0, 0);
            const diffDays = (currentDate - date) / (1000 * 60 * 60 * 24);
            
            if (diffDays === streak) {
                streak++;
                currentDate = new Date(date);
            } else if (diffDays === streak + 1) {
                streak++;
                currentDate = new Date(date);
            } else {
                break;
            }
        }
        
        return streak;
    }

    // 파일 목록 새로고침
    async refresh() {
        await this.loadFiles();
    }

    // 현재 선택된 파일 가져오기
    getCurrentFile() {
        return this.currentFile;
    }

    // 파일 존재 여부 확인
    fileExists(fileName) {
        return this.files.some(file => file.name === fileName);
    }

    // 오늘 파일 존재 여부 확인
    todayFileExists() {
        const today = formatDate(new Date());
        return this.fileExists(`${today}.md`);
    }
}

// CSS 스타일 추가
const fileManagerStyle = document.createElement('style');
fileManagerStyle.textContent = `
    .file-item {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .file-item.loading::after {
        content: '';
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 12px;
        height: 12px;
        border: 2px solid #e1e1e1;
        border-top: 2px solid #333;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    .file-name {
        font-weight: 500;
    }
    
    .file-date {
        font-size: 11px;
        opacity: 0.7;
    }
    
    .file-item.empty {
        justify-content: center;
        padding: 20px;
        text-align: center;
    }
    
    @keyframes spin {
        0% { transform: translateY(-50%) rotate(0deg); }
        100% { transform: translateY(-50%) rotate(360deg); }
    }
`;
document.head.appendChild(fileManagerStyle);

// 전역 FileManager 인스턴스
window.fileManager = new FileManager();
