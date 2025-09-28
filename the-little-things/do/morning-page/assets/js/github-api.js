// GitHub API 연동 모듈

class GitHubAPI {
    constructor() {
        this.token = null;
        this.owner = null;
        this.repo = null;
        this.baseUrl = 'https://api.github.com';
    }

    // API 초기화
    init(token, owner, repo) {
        this.token = token;
        this.owner = owner;
        this.repo = repo;
    }

    // API 요청 헤더 생성
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
    }

    // API 요청 래퍼
    async apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: this.getHeaders(),
                ...options
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error ${response.status}: ${errorData.message || response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Repository 내용 목록 가져오기
    async getRepositoryContents(path = '') {
        try {
            const endpoint = `/repos/${this.owner}/${this.repo}/contents/${path}`;
            return await this.apiRequest(endpoint);
        } catch (error) {
            console.error('Failed to get repository contents:', error);
            throw error;
        }
    }

    // 특정 파일 내용 가져오기
    async getFile(fileName) {
        try {
            const endpoint = `/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            const response = await this.apiRequest(endpoint);
            
            // Base64 디코딩
            const content = atob(response.content.replace(/\n/g, ''));
            return decodeURIComponent(escape(content));
        } catch (error) {
            if (error.message.includes('404')) {
                // 파일이 존재하지 않음
                return null;
            }
            console.error('Failed to get file:', error);
            throw error;
        }
    }

    // 특정 파일의 커밋 정보 가져오기 (작성 시간 확인용)
    async getFileCommitInfo(fileName) {
        try {
            const endpoint = `/repos/${this.owner}/${this.repo}/commits?path=${fileName}&per_page=1`;
            const commits = await this.apiRequest(endpoint);
            
            if (commits && commits.length > 0) {
                return {
                    date: commits[0].commit.author.date,
                    message: commits[0].commit.message
                };
            }
            return null;
        } catch (error) {
            console.error('Failed to get file commit info:', error);
            return null;
        }
    }

    // 파일 저장 (생성 또는 업데이트)
    async saveFile(fileName, content, message = null) {
        try {
            // 커밋 메시지 생성 - "from sukipi.me 날짜" 형식
            const today = formatDate(new Date());
            const commitMessage = message || `from sukipi.me ${today}`;
            
            console.log('GitHub API saveFile 시작:', {
                fileName,
                message: commitMessage,
                contentLength: content.length
            });
            
            // 기존 파일이 있는지 확인 (SHA 값 필요)
            let sha = null;
            let isUpdate = false;
            try {
                const existingFile = await this.apiRequest(`/repos/${this.owner}/${this.repo}/contents/${fileName}`);
                sha = existingFile.sha;
                isUpdate = true;
                console.log('기존 파일 발견, 업데이트 모드:', {
                    fileName,
                    sha: sha.substring(0, 8) + '...',
                    size: existingFile.size
                });
            } catch (error) {
                // 파일이 없으면 새로 생성
                console.log('새 파일 생성 모드:', fileName);
            }

            // 파일 내용을 Base64로 인코딩
            const encodedContent = btoa(unescape(encodeURIComponent(content)));

            const requestBody = {
                message: commitMessage,
                content: encodedContent,
                branch: 'main'
            };

            // 기존 파일 업데이트인 경우 SHA 포함
            if (sha) {
                requestBody.sha = sha;
            }

            console.log('GitHub API 요청:', {
                fileName,
                isUpdate,
                hasSha: !!sha,
                message: commitMessage
            });

            const endpoint = `/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            const result = await this.apiRequest(endpoint, {
                method: 'PUT',
                body: JSON.stringify(requestBody)
            });

            console.log('GitHub API 저장 성공:', {
                fileName,
                isUpdate,
                commitSha: result.commit.sha.substring(0, 8) + '...'
            });

            return {
                success: true,
                data: result,
                isUpdate: isUpdate
            };
        } catch (error) {
            console.error('Failed to save file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 모든 마크다운 파일 목록 가져오기
    async getMarkdownFiles() {
        try {
            const contents = await this.getRepositoryContents();
            
            // .md 파일만 필터링하고 날짜순 정렬
            const markdownFiles = contents
                .filter(item => item.type === 'file' && item.name.endsWith('.md'))
                .map(file => ({
                    name: file.name,
                    path: file.path,
                    sha: file.sha,
                    size: file.size,
                    downloadUrl: file.download_url
                }))
                .sort((a, b) => b.name.localeCompare(a.name)); // 최신 파일 먼저

            return markdownFiles;
        } catch (error) {
            console.error('Failed to get markdown files:', error);
            throw error;
        }
    }

    // 특정 기간의 커밋 히스토리 가져오기 (히트맵용)
    async getCommitHistory(since = null, until = null) {
        try {
            let endpoint = `/repos/${this.owner}/${this.repo}/commits?per_page=100`;
            
            if (since) {
                endpoint += `&since=${since}`;
            }
            if (until) {
                endpoint += `&until=${until}`;
            }

            const commits = await this.apiRequest(endpoint);
            
            // 모닝페이지 커밋만 필터링
            const morningPageCommits = commits.filter(commit => 
                commit.commit.message.includes('Morning page') ||
                commit.commit.message.includes('from sukipi.me') ||
                commit.commit.message.match(/\d{4}-\d{2}-\d{2}\.md/)
            );

            return morningPageCommits.map(commit => ({
                date: commit.commit.author.date,
                message: commit.commit.message,
                sha: commit.sha
            }));
        } catch (error) {
            console.error('Failed to get commit history:', error);
            throw error;
        }
    }

    // 연간 커밋 데이터 가져오기 (히트맵용)
    async getYearlyCommitData(year = new Date().getFullYear()) {
        try {
            const startDate = new Date(year, 0, 1).toISOString();
            const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
            
            const commits = await this.getCommitHistory(startDate, endDate);
            
            // 날짜별로 그룹화
            const commitsByDate = {};
            commits.forEach(commit => {
                const date = commit.date.split('T')[0]; // YYYY-MM-DD 형식
                const hour = new Date(commit.date).getHours();
                
                if (!commitsByDate[date]) {
                    commitsByDate[date] = {
                        count: 0,
                        hour: hour,
                        commits: []
                    };
                }
                
                commitsByDate[date].count++;
                commitsByDate[date].commits.push(commit);
                
                // 가장 이른 시간으로 업데이트
                if (hour < commitsByDate[date].hour) {
                    commitsByDate[date].hour = hour;
                }
            });

            return commitsByDate;
        } catch (error) {
            console.error('Failed to get yearly commit data:', error);
            throw error;
        }
    }

    // Repository 정보 가져오기
    async getRepositoryInfo() {
        try {
            const endpoint = `/repos/${this.owner}/${this.repo}`;
            return await this.apiRequest(endpoint);
        } catch (error) {
            console.error('Failed to get repository info:', error);
            throw error;
        }
    }

    // 사용자 정보 가져오기
    async getUserInfo() {
        try {
            return await this.apiRequest('/user');
        } catch (error) {
            console.error('Failed to get user info:', error);
            throw error;
        }
    }

    // API 속도 제한 정보 가져오기
    async getRateLimit() {
        try {
            return await this.apiRequest('/rate_limit');
        } catch (error) {
            console.error('Failed to get rate limit:', error);
            throw error;
        }
    }

    // 파일 삭제
    async deleteFile(fileName, message = null) {
        try {
            // 커밋 메시지 생성
            const today = formatDate(new Date());
            const commitMessage = message || `Delete ${fileName} from sukipi.me ${today}`;
            
            console.log('GitHub API deleteFile 시작:', {
                fileName,
                message: commitMessage
            });
            
            // 기존 파일의 SHA 값 가져오기
            let sha = null;
            try {
                const existingFile = await this.apiRequest(`/repos/${this.owner}/${this.repo}/contents/${fileName}`);
                sha = existingFile.sha;
                console.log('삭제할 파일 발견:', {
                    fileName,
                    sha: sha.substring(0, 8) + '...',
                    size: existingFile.size
                });
            } catch (error) {
                console.log('삭제할 파일이 존재하지 않음:', fileName);
                return {
                    success: true,
                    message: '파일이 이미 존재하지 않습니다.'
                };
            }

            const requestBody = {
                message: commitMessage,
                sha: sha,
                branch: 'main'
            };

            console.log('GitHub API 삭제 요청:', {
                fileName,
                sha: sha.substring(0, 8) + '...',
                message: commitMessage
            });

            const endpoint = `/repos/${this.owner}/${this.repo}/contents/${fileName}`;
            const result = await this.apiRequest(endpoint, {
                method: 'DELETE',
                body: JSON.stringify(requestBody)
            });

            console.log('GitHub API 삭제 성공:', {
                fileName,
                commitSha: result.commit.sha.substring(0, 8) + '...'
            });

            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('Failed to delete file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 연결 테스트
    async testConnection() {
        try {
            const repoInfo = await this.getRepositoryInfo();
            const userInfo = await this.getUserInfo();
            
            return {
                success: true,
                repo: repoInfo,
                user: userInfo
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 전역 GitHubAPI 인스턴스
window.githubAPI = new GitHubAPI();
