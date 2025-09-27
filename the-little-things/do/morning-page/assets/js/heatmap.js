// 히트맵 관리 모듈 (GitHub 잔디 스타일)

class HeatmapManager {
    constructor() {
        this.heatmapContainer = null;
        this.commitData = {};
        this.currentYear = new Date().getFullYear();
        
        this.init();
    }

    // 히트맵 초기화
    init() {
        this.heatmapContainer = document.getElementById('heatmap');
        if (this.heatmapContainer) {
            this.loadCommitData();
        }
        
        // 파일 저장 시 히트맵 업데이트
        this.bindFileSaveEvent();
    }

    // 파일 저장 이벤트 바인딩
    bindFileSaveEvent() {
        // 전역 이벤트 리스너로 파일 저장 감지
        document.addEventListener('fileSaved', (event) => {
            this.refreshHeatmap();
        });
    }

    // 히트맵 새로고침
    async refreshHeatmap() {
        try {
            await this.loadCommitData();
        } catch (error) {
            console.error('Failed to refresh heatmap:', error);
        }
    }

    // 커밋 데이터 로드
    async loadCommitData(year = null) {
        try {
            const targetYear = year || this.currentYear;
            
            if (!window.githubAPI) {
                throw new Error('GitHub API가 초기화되지 않았습니다.');
            }

            this.commitData = await window.githubAPI.getYearlyCommitData(targetYear);
            this.renderHeatmap(targetYear);
            
        } catch (error) {
            console.error('Failed to load commit data:', error);
            this.renderEmptyHeatmap();
        }
    }

    // 히트맵 렌더링
    renderHeatmap(year) {
        if (!this.heatmapContainer) return;
        
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        
        // 연도 헤더
        const yearHeader = document.createElement('div');
        yearHeader.className = 'heatmap-year-header';
        yearHeader.innerHTML = `
            <h4>${year}년 작성 현황</h4>
            <div class="heatmap-legend">
                <span>적음</span>
                <div class="legend-colors">
                    <div class="legend-color" style="background-color: #ebedf0;"></div>
                    <div class="legend-color" style="background-color: #4caf50;"></div>
                    <div class="legend-color" style="background-color: #ffc107;"></div>
                    <div class="legend-color" style="background-color: #ff9800;"></div>
                </div>
                <span>많음</span>
            </div>
        `;
        
        // 히트맵 그리드 생성
        const heatmapGrid = document.createElement('div');
        heatmapGrid.className = 'heatmap-grid';
        
        // 월 라벨
        const monthLabels = document.createElement('div');
        monthLabels.className = 'heatmap-months';
        const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        months.forEach(month => {
            const label = document.createElement('span');
            label.className = 'month-label';
            label.textContent = month;
            monthLabels.appendChild(label);
        });
        
        // 요일 라벨
        const dayLabels = document.createElement('div');
        dayLabels.className = 'heatmap-days';
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        days.forEach(day => {
            const label = document.createElement('span');
            label.className = 'day-label';
            label.textContent = day;
            dayLabels.appendChild(label);
        });
        
        // 히트맵 셀들
        const heatmapCells = document.createElement('div');
        heatmapCells.className = 'heatmap-cells';
        
        // 첫 번째 날의 요일 계산 (일요일부터 시작)
        const firstDayOfYear = startDate.getDay();
        
        // 빈 셀들 (첫 주의 빈 칸)
        for (let i = 0; i < firstDayOfYear; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'heatmap-cell empty';
            heatmapCells.appendChild(emptyCell);
        }
        
        // 날짜별 셀 생성
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateString = formatDate(currentDate);
            const commitInfo = this.commitData[dateString];
            
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.dataset.date = dateString;
            
            if (commitInfo) {
                const colorClass = getTimeColorClass(commitInfo.hour);
                cell.classList.add(colorClass);
                cell.dataset.count = commitInfo.count;
                cell.dataset.hour = commitInfo.hour;
            }
            
            // 툴팁 정보
            cell.title = this.generateTooltip(dateString, commitInfo);
            
            // 클릭 이벤트
            cell.addEventListener('click', () => {
                this.handleCellClick(dateString, commitInfo);
            });
            
            heatmapCells.appendChild(cell);
            
            // 다음 날로 이동
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // 히트맵 컨테이너 업데이트
        this.heatmapContainer.innerHTML = '';
        this.heatmapContainer.appendChild(yearHeader);
        
        const heatmapWrapper = document.createElement('div');
        heatmapWrapper.className = 'heatmap-wrapper';
        heatmapWrapper.appendChild(monthLabels);
        
        const heatmapContent = document.createElement('div');
        heatmapContent.className = 'heatmap-content';
        heatmapContent.appendChild(dayLabels);
        heatmapContent.appendChild(heatmapCells);
        
        heatmapWrapper.appendChild(heatmapContent);
        this.heatmapContainer.appendChild(heatmapWrapper);
        
        // 통계 정보 추가
        this.renderStats();
    }

    // 빈 히트맵 렌더링
    renderEmptyHeatmap() {
        if (!this.heatmapContainer) return;
        
        this.heatmapContainer.innerHTML = `
            <div class="heatmap-empty">
                <p>작성 현황을 불러올 수 없습니다.</p>
            </div>
        `;
    }

    // 툴팁 생성
    generateTooltip(dateString, commitInfo) {
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        };
        const formattedDate = date.toLocaleDateString('ko-KR', options);
        
