// Storage Key
const STORAGE_KEY = 'myMovieList';

// Status Options
const STATUS_OPTIONS = ['시청 고민', '관람 예정', '상영 중·예정', '시청 완료'];

// State
let movies = [];
let currentStatus = '시청 고민';
let editingMovieId = null;
let draggedElement = null;

// DOM Elements
const movieList = document.getElementById('movie-list');
const categoryButtons = document.querySelectorAll('.category-btn');
const addMovieBtn = document.getElementById('add-movie-btn');
const movieModal = document.getElementById('movie-modal');
const movieForm = document.getElementById('movie-form');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const modalTitle = document.getElementById('modal-title');
const movieIdInput = document.getElementById('movie-id');
const movieTitleInput = document.getElementById('movie-title');
const movieDateInput = document.getElementById('movie-date');
const movieWatchDateInput = document.getElementById('movie-watch-date');
const movieStatusSelect = document.getElementById('movie-status');
const watchDateGroup = document.getElementById('watch-date-group');
const statusGroup = document.getElementById('status-group');
const refreshApiBtn = document.getElementById('refresh-api-btn');
const noteBtn = document.getElementById('note-btn');
const timetableBtn = document.getElementById('timetable-btn');
const slateBtn = document.getElementById('slate-btn');
const noteModal = document.getElementById('note-modal');
const timetableModal = document.getElementById('timetable-modal');
const slateModal = document.getElementById('slate-modal');
const noteContent = document.getElementById('note-content');
const closeNoteModalBtn = document.getElementById('close-note-modal');
const closeTimetableModalBtn = document.getElementById('close-timetable-modal');
const closeSlateModalBtn = document.getElementById('close-slate-modal');
const timetableGrid = document.getElementById('timetable-grid');

const NOTE_STORAGE_KEY = 'myMovieListNote';
const TIMETABLE_STORAGE_KEY = 'myMovieListTimetable';

// KOBIS API Configuration
const KOBIS_API_KEY = 'a89be2e5909e14c0e4325b05d12eab06'; // 영화진흥위원회에서 발급받은 API 키를 입력하세요
const KOBIS_API_BASE_URL = 'https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMovies();
    loadNote();
    loadTimetable();
    setupEventListeners();
    renderMovies();
    renderTimetable();
    
    // 최초 접속 여부 확인 (LocalStorage에 '상영 중·예정' 영화가 없으면 최초 접속)
    const hasApiMovies = movies.some(m => m.status === '상영 중·예정' && m.apiMovieCd);
    if (!hasApiMovies) {
        console.log('최초 접속: API에서 영화 목록을 불러옵니다.');
        loadMoviesFromAPI(); // 최초 접속 시에만 API 호출
    } else {
        console.log('이미 저장된 영화 데이터가 있습니다. 새로고침 버튼을 눌러 업데이트하세요.');
    }
    
    // 초기 상태에서 notice 문구 설정을 위해 switchTab 호출
    switchTab(currentStatus);
});

// Event Listeners Setup
function setupEventListeners() {
    // Category buttons
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            switchTab(status);
        });
    });

    // Add movie button
    addMovieBtn.addEventListener('click', () => {
        openAddModal();
    });

    // Modal close buttons
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    movieModal.addEventListener('click', (e) => {
        if (e.target === movieModal) {
            closeModal();
        }
    });

    // Form submit
    movieForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveMovie();
    });

    // Icon buttons
    refreshApiBtn.addEventListener('click', () => refreshApiMovies());
    noteBtn.addEventListener('click', () => openNoteModal());
    timetableBtn.addEventListener('click', () => openTimetableModal());
    slateBtn.addEventListener('click', () => openSlateModal());

    // Note modal
    closeNoteModalBtn.addEventListener('click', closeNoteModal);
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            closeNoteModal();
        }
    });

    // Timetable modal
    closeTimetableModalBtn.addEventListener('click', closeTimetableModal);
    timetableModal.addEventListener('click', (e) => {
        if (e.target === timetableModal) {
            closeTimetableModal();
        }
    });

    // Slate modal
    closeSlateModalBtn.addEventListener('click', closeSlateModal);
    slateModal.addEventListener('click', (e) => {
        if (e.target === slateModal) {
            closeSlateModal();
        }
    });


    // Keyboard shortcuts (ESC to close modal)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (movieModal.classList.contains('active')) closeModal();
            if (noteModal.classList.contains('active')) closeNoteModal();
            if (timetableModal.classList.contains('active')) closeTimetableModal();
            if (slateModal.classList.contains('active')) closeSlateModal();
        }
    });
}

