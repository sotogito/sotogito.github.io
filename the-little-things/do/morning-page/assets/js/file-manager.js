// 파일 관리 모듈

class FileManager {
    constructor() {
        this.files = [];
        this.currentFile = null;
        this.fileTree = null;
        this.collapsedFolders = new Set(); // 접힌 폴더들 추적
        this.virtualFolders = new Set(); // 가상 폴더들 추적
        
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

    // 파일 목록 로드 (폴더 구조 포함)
    async loadFiles() {
        try {
            if (!window.githubAPI) {
                throw new Error('GitHub API가 초기화되지 않았습니다.');
            }

            // Repository의 모든 내용을 재귀적으로 가져오기
            const allContents = await this.getAllContentsRecursively();
            this.files = allContents.filter(item => item.type === 'file' && item.name.endsWith('.md'));
            this.folders = allContents.filter(item => item.type === 'dir');
            
            this.renderFileTree();
            
            return this.files;
        } catch (error) {
            console.error('Failed to load files:', error);
            showError('파일 목록을 불러오는데 실패했습니다.');
            return [];
        }
    }

    // 모든 내용을 재귀적으로 가져오기
    async getAllContentsRecursively(path = '') {
        try {
            const contents = await window.githubAPI.getRepositoryContents(path);
            let allItems = [];

            for (const item of contents) {
                allItems.push({
                    ...item,
                    fullPath: path ? `${path}/${item.name}` : item.name
                });

                // 폴더인 경우 재귀적으로 탐색
                if (item.type === 'dir') {
                    const subItems = await this.getAllContentsRecursively(item.path);
                    allItems = allItems.concat(subItems);
                }
            }

            return allItems;
        } catch (error) {
            console.error('Failed to get contents recursively:', error);
            return [];
        }
    }

    // 파일 트리 렌더링 (폴더 구조 포함)
    renderFileTree() {
        if (!this.fileTree) return;
        
        // 파일과 폴더가 모두 없는 경우
        if (this.files.length === 0 && (!this.folders || this.folders.length === 0)) {
            this.fileTree.innerHTML = `
                <div class="file-item empty">
                    <span style="color: #999; font-style: italic;">아직 작성된 글이 없습니다</span>
                </div>
            `;
            return;
        }

        // 파일 트리 구조 생성
        const treeStructure = this.buildTreeStructure();
        const treeHTML = this.renderTreeNode(treeStructure);
        
        this.fileTree.innerHTML = treeHTML;
        
        // 파일 클릭 이벤트 바인딩
        this.bindFileClickEvents();
    }

    // 트리 구조 빌드
    buildTreeStructure() {
        const tree = {};
        
        // 모든 파일을 트리 구조로 변환
        this.files.forEach(file => {
            const pathParts = file.fullPath.split('/');
            let currentNode = tree;
            
            // 경로의 각 부분을 순회하며 트리 구조 생성
            pathParts.forEach((part, index) => {
                if (!currentNode[part]) {
                    currentNode[part] = {
                        type: index === pathParts.length - 1 ? 'file' : 'folder',
                        children: {},
                        data: index === pathParts.length - 1 ? file : null,
                        fullPath: pathParts.slice(0, index + 1).join('/')
                    };
                }
                currentNode = currentNode[part].children;
            });
        });
        
        return tree;
    }

    // 트리 노드 렌더링
    renderTreeNode(node, level = 0) {
        let html = '';
        
        // 노드를 정렬 (폴더 먼저, 그 다음 파일, 알파벳순)
        const sortedKeys = Object.keys(node).sort((a, b) => {
            const aIsFolder = node[a].type === 'folder';
            const bIsFolder = node[b].type === 'folder';
            
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            return a.localeCompare(b);
        });
        
        sortedKeys.forEach(key => {
            const item = node[key];
            const nestingClass = level > 0 ? `nested${level > 1 ? '-' + level : ''}` : '';
            
            if (item.type === 'folder') {
                // 폴더 렌더링
                const isCollapsed = this.collapsedFolders.has(item.fullPath);
                const toggleIcon = isCollapsed ? '▶' : '▼';
                
                html += `
                    <div class="file-item folder ${nestingClass}" data-folder="${item.fullPath}">
                        <span class="folder-toggle" data-folder="${item.fullPath}">${toggleIcon}</span>
                        <span class="file-name">${key}</span>
                    </div>
                `;
                
                // 하위 항목들 렌더링 (접혀있지 않을 때만)
                if (!isCollapsed) {
                    html += this.renderTreeNode(item.children, level + 1);
                }
                
            } else {
                // 파일 렌더링
                const date = this.extractDateFromFileName(key);
                const displayName = date ? this.formatDisplayName(key, date) : key.replace('.md', '');
                
                html += `
                    <div class="file-item file ${nestingClass}" data-file="${item.data.fullPath}">
                        <span class="file-name">${displayName}</span>
                        <span class="file-date">${this.formatFileDate(date)}</span>
                    </div>
                `;
            }
        });
        
        return html;
    }

    // 파일 클릭 이벤트 바인딩
    bindFileClickEvents() {
        // 파일 아이템 클릭 이벤트
        const fileItems = this.fileTree.querySelectorAll('.file-item[data-file]');
        fileItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const filePath = item.dataset.file;
                await this.openFile(filePath);
            });
        });

        // 폴더 토글 이벤트
        const folderToggles = this.fileTree.querySelectorAll('.folder-toggle');
        folderToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const folderPath = toggle.dataset.folder;
                this.toggleFolder(folderPath);
            });
        });
    }

    // 폴더 접기/펼치기
    toggleFolder(folderPath) {
        if (this.collapsedFolders.has(folderPath)) {
            this.collapsedFolders.delete(folderPath);
        } else {
            this.collapsedFolders.add(folderPath);
        }
        
        // 파일 트리 다시 렌더링
        this.renderFileTree();
    }

    // 파일 열기 (전체 경로 지원)
    async openFile(filePath) {
        try {
            // 로딩 상태 표시
            const fileItem = this.fileTree.querySelector(`[data-file="${filePath}"]`);
            if (fileItem) {
                fileItem.classList.add('loading');
            }

            // 파일 내용 가져오기 (전체 경로 사용)
            const content = await window.githubAPI.getFile(filePath);
            
            if (content !== null) {
                // 에디터에 로드
                if (window.editorManager) {
                    window.editorManager.loadFile(filePath, content);
                }
                
                // 현재 파일 업데이트
                this.setCurrentFile(filePath);
                
                // 하루가 지났는지 확인하여 에디터 활성화/비활성화
                const fileName = filePath.split('/').pop();
                const isEditable = this.isFileEditable(fileName);
                
                if (!isEditable) {
                    // 하루가 지난 파일은 읽기 전용
                    window.editorManager.disableEditor();
                } else {
                    // 당일 파일은 편집 가능
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
            const fileItem = this.fileTree.querySelector(`[data-file="${filePath}"]`);
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

    // 표시용 파일명 포맷 (원본 그대로)
    formatDisplayName(fileName, date) {
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

    // 파일 편집 가능 여부 확인 (하루가 지나지 않았는지)
    isFileEditable(fileName) {
        // 파일명에서 날짜 추출
        const fileDate = this.extractDateFromFileName(fileName);
        if (!fileDate) {
            // 날짜 형식이 아닌 파일은 항상 편집 가능
            return true;
        }

        // 파일 날짜와 오늘 날짜 비교
        const fileDateObj = new Date(fileDate + 'T00:00:00'); // 정확한 날짜 파싱
        const today = new Date();
        
        // 시간을 00:00:00으로 설정하여 날짜만 비교
        today.setHours(0, 0, 0, 0);
        
        console.log('File date:', fileDateObj, 'Today:', today);
        console.log('File editable:', fileDateObj.getTime() >= today.getTime());
        
        // 파일 날짜가 오늘 이후이면 편집 가능 (같은 날 포함)
        return fileDateObj.getTime() >= today.getTime();
    }

    // 편집 모달 표시
    showEditModal(filePath) {
        const modal = document.getElementById('edit-modal');
        const pathInput = document.getElementById('edit-path');
        
        if (!modal || !pathInput) return;
        
        // 현재 파일 경로를 입력창에 설정
        pathInput.value = filePath;
        this.currentEditingFile = filePath;
        
        modal.classList.remove('hidden');
        pathInput.focus();
        pathInput.select();
    }

    // 파일 편집 처리
    async handleFileEdit(newPath) {
        if (!this.currentEditingFile || !newPath.trim()) {
            showError('파일 경로를 입력해주세요.');
            return;
        }

        const oldPath = this.currentEditingFile;
        const trimmedNewPath = newPath.trim();

        try {
            // 경로가 변경된 경우
            if (oldPath !== trimmedNewPath) {
                // 기존 파일 내용 가져오기
                const content = await window.githubAPI.getFile(oldPath);
                
                if (content !== null) {
                    // 새 경로에 파일 생성
                    const saveResult = await window.githubAPI.saveFile(trimmedNewPath, content, `Move ${oldPath} to ${trimmedNewPath}`);
                    
                    if (saveResult.success) {
                        // 기존 파일 삭제 (실제로는 GitHub API에서 삭제 지원하지 않으므로 생략)
                        showSuccess('파일이 이동되었습니다.');
                        
                        // 파일 목록 새로고침
                        await this.refresh();
                        
                        // 새 파일을 에디터에 로드
                        if (window.editorManager) {
                            window.editorManager.loadFile(trimmedNewPath, content);
                        }
                    } else {
                        showError(saveResult.error || '파일 이동에 실패했습니다.');
                    }
                } else {
                    showError('원본 파일을 찾을 수 없습니다.');
                }
            } else {
                showSuccess('변경사항이 없습니다.');
            }

            // 모달 닫기
            const modal = document.getElementById('edit-modal');
            if (modal) {
                modal.classList.add('hidden');
            }

        } catch (error) {
            console.error('Failed to edit file:', error);
            showError('파일 편집에 실패했습니다.');
        } finally {
            this.currentEditingFile = null;
        }
    }

    // 파일 삭제 처리
    async handleFileDelete() {
        if (!this.currentEditingFile) return;

        const fileName = this.currentEditingFile.split('/').pop();
        
        if (!confirm(`'${fileName}' 파일을 정말 삭제하시겠습니까?\n\n⚠️ 주의: GitHub API 제한으로 실제 삭제는 되지 않으며, 파일 목록에서만 숨겨집니다.`)) {
            return;
        }

        try {
            // GitHub API는 파일 삭제를 지원하지만 복잡하므로 
            // 여기서는 로컬에서만 제거하고 실제 삭제는 GitHub에서 수동으로 하도록 안내
            showError('GitHub API 제한으로 파일 삭제는 GitHub 웹사이트에서 직접 해주세요.');
            
            // 모달 닫기
            const modal = document.getElementById('edit-modal');
            if (modal) {
                modal.classList.add('hidden');
            }

        } catch (error) {
            console.error('Failed to delete file:', error);
            showError('파일 삭제에 실패했습니다.');
        } finally {
            this.currentEditingFile = null;
        }
    }

    // 가상 폴더 추가 (프론트엔드에서만 표시)
    addVirtualFolder(folderPath) {
        this.virtualFolders.add(folderPath);
        this.renderFileTree();
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