        if (commitInfo) {
            const timeStr = `${commitInfo.hour}:00`;
            const timeDesc = this.getTimeDescription(commitInfo.hour);
            return `${formattedDate}\n${commitInfo.count}개 작성 (${timeStr} - ${timeDesc})`;
        } else {
            return `${formattedDate}\n작성한 글이 없습니다`;
        }
    }

    // 시간대 설명
    getTimeDescription(hour) {
        if (hour < 10) return '이른 아침';
        if (hour < 14) return '오전/점심';
        return '오후/저녁';
    }

    // 셀 클릭 처리
    handleCellClick(dateString, commitInfo) {
        if (commitInfo) {
            // 해당 날짜의 파일 열기
            const fileName = `${dateString}.md`;
            if (window.fileManager) {
                window.fileManager.openFile(fileName);
            }
        } else {
            // 새 파일 생성 (과거 날짜는 불가)
            const today = formatDate(new Date());
            if (dateString === today) {
                if (window.fileManager) {
                    window.fileManager.createNewFile(`${dateString}.md`);
                }
            }
        }
    }

    // 통계 렌더링
    renderStats() {
        const stats = this.calculateStats();
        
        const statsContainer = document.createElement('div');
        statsContainer.className = 'heatmap-stats';
        statsContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">${stats.totalDays}</span>
                <span class="stat-label">총 작성일</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${stats.currentStreak}</span>
                <span class="stat-label">연속 작성일</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${stats.thisMonth}</span>
                <span class="stat-label">이번 달</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${stats.bestStreak}</span>
                <span class="stat-label">최장 연속</span>
            </div>
        `;
        
        this.heatmapContainer.appendChild(statsContainer);
    }

    // 통계 계산
    calculateStats() {
        const commitDates = Object.keys(this.commitData)
            .map(date => new Date(date))
            .sort((a, b) => a - b);
        
        const totalDays = commitDates.length;
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        
        const thisMonthCount = commitDates.filter(date => 
            date.getMonth() === thisMonth && date.getFullYear() === thisYear
        ).length;
        
        // 현재 연속 작성일 계산
        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateString = formatDate(checkDate);
            
            if (this.commitData[dateString]) {
                currentStreak = i + 1;
            } else {
                break;
            }
        }
        
        // 최장 연속 작성일 계산
        let bestStreak = 0;
        let tempStreak = 0;
        let prevDate = null;
        
        commitDates.forEach(date => {
            if (prevDate) {
                const diffDays = (date - prevDate) / (1000 * 60 * 60 * 24);
                if (diffDays === 1) {
                    tempStreak++;
                } else {
                    bestStreak = Math.max(bestStreak, tempStreak);
                    tempStreak = 1;
                }
            } else {
                tempStreak = 1;
            }
            prevDate = date;
        });
        bestStreak = Math.max(bestStreak, tempStreak);
        
        return {
            totalDays,
            currentStreak,
            thisMonth: thisMonthCount,
            bestStreak
        };
    }

    // 히트맵 업데이트
    async updateHeatmap() {
        await this.loadCommitData(this.currentYear);
    }

    // 연도 변경
    async changeYear(year) {
        this.currentYear = year;
        await this.loadCommitData(year);
    }
}

// 히트맵 스타일 추가
const heatmapStyle = document.createElement('style');
heatmapStyle.textContent = `
    .heatmap-year-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e1e1e1;
    }
    
    .heatmap-year-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: #333;
    }
    
    .heatmap-legend {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #666;
    }
    
    .legend-colors {
        display: flex;
        gap: 2px;
    }
    
    .legend-color {
        width: 10px;
        height: 10px;
        border-radius: 2px;
    }
    
    .heatmap-wrapper {
        overflow-x: auto;
        padding-bottom: 8px;
    }
    
    .heatmap-months {
        display: flex;
        gap: 14px;
        margin-bottom: 8px;
        padding-left: 24px;
    }
    
    .month-label {
        font-size: 11px;
        color: #666;
        width: 24px;
        text-align: center;
    }
    
    .heatmap-content {
        display: flex;
        gap: 4px;
    }
    
    .heatmap-days {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding-top: 2px;
    }
    
    .day-label {
        font-size: 11px;
        color: #666;
        width: 16px;
        height: 11px;
        text-align: center;
        line-height: 11px;
    }
    
    .heatmap-cells {
        display: grid;
        grid-template-columns: repeat(53, 11px);
        grid-template-rows: repeat(7, 11px);
        gap: 3px;
        grid-auto-flow: column;
    }
    
    .heatmap-cell {
        width: 11px;
        height: 11px;
        border-radius: 2px;
        background-color: #ebedf0;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .heatmap-cell:hover {
        transform: scale(1.2);
        z-index: 10;
        position: relative;
    }
    
    .heatmap-cell.empty {
        cursor: default;
    }
    
    .heatmap-cell.empty:hover {
        transform: none;
    }
    
    .heatmap-cell.morning {
        background-color: #4caf50;
    }
    
    .heatmap-cell.afternoon {
        background-color: #ffc107;
    }
    
    .heatmap-cell.evening {
        background-color: #ff9800;
    }
    
    .heatmap-stats {
        display: flex;
        justify-content: space-around;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #e1e1e1;
    }
    
    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }
    
    .stat-number {
        font-size: 18px;
        font-weight: 600;
        color: #333;
    }
    
    .stat-label {
        font-size: 12px;
        color: #666;
    }
    
    .heatmap-empty {
        text-align: center;
        padding: 40px 20px;
        color: #666;
        font-style: italic;
    }
    
    @media (max-width: 768px) {
        .heatmap-wrapper {
            overflow-x: scroll;
        }
        
        .heatmap-stats {
            flex-wrap: wrap;
            gap: 16px;
        }
        
        .stat-item {
            flex: 1;
            min-width: 80px;
        }
    }
`;
document.head.appendChild(heatmapStyle);

// 전역 HeatmapManager 인스턴스
window.heatmapManager = new HeatmapManager();