// Local Storage Functions
function loadMovies() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        movies = JSON.parse(stored);
    } else {
        movies = [];
    }
    
    // '상영 중·예정' 카테고리에서 장르 필터링 (기존 저장된 데이터 정리)
    const beforeCount = movies.length;
    movies = movies.filter(movie => {
        if (movie.status === '상영 중·예정') {
            const genreAlt = movie.genreAlt || '';
            // 성인물(에로) 장르가 포함된 영화 제거
            if (genreAlt.includes('성인물(에로)')) {
                return false;
            }
            // 멜로/로맨스만 단독으로 있는 영화 제거
            const genreArray = genreAlt.split(',').map(g => g.trim()).filter(g => g);
            const isOnlyMelodrama = genreArray.length === 1 && (genreArray[0] === '멜로/로맨스' || genreArray[0] === '로맨스');
            if (isOnlyMelodrama) {
                return false;
            }
        }
        return true;
    });
    
    if (beforeCount !== movies.length) {
        console.log(`기존 저장된 영화 중 ${beforeCount - movies.length}개의 필터링 대상 영화를 제거했습니다.`);
    }
    
    // Auto-delete: Remove movies older than release date + 21 days
    autoDeleteExpiredMovies();
    
    // Sort all movies by release date
    sortMovies();
    
    // Save updated list
    saveMovies();
}

function saveMovies() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movies));
}

// Auto-delete movies outside 3 weeks range (current date ± 21 days)
// '상영 중·예정' 카테고리는 제외하고, 다른 카테고리('시청 고민', '관람 예정', '시청 완료')만 삭제
function autoDeleteExpiredMovies() {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 시간 부분 제거하여 날짜만 비교
    
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(now.getDate() - 21);
    
    const threeWeeksLater = new Date(now);
    threeWeeksLater.setDate(now.getDate() + 21);
    
    const beforeCount = movies.length;
    
    movies = movies.filter(movie => {
        // '상영 중·예정' 카테고리는 자동 삭제 대상에서 제외
        if (movie.status === '상영 중·예정') {
            return true;
        }
        
        const releaseDate = new Date(movie.releaseDate);
        releaseDate.setHours(0, 0, 0, 0); // 시간 부분 제거
        
        // 다른 카테고리('시청 고민', '관람 예정', '시청 완료')는 현재 날짜 기준 앞뒤 3주 범위 내의 영화만 유지
        return releaseDate >= threeWeeksAgo && releaseDate <= threeWeeksLater;
    });
    
    const deletedCount = beforeCount - movies.length;
    if (deletedCount > 0) {
        console.log(`${deletedCount}개의 영화가 3주 범위를 벗어나 자동으로 삭제되었습니다. ('상영 중·예정' 제외)`);
    }
}

// Sort movies by release date (ascending)
function sortMovies() {
    movies.sort((a, b) => {
        const dateA = new Date(a.releaseDate);
        const dateB = new Date(b.releaseDate);
        return dateA - dateB;
    });
}

// Tab Management
function switchTab(status) {
    currentStatus = status;
    
    // Update active category button
    categoryButtons.forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 새로고침 버튼 및 안내 문구 표시/숨김 (상영 중·예정 카테고리에서만 보임)
    const refreshButtonContainer = document.getElementById('refresh-button-container');
    const noticeBox = document.getElementById('notice-box');
    
    // 현재 날짜를 YYYY년 MM월 DD일 형식으로 포맷
    const today = new Date();
    const formattedDate = today.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).replace(/\./g, '').trim();
    
    if (status === '상영 중·예정') {
        if (refreshButtonContainer) {
            refreshButtonContainer.style.display = 'flex';
        }
        if (noticeBox) {
            noticeBox.style.display = 'flex';
            const noticeText = document.getElementById('notice-text');
            if (noticeText) {
                noticeText.innerHTML = `${formattedDate} 기준 앞뒤 한 달 내 개봉한 영화만 표시됩니다.<br><br>
                    클린한 목록을 위해 음란물을 필터링하고 있습니다.<br>
                    이 과정에서 일부 멜로/로맨스 영화가 제외될 수 있습니다.<br>
                    표시되지 않는 영화는 수동 추가 기능을 이용해주세요.`;
            }
        }
    } else {
        if (refreshButtonContainer) {
            refreshButtonContainer.style.display = 'none';
        }
        if (noticeBox) {
            noticeBox.style.display = 'flex';
            const noticeText = document.getElementById('notice-text');
            if (noticeText) {
                noticeText.innerHTML = `${formattedDate} 기준 앞뒤 3주를 초과한 리스트는 삭제됩니다.`;
            }
        }
    }
    
    // Render movies for current category
    renderMovies();
}

// Sort Current Category
function sortCurrentCategory() {
    // Filter movies by current status
    const categoryMovies = movies.filter(movie => movie.status === currentStatus);
    
    if (categoryMovies.length === 0) {
        alert('정렬할 영화가 없습니다.');
        return;
    }
    
    // Sort by release date (already sorted globally, but re-sort for confirmation)
    sortMovies();
    saveMovies();
    renderMovies();
    
    // Visual feedback
    const btn = sortBtn;
    btn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        btn.style.transform = '';
    }, 500);
}

// Delete Current Category
function deleteCurrentCategory() {
    // '상영 중·예정' 카테고리는 삭제 불가
    if (currentStatus === '상영 중·예정') {
        alert('상영 중·예정 카테고리는 삭제할 수 없습니다.');
        return;
    }
    
    const categoryMovies = movies.filter(movie => movie.status === currentStatus);
    
    if (categoryMovies.length === 0) {
        alert('삭제할 영화가 없습니다.');
        return;
    }
    
    if (confirm(`"${currentStatus}" 카테고리의 모든 영화 ${categoryMovies.length}개를 삭제하시겠습니까?`)) {
        movies = movies.filter(movie => movie.status !== currentStatus);
        saveMovies();
        renderMovies();
    }
}

