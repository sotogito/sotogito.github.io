// 유틸리티 함수들

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 현재 시간 가져오기
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 시간대별 색상 클래스 반환
function getTimeColorClass(hour) {
    if (hour <= 10) return 'morning';     // 10시까지 - 초록
    if (hour <= 14) return 'afternoon';   // 14시까지 - 오렌지
    return 'evening';                     // 23:59까지 - 빨강
}

// 글자수 카운트 (공백 제외)
function countCharacters(text) {
    return text.replace(/\s/g, '').length;
}

// Repository URL에서 owner와 repo 추출
function parseRepoUrl(url) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return null;
    
    return {
        owner: match[1],
        repo: match[2].replace('.git', '')
    };
}

// 로딩 상태 표시
function showLoading(element, text = '로딩 중...') {
    element.disabled = true;
    element.textContent = text;
}

// 로딩 상태 해제
function hideLoading(element, originalText) {
    element.disabled = false;
    element.textContent = originalText;
}

// 에러 메시지 표시
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // "Good night 🌝" 메시지인 경우 검정색으로 표시
    const isGoodNight = message === 'Good night 🌝';
    
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: ${isGoodNight ? '#000' : '#ff4444'};
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 1500;
        pointer-events: none;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 300);
    }, 3000);
}

// 성공 메시지 표시
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #000;
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 1500;
        pointer-events: none;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 300);
    }, 2000);
}

// 애니메이션 CSS 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 디바운스 함수
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 모바일 기기 감지
function isMobile() {
    return window.innerWidth <= 768;
}

// 로컬 스토리지 안전 사용
function safeLocalStorage() {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return localStorage;
    } catch (e) {
        // localStorage가 사용 불가능한 경우 메모리 기반 폴백
        const storage = {};
        return {
            getItem: (key) => storage[key] || null,
            setItem: (key, value) => storage[key] = value,
            removeItem: (key) => delete storage[key],
            clear: () => Object.keys(storage).forEach(key => delete storage[key])
        };
    }
}
