// 인증 관리 모듈

class AuthManager {
    constructor() {
        this.storage = safeLocalStorage();
        this.encryptionKey = 'morning-pages-2025';
        this.storageKeys = {
            token: 'mp_token',
            repoInfo: 'mp_repo',
            autoLogin: 'mp_auto_login'
        };
    }

    // 데이터 암호화
    encrypt(data) {
        try {
            return CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
        } catch (error) {
            console.error('Encryption failed:', error);
            return null;
        }
    }

    // 데이터 복호화
    decrypt(encryptedData) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
            const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
            return JSON.parse(decryptedData);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    // 로그인 정보 저장
    saveCredentials(token, repoInfo, rememberMe = false) {
        try {
            // 토큰 암호화하여 저장
            const encryptedToken = this.encrypt(token);
            if (encryptedToken) {
                this.storage.setItem(this.storageKeys.token, encryptedToken);
            }

            // Repository 정보 저장
            const encryptedRepo = this.encrypt(repoInfo);
            if (encryptedRepo) {
                this.storage.setItem(this.storageKeys.repoInfo, encryptedRepo);
            }

            // 자동 로그인 설정
            if (rememberMe) {
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + 30); // 30일 후 만료
                this.storage.setItem(this.storageKeys.autoLogin, expiry.getTime().toString());
            }

            return true;
        } catch (error) {
            console.error('Failed to save credentials:', error);
            return false;
        }
    }

    // 저장된 토큰 가져오기
    getToken() {
        try {
            const encryptedToken = this.storage.getItem(this.storageKeys.token);
            if (!encryptedToken) return null;

            return this.decrypt(encryptedToken);
        } catch (error) {
            console.error('Failed to get token:', error);
            return null;
        }
    }

    // 저장된 Repository 정보 가져오기
    getRepoInfo() {
        try {
            const encryptedRepo = this.storage.getItem(this.storageKeys.repoInfo);
            if (!encryptedRepo) return null;

            return this.decrypt(encryptedRepo);
        } catch (error) {
            console.error('Failed to get repo info:', error);
            return null;
        }
    }

    // 자동 로그인 가능 여부 확인
    canAutoLogin() {
        try {
            const autoLoginExpiry = this.storage.getItem(this.storageKeys.autoLogin);
            if (!autoLoginExpiry) return false;

            const expiryTime = parseInt(autoLoginExpiry);
            const now = new Date().getTime();

            return now < expiryTime;
        } catch (error) {
            console.error('Failed to check auto login:', error);
            return false;
        }
    }

    // GitHub API를 통한 토큰 검증
    async validateToken(token, repoInfo) {
        try {
            const response = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                return {
                    valid: true,
                    repoData: data
                };
            } else if (response.status === 401) {
                return {
                    valid: false,
                    error: '토큰이 유효하지 않습니다.'
                };
            } else if (response.status === 404) {
                return {
                    valid: false,
                    error: 'Repository를 찾을 수 없거나 접근 권한이 없습니다.'
                };
            } else {
                return {
                    valid: false,
                    error: `API 오류: ${response.status}`
                };
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            return {
                valid: false,
                error: '네트워크 오류가 발생했습니다.'
            };
        }
    }

    // 로그인 처리
    async login(repoUrl, token, rememberMe = false) {
        try {
            // Repository URL 파싱
            const repoInfo = parseRepoUrl(repoUrl);
            if (!repoInfo) {
                throw new Error('올바른 GitHub Repository URL을 입력해주세요.');
            }

            // 토큰 검증
            const validation = await this.validateToken(token, repoInfo);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // 로그인 정보 저장
            const saved = this.saveCredentials(token, repoInfo, rememberMe);
            if (!saved) {
                throw new Error('로그인 정보 저장에 실패했습니다.');
            }

            return {
                success: true,
                repoData: validation.repoData
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 자동 로그인 시도
    async tryAutoLogin() {
        try {
            if (!this.canAutoLogin()) {
                return { success: false, error: '자동 로그인 기간이 만료되었습니다.' };
            }

            const token = this.getToken();
            const repoInfo = this.getRepoInfo();

            if (!token || !repoInfo) {
                return { success: false, error: '저장된 로그인 정보가 없습니다.' };
            }

            // 토큰 재검증
            const validation = await this.validateToken(token, repoInfo);
            if (!validation.valid) {
                // 토큰이 무효하면 저장된 정보 삭제
                this.logout();
                return { success: false, error: validation.error };
            }

            return {
                success: true,
                token,
                repoInfo,
                repoData: validation.repoData
            };
        } catch (error) {
            console.error('Auto login failed:', error);
            return { success: false, error: error.message };
        }
    }

    // 로그아웃
    logout() {
        try {
            this.storage.removeItem(this.storageKeys.token);
            this.storage.removeItem(this.storageKeys.repoInfo);
            this.storage.removeItem(this.storageKeys.autoLogin);
            return true;
        } catch (error) {
            console.error('Logout failed:', error);
            return false;
        }
    }

    // 현재 로그인 상태 확인
    isLoggedIn() {
        const token = this.getToken();
        const repoInfo = this.getRepoInfo();
        return !!(token && repoInfo);
    }

    // 사용자 정보 가져오기
    async getUserInfo() {
        try {
            const token = this.getToken();
            if (!token) return null;

            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Failed to get user info:', error);
            return null;
        }
    }
}

// 전역 AuthManager 인스턴스
window.authManager = new AuthManager();