// Render Movies
function renderMovies() {
    // Filter movies by current status
    const filteredMovies = movies.filter(movie => movie.status === currentStatus);
    
    // Clear current list
    movieList.innerHTML = '';
    
    
    // Show empty state if no movies
    if (filteredMovies.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">
                <img src="popcorn.png" alt="Popcorn" />
            </div>
            <div class="empty-state-text">What's on your watchlist today?</div>
        `;
        movieList.appendChild(emptyState);
        return;
    }
    
    // Render movie cards
    filteredMovies.forEach(movie => {
        const card = createMovieCard(movie);
        movieList.appendChild(card);
    });
    
    // Setup drag and drop
    setupDragAndDrop();
}

// Create Movie Card
function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    // '상영 중·예정' 카테고리에서는 드래그 불가
    if (movie.status !== '상영 중·예정') {
        card.draggable = true;
    } else {
        card.draggable = false;
    }
    card.dataset.movieId = movie.id;
    
    // Format release date
    const releaseDate = new Date(movie.releaseDate);
    const formattedDate = releaseDate.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // '상영 중·예정' 카테고리에서는 수정/삭제 버튼 모두 비활성화
    const isProtectedCategory = movie.status === '상영 중·예정';
    
    // 상태 변경 버튼 생성 (현재 상태 제외)
    let statusButtons = '';
    if (!isProtectedCategory) {
        const availableStatuses = STATUS_OPTIONS.filter(s => s !== movie.status && s !== '상영 중·예정');
        if (availableStatuses.length > 0) {
                statusButtons = availableStatuses.slice(0, 2).map(status => {
                    const statusIcon = status === '시청 고민' ? 'bi-chat-dots-fill' : 
                                      status === '관람 예정' ? 'bi-basket-fill' : 
                                      status === '시청 완료' ? 'bi-check-square-fill' : '';
                    return `<button class="btn-icon btn-status-change" onclick="changeMovieStatus('${movie.id}', '${status}')" aria-label="${status}로 이동" title="${status}">
                        <i class="bi ${statusIcon}"></i>
                    </button>`;
                }).join('');
        }
    }
    
    const editButton = isProtectedCategory 
        ? '' 
        : `<button class="btn-icon btn-edit" onclick="editMovie('${movie.id}')" aria-label="수정">
            <i class="bi bi-pencil-fill"></i>
        </button>`;
    const deleteButton = isProtectedCategory 
        ? '' 
        : `<button class="btn-icon btn-delete" onclick="deleteMovie('${movie.id}')" aria-label="삭제">
            <i class="bi bi-trash-fill"></i>
        </button>`;
    
    // '상영 중·예정' 카테고리는 리스트 형식으로 표시
    if (movie.status === '상영 중·예정') {
        // 장르, 제작 국가, 개봉일 정보 준비
        const genreAlt = movie.genreAlt || '';
        const nationAlt = movie.nationAlt || movie.repNationNm || '';
        const directorName = movie.directorName || '';
        
        // 개봉일 형식 변경 (YYYY년 MM월 DD일)
        const releaseDateFormatted = releaseDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).replace(/\./g, '').trim();
        
        // 정보 조합 (장르 / 제작 국가 / 개봉일)
        const infoParts = [];
        if (genreAlt) infoParts.push(genreAlt);
        if (nationAlt) infoParts.push(nationAlt);
        if (releaseDateFormatted) infoParts.push(releaseDateFormatted);
        const infoText = infoParts.join('  |  ');
        
        card.className = 'movie-card movie-card-list';
        card.innerHTML = `
            <div class="movie-list-title">${escapeHtml(movie.title)}</div>
            <div class="movie-list-info">${escapeHtml(infoText)}</div>
        `;
        
        // 클릭 시 '시청 고민' 카테고리에 추가
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            moveToWatchStatus(movie.id);
        });
    } else {
        // 다른 카테고리는 기존 형식 유지
        const genreAlt = movie.genreAlt || '';
        const nationAlt = movie.nationAlt || movie.repNationNm || '';
        const nationDisplay = nationAlt ? ` (${escapeHtml(nationAlt)})` : '';
        
        // Format 관람 일자
        const watchDateDisplay = movie.watchDate 
            ? new Date(movie.watchDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).replace(/\./g, '').trim()
            : '미정';
        
        const watchDateHtml = `<span class="movie-watch-date">(관람 ${watchDateDisplay})</span>`;
        // 장르 또는 제작국 정보가 있으면 표시 (제작국 정보가 장르 뒤에 표시됨)
        const genreHtml = (genreAlt || nationAlt)
            ? `<span class="movie-genre">${escapeHtml(genreAlt)}${nationDisplay}</span>`
            : '';
        
        card.innerHTML = `
            <div class="movie-card-header">
                <div class="movie-title">${escapeHtml(movie.title)}</div>
                <div class="movie-card-actions">
                    ${statusButtons}
                    ${editButton}
                    ${deleteButton}
                </div>
            </div>
            <div class="movie-info-container">
                <div class="movie-date">${formattedDate}</div>
                ${watchDateHtml}
                ${genreHtml}
            </div>
        `;
    }
    
    return card;
}

// Change movie status
function changeMovieStatus(movieId, newStatus) {
    const movie = movies.find(m => m.id === movieId);
    if (!movie) return;
    
    if (movie.status !== '상영 중·예정' && newStatus !== '상영 중·예정') {
        movie.status = newStatus;
        sortMovies();
        saveMovies();
        renderMovies();
        
        // 자동 전환 기능 제거 - 사용자가 직접 확인할 수 있도록
    }
}

// Add movie to '시청 고민' status (copy, not move)
function moveToWatchStatus(movieId) {
    const movie = movies.find(m => m.id === movieId);
    if (!movie) return;
    
    // '상영 중·예정' 카테고리의 영화를 '시청 고민'에 추가 (복사)
    if (movie.status === '상영 중·예정') {
        // 새 영화 객체 생성 (원본은 그대로 유지)
        const newMovie = {
            id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: movie.title,
            releaseDate: movie.releaseDate,
            status: '시청 고민',
            genreAlt: movie.genreAlt || '',
            nationAlt: movie.nationAlt || '',
            repNationNm: movie.repNationNm || '',
            watchDate: null // 상영 중·예정에서 추가된 영화는 관람 일자 미정
        };
        
        // 기존 영화는 그대로 두고, 새 영화 추가
        movies.push(newMovie);
        
        sortMovies();
        saveMovies();
        renderMovies();
        
        // 자동 전환 기능 제거 - 사용자가 직접 확인할 수 있도록
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Modal Management
function openAddModal() {
    editingMovieId = null;
    modalTitle.textContent = '영화 추가';
    movieForm.reset();
    movieIdInput.value = '';
    movieWatchDateInput.value = ''; // 관람 일자 기본값: 빈 값 (미정)
    
    // 추가 모달에서는 상태 선택 표시
    if (statusGroup) {
        statusGroup.style.display = 'block';
    }
    
    // 관람 일자 필드 표시
    if (watchDateGroup) {
        watchDateGroup.style.display = 'block';
    }
    
    // '상영 중·예정' 옵션 제거
    removeStatusOption('상영 중·예정');
    
    movieModal.classList.add('active');
    movieTitleInput.focus();
}

function openEditModal(movieId) {
    const movie = movies.find(m => m.id === movieId);
    if (!movie) return;
    
    editingMovieId = movieId;
    modalTitle.textContent = '영화 수정';
    movieIdInput.value = movie.id;
    movieTitleInput.value = movie.title;
    movieDateInput.value = movie.releaseDate;
    movieWatchDateInput.value = movie.watchDate || '';
    
    // 수정 모달에서는 상태 변경 불가 - 상태 선택 드롭다운 숨기기
    if (statusGroup) {
        statusGroup.style.display = 'none';
    }
    
    // 관람 일자 필드 표시
    if (watchDateGroup) {
        watchDateGroup.style.display = 'block';
    }
    
    movieModal.classList.add('active');
    movieTitleInput.focus();
}

function removeStatusOption(statusToRemove) {
    const options = movieStatusSelect.querySelectorAll('option');
    options.forEach(option => {
        if (option.value === statusToRemove) {
            option.style.display = 'none';
        }
    });
}

function restoreStatusOption(statusToRestore) {
    const options = movieStatusSelect.querySelectorAll('option');
    options.forEach(option => {
        if (option.value === statusToRestore) {
            option.style.display = '';
        }
    });
}

function closeModal() {
    movieModal.classList.remove('active');
    editingMovieId = null;
    movieForm.reset();
    // 상태 선택 드롭다운 다시 활성화 및 옵션 복원
    if (statusGroup) {
        statusGroup.style.display = 'block';
    }
    movieStatusSelect.disabled = false;
    movieStatusSelect.style.opacity = '1';
    movieStatusSelect.title = '';
    restoreStatusOption('상영 중·예정');
}

// Save Movie (Create or Update)
function saveMovie() {
    const title = movieTitleInput.value.trim();
    const releaseDate = movieDateInput.value;
    const watchDate = movieWatchDateInput.value || null; // 빈 값이면 null (미정)
    const status = editingMovieId 
        ? movies.find(m => m.id === editingMovieId)?.status || movieStatusSelect.value 
        : movieStatusSelect.value;
    
    if (!title || !releaseDate || (!editingMovieId && !status)) {
        alert('모든 필수 필드를 입력해주세요.');
        return;
    }
    
    // 추가 모드에서 '상영 중·예정' 선택 불가
    if (!editingMovieId && status === '상영 중·예정') {
        alert('상영 중·예정 카테고리는 수동으로 설정할 수 없습니다. API에서만 자동으로 추가됩니다.');
        return;
    }

    if (editingMovieId) {
        // Update existing movie (제목과 개봉일만 수정 가능, 상태는 변경 불가)
        const movieIndex = movies.findIndex(m => m.id === editingMovieId);
        if (movieIndex !== -1) {
            movies[movieIndex].title = title;
            movies[movieIndex].releaseDate = releaseDate;
            movies[movieIndex].watchDate = watchDate;
            // 상태는 변경하지 않음 (카드의 버튼으로만 변경 가능)
        }
    } else {
        // Create new movie
        const newMovie = {
            id: Date.now().toString(),
            title: title,
            releaseDate: releaseDate,
            status: status,
            watchDate: watchDate // 관람 일자 추가 (null이면 미정)
        };
        movies.push(newMovie);
    }
    
    // Auto-delete movies outside 3 weeks range
    autoDeleteExpiredMovies();
    
    // Sort and save
    sortMovies();
    saveMovies();
    
    // Switch to the status tab if changed
    if (currentStatus !== status) {
        switchTab(status);
    } else {
        renderMovies();
    }
    
    closeModal();
}

// Edit Movie
function editMovie(movieId) {
    openEditModal(movieId);
}

// Delete Movie
function deleteMovie(movieId) {
    const movie = movies.find(m => m.id === movieId);
    // '상영 중·예정' 카테고리의 영화는 삭제 불가
    if (movie && movie.status === '상영 중·예정') {
        alert('상영 중·예정 카테고리의 영화는 삭제할 수 없습니다.');
        return;
    }
    
    if (confirm('이 영화를 삭제하시겠습니까?')) {
        movies = movies.filter(m => m.id !== movieId);
        saveMovies();
        renderMovies();
    }
}

// Drag and Drop Setup
function setupDragAndDrop() {
    const cards = document.querySelectorAll('.movie-card');
    
    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    // Make category buttons drop zones
    categoryButtons.forEach(categoryBtn => {
        categoryBtn.addEventListener('dragover', handleDragOver);
        categoryBtn.addEventListener('drop', handleDrop);
        categoryBtn.addEventListener('dragenter', handleDragEnter);
        categoryBtn.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Remove active class from all category buttons
    categoryButtons.forEach(btn => {
        btn.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement) {
        const movieId = draggedElement.dataset.movieId;
        const newStatus = this.dataset.status;
        
        // '상영 중·예정' 카테고리로 이동 불가
        if (newStatus === '상영 중·예정') {
            alert('상영 중·예정 카테고리로는 이동할 수 없습니다.');
            this.classList.remove('drag-over');
            return false;
        }
        
        // Update movie status
        const movie = movies.find(m => m.id === movieId);
        if (movie && movie.status !== newStatus) {
            // '상영 중·예정' 카테고리에서 나가는 것도 불가
            if (movie.status === '상영 중·예정') {
                alert('상영 중·예정 카테고리의 영화는 다른 카테고리로 이동할 수 없습니다.');
                this.classList.remove('drag-over');
                return false;
            }
            
            movie.status = newStatus;
            sortMovies();
            saveMovies();
            
            // Switch to the new tab if not already there
            if (currentStatus !== newStatus) {
                switchTab(newStatus);
            } else {
                renderMovies();
            }
        }
    }
    
    this.classList.remove('drag-over');
    return false;
}

// Make functions globally available for inline event handlers
window.editMovie = editMovie;
window.deleteMovie = deleteMovie;

// Note Modal Functions
function openNoteModal() {
    noteModal.classList.add('active');
    noteContent.focus();
}

function closeNoteModal() {
    noteModal.classList.remove('active');
}

function loadNote() {
    // 제작 동기 내용
    const noteText = `저는 영화 보는 걸 굉장히 좋아하는 학생입니다.
작년에는 약 200번, 올해 10월까지 약 120번 영화를 관람했습니다.
이 정도면 '영화'를 관심 주제로 삼기에 충분하다고 생각했고 개인적인 바람을 담아 이 페이지를 제작하게 됐습니다.

이 페이지는 흥미로워 보이는 영화가 개봉해서 가끔 보러 가거나, 한 달에 영화를 한두 편 볼까 말까 하는 사람들에겐 필요하지 않습니다.
반대로 개봉하는 영화들은 거의 모두 챙겨보는 영화 애호가, 일주일에 한 편 이상 영화를 보는 사람들에게 필요한 기능을 제공하는 사이트입니다.

저의 경우 특별한 사정이 없다면 매주 영화를 보러 가고, 하루에 최소 두 편의 영화를 봅니다.
한 주 영화를 못 보면 차주에 밀린 영화를 보기 위해 메모장에 관람 일정을 세우곤 합니다.
'앞으로 무슨 영화를, 언제?' 하나하나 직접 적으며 To-do list 처럼 영화 관람 일정을 관리할 수 있는 앱이 생기길 바란 적이 있습니다.
관람한 영화나 공연을 기록하는 앱은 이미 존재했지만 제가 바라는 앱은 수요가 없어 만들어지지 않겠지 하며 희망을 버렸었습니다.
그런데 이번 과제에서 직접 무언가 만들 수 있게 됐고, 저는 이 기회를 놓치지 않고 꿈에 그리던 페이지를 만들게 됐습니다.

재밌고 값진 경험을 할 수 있게 해주신 윤수연 교수님께 감사드립니다!`;
    
    const authorText = `국민대학교 기업융합법학과 25학번
이정유`;
    
    if (noteContent) {
        noteContent.value = noteText;
    }
    
    const noteAuthor = document.getElementById('note-author');
    if (noteAuthor) {
        noteAuthor.textContent = authorText;
    }
}


// Timetable Modal Functions
let timetableData = {};

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

function openTimetableModal() {
    timetableModal.classList.add('active');
    renderTimetable();
}

function closeTimetableModal() {
    timetableModal.classList.remove('active');
}

function loadTimetable() {
    const stored = localStorage.getItem(TIMETABLE_STORAGE_KEY);
    if (stored) {
        timetableData = JSON.parse(stored);
    } else {
        timetableData = {
            mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []
        };
    }
}

function saveTimetable() {
    localStorage.setItem(TIMETABLE_STORAGE_KEY, JSON.stringify(timetableData));
}

function renderTimetable() {
    timetableGrid.innerHTML = '';
    
    // Create empty top-left corner
    const corner = document.createElement('div');
    corner.className = 'timetable-day-header';
    corner.style.border = 'none';
    corner.style.background = 'transparent';
    timetableGrid.appendChild(corner);
    
    // Create hour headers (0-23)
    for (let hour = 0; hour < 24; hour++) {
        const hourHeader = document.createElement('div');
        hourHeader.className = 'timetable-hour-header';
        hourHeader.textContent = `${String(hour).padStart(2, '0')}`;
        timetableGrid.appendChild(hourHeader);
    }
    
    // Create day rows (7 days x 24 hours)
    DAYS.forEach((day, dayIndex) => {
        // Day header
        const dayHeader = document.createElement('div');
        dayHeader.className = 'timetable-day-header';
        dayHeader.textContent = DAY_NAMES[dayIndex];
        timetableGrid.appendChild(dayHeader);
        
        // 24 hour cells for this day
        for (let hour = 0; hour < 24; hour++) {
            const cell = document.createElement('div');
            cell.className = 'timetable-cell';
            cell.dataset.day = day;
            cell.dataset.hour = hour;
            
            // Check if this time slot is booked
            const daySlots = timetableData[day] || [];
            const slotData = daySlots.find(slot => slot.hour === hour);
            if (slotData) {
                cell.classList.add('booked');
                cell.textContent = slotData.title || '';
            }
            
            cell.addEventListener('click', () => toggleTimeSlot(day, hour));
            timetableGrid.appendChild(cell);
        }
    });
}

function toggleTimeSlot(day, hour) {
    if (!timetableData[day]) {
        timetableData[day] = [];
    }
    
    const existingIndex = timetableData[day].findIndex(slot => slot.hour === hour);
    
    if (existingIndex >= 0) {
        // Remove if already booked
        timetableData[day].splice(existingIndex, 1);
    } else {
        // Add new time slot
        const movieTitle = prompt(`${DAY_NAMES[DAYS.indexOf(day)]}요일 ${String(hour).padStart(2, '0')}:00에 볼 영화 제목을 입력하세요:`);
        if (movieTitle) {
            timetableData[day].push({
                hour: hour,
                title: movieTitle
            });
        }
    }
    
    saveTimetable();
    renderTimetable();
}

function addTimeSlot() {
    const dayInput = prompt('요일을 선택하세요 (월/화/수/목/금/토/일):');
    const dayIndex = DAY_NAMES.indexOf(dayInput);
    if (dayIndex === -1) {
        alert('올바른 요일을 입력해주세요.');
        return;
    }
    const day = DAYS[dayIndex];
    
    const hourInput = prompt('시간을 입력하세요 (0-23):');
    const hour = parseInt(hourInput);
    
    if (isNaN(hour) || hour < 0 || hour > 23) {
        alert('올바른 시간을 입력해주세요 (0-23)');
        return;
    }
    
    const movieTitle = prompt(`${DAY_NAMES[dayIndex]}요일 ${String(hour).padStart(2, '0')}:00에 볼 영화 제목을 입력하세요:`);
    if (!movieTitle) return;
    
    if (!timetableData[day]) {
        timetableData[day] = [];
    }
    
    const existingIndex = timetableData[day].findIndex(slot => slot.hour === hour);
    if (existingIndex >= 0) {
        timetableData[day][existingIndex].title = movieTitle;
    } else {
        timetableData[day].push({
            hour: hour,
            title: movieTitle
        });
    }
    
    saveTimetable();
    renderTimetable();
}

// Slate Modal Functions
function openSlateModal() {
    slateModal.classList.add('active');
}

function closeSlateModal() {
    slateModal.classList.remove('active');
}

// API 영화 목록 새로고침 함수
async function refreshApiMovies() {
    // '상영 중·예정' 카테고리의 기존 영화들 삭제
    const beforeCount = movies.filter(m => m.status === '상영 중·예정').length;
    movies = movies.filter(movie => movie.status !== '상영 중·예정');
    
    // 삭제된 영화 목록 저장
    saveMovies();
    
    console.log(`${beforeCount}개의 기존 영화를 삭제하고 새로운 영화를 불러옵니다...`);
    
    // API에서 새로운 영화 목록 불러오기
    await loadMoviesFromAPI();
    
    // '상영 중·예정' 카테고리로 전환
    if (currentStatus !== '상영 중·예정') {
        switchTab('상영 중·예정');
    } else {
        renderMovies();
    }
}

// KOBIS API: 영화목록 API에서 최근 영화 로드
async function loadMoviesFromAPI() {
    if (!KOBIS_API_KEY || KOBIS_API_KEY === 'YOUR_API_KEY') {
        console.warn('KOBIS API 키가 설정되지 않았습니다. 영화진흥위원회에서 API 키를 발급받아 설정하세요.');
        return;
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 시간 부분 제거하여 날짜만 비교
        
        // API 호출 범위: 현재 날짜 기준 2개월 전후 (60일)
        const twoMonthsAgo = new Date(today);
        twoMonthsAgo.setDate(today.getDate() - 60);
        
        const twoMonthsLater = new Date(today);
        twoMonthsLater.setDate(today.getDate() + 60);
        
        // 목록 표시 필터: 현재 날짜 기준 1달 전후 (30일)
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setDate(today.getDate() - 30);
        
        const oneMonthLater = new Date(today);
        oneMonthLater.setDate(today.getDate() + 30);
        
        // API 호출용 연도 범위 계산
        const startYear = twoMonthsAgo.getFullYear();
        const endYear = twoMonthsLater.getFullYear();

        // 기존에 추가된 영화 ID 추적 (중복 방지)
        const existingMovieIds = new Set(
            movies
                .filter(m => m.status === '상영 중·예정' && m.apiMovieCd)
                .map(m => m.apiMovieCd)
        );

        let addedCount = 0;
        const allMoviesMap = new Map(); // 중복 제거를 위한 Map (movieCd를 키로 사용)

        console.log('영화목록 API에서 영화 목록을 불러오는 중...');
        console.log(`API 호출 범위 (2개월): ${formatDateForBoxOffice(twoMonthsAgo)} ~ ${formatDateForBoxOffice(twoMonthsLater)}`);
        console.log(`목록 표시 범위 (1개월): ${formatDateForBoxOffice(oneMonthAgo)} ~ ${formatDateForBoxOffice(oneMonthLater)}`);
        
        // 음란한 단어 필터 목록 (제목에 포함되면 장르 불문하고 제외)
        const inappropriateKeywords = ['유부녀', '새엄마', '무삭제', '섹파', '섹스', 'sex', '성교육', '동정남', '동정녀', '에로', '음란', '19금', '성인', '야한', '아주버님', '흥건', '제수씨'];
        
        try {
            // 무한 스크롤 방식으로 모든 페이지 조회 (개수 제한 없음)
            let page = 1;
            let hasMoreData = true;
            
            while (hasMoreData) {
                // API 호출 - 6개월 전후 범위의 영화 조회
                const url = `${KOBIS_API_BASE_URL}?key=${KOBIS_API_KEY}&openStartDt=${startYear}&openEndDt=${endYear}&itemPerPage=10&curPage=${page}`;
                
                console.log(`API 호출 (페이지 ${page}): ${startYear}년 ~ ${endYear}년 영화 데이터 요청`);
                
                const response = await fetch(url, {
                    mode: 'cors'
                });
                if (!response.ok) {
                    console.warn(`영화목록 데이터 조회 실패 (페이지 ${page}): ${response.status}`);
                    break;
                }

                const data = await response.json();
                
                // 에러 확인
                if (data.faultInfo) {
                    console.error('API 에러:', data.faultInfo);
                    break;
                }
                
                if (!data.movieListResult || !data.movieListResult.movieList || data.movieListResult.movieList.length === 0) {
                    console.log(`페이지 ${page}: 더 이상 영화가 없습니다.`);
                    hasMoreData = false;
                    break;
                }
                
                const movieList = data.movieListResult.movieList;
                console.log(`페이지 ${page}: ${movieList.length}개 영화 발견`);
                
                movieList.forEach(movie => {
                    // 1. 제목 음란 단어 필터링 (장르 불문하고 최우선 체크)
                    const movieTitle = (movie.movieNm || '').toLowerCase();
                    const hasInappropriateKeyword = inappropriateKeywords.some(keyword => 
                        movieTitle.includes(keyword.toLowerCase())
                    );
                    if (hasInappropriateKeyword) {
                        return; // 조용히 건너뛰기 (로그 없음)
                    }
                    
                    // 2. 장르 필터링: '성인물(에로)'가 포함된 영화는 다른 장르와 함께 있어도 제외
                    const genreAlt = movie.genreAlt || '';
                    const repGenreNm = movie.repGenreNm || '';
                    
                    // genreAlt 또는 repGenreNm에 '성인물(에로)'가 포함되어 있으면 제외
                    if (genreAlt.includes('성인물(에로)') || repGenreNm.includes('성인물(에로)')) {
                        console.log(`성인물(에로) 장르 영화 제외: ${movie.movieNm} (genreAlt: ${genreAlt}, repGenreNm: ${repGenreNm})`);
                        return;
                    }
                    
                    // 3. 장르 필터링: '멜로/로맨스'만 단독으로 있는 경우 제외
                    // (다른 장르와 함께 있으면 포함 - 예: '코미디, 멜로/로맨스'는 포함)
                    const genreArray = genreAlt.split(',').map(g => g.trim()).filter(g => g);
                    const isOnlyMelodrama = genreArray.length === 1 && (genreArray[0] === '멜로/로맨스' || genreArray[0] === '로맨스');
                    if (isOnlyMelodrama) {
                        console.log(`멜로/로맨스 단독 영화 제외: ${movie.movieNm} (장르: ${genreAlt})`);
                        return;
                    }
                    
                    // 4. 중복 체크 - Map에 이미 추가된 영화인지 먼저 확인 (더 빠른 체크)
                    if (allMoviesMap.has(movie.movieCd)) {
                        return; // 조용히 건너뛰기 (로그 없음)
                    }
                    
                    // 5. 기존에 저장된 영화 ID 추적 (LocalStorage에서 이미 있는 영화)
                    if (existingMovieIds.has(movie.movieCd)) {
                        return; // 조용히 건너뛰기 (로그 없음)
                    }

                    // 6. 개봉일 처리
                    let releaseDate;
                    let releaseDateObj;
                    if (movie.openDt && movie.openDt.length === 8) {
                        releaseDate = formatDateFromAPI(movie.openDt);
                        releaseDateObj = new Date(releaseDate);
                        releaseDateObj.setHours(0, 0, 0, 0);
                    } else if (movie.openDt && movie.openDt.length === 4) {
                        // YYYY 형식만 있는 경우 01-01 추가
                        releaseDate = `${movie.openDt}-01-01`;
                        releaseDateObj = new Date(releaseDate);
                        releaseDateObj.setHours(0, 0, 0, 0);
                    } else {
                        // openDt가 없으면 건너뛰기 (개봉일이 없으면 필터링 불가)
                        return; // 조용히 건너뛰기
                    }
                    
                    // 7. API 호출 범위 체크 (2개월 전후)
                    if (releaseDateObj < twoMonthsAgo || releaseDateObj > twoMonthsLater) {
                        return; // 조용히 건너뛰기 (범위 밖)
                    }
                    
                    // 8. 목록 표시 필터링 (1개월 전후) - 이 범위 내의 영화만 추가
                    if (releaseDateObj < oneMonthAgo || releaseDateObj > oneMonthLater) {
                        return; // 조용히 건너뛰기 (표시 범위 밖)
                    }
                    
                    // 감독명 추출
                    let directorName = '';
                    if (movie.directors && movie.directors.length > 0) {
                        directorName = movie.directors[0].peopleNm || '';
                    }
                    
                    // 제작 국가 추출
                    const nationAlt = movie.nationAlt || '';
                    const repNationNm = movie.repNationNm || '';
                    
                    // Map에 추가 (제작 국가, 감독명도 저장)
                    allMoviesMap.set(movie.movieCd, {
                        id: `api_${movie.movieCd}_${Date.now()}`,
                        title: movie.movieNm || '제목 없음',
                        releaseDate: releaseDate,
                        status: '상영 중·예정',
                        apiMovieCd: movie.movieCd,
                        genreAlt: genreAlt,
                        nationAlt: nationAlt,
                        repNationNm: repNationNm,
                        directorName: directorName,
                        watchDate: null // API에서 추가된 영화는 관람 일자 미정
                    });
                    
                    console.log(`영화 추가됨: ${movie.movieNm} (개봉일: ${releaseDate}, 장르: ${genreAlt || 'N/A'})`);
                });
                
                // 다음 페이지로 이동
                page++;
                
                // API 응답에서 총 페이지 수 확인 (있는 경우)
                if (data.movieListResult && data.movieListResult.totCnt) {
                    const totalPages = Math.ceil(data.movieListResult.totCnt / 10);
                    if (page > totalPages) {
                        hasMoreData = false;
                    }
                }
            }
            
            console.log(`총 ${allMoviesMap.size}개의 영화를 수집했습니다.`);
        } catch (error) {
            console.error(`영화목록 데이터 처리 중 오류:`, error);
        }

        // 수집한 영화들을 배열에 추가
        allMoviesMap.forEach((movie, movieCd) => {
            movies.push(movie);
            existingMovieIds.add(movieCd);
            addedCount++;
        });

        console.log(`총 ${allMoviesMap.size}개의 고유 영화를 수집했습니다.`);

        if (addedCount > 0) {
            // 정렬 후 저장
            sortMovies();
            saveMovies();
            renderMovies();
            
            console.log(`${addedCount}개의 영화가 '상영 중·예정' 카테고리에 추가되었습니다.`);
        } else {
            console.warn('추가된 영화가 없습니다. API 응답을 확인해주세요.');
        }
    } catch (error) {
        console.error('영화 API 로드 중 오류 발생:', error);
        alert('영화 목록을 불러오는 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    }
}

// API 날짜 형식 변환: Date -> yyyyMMdd (박스오피스 API용)
function formatDateForBoxOffice(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// API 날짜 형식 변환: YYYYMMDD -> YYYY-MM-DD
function formatDateFromAPI(dateString) {
    if (dateString.length === 8) {
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return `${year}-${month}-${day}`;
    }
    return null;
}


