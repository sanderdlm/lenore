/**
 * Bankan - Climbing Problem Tracker
 * ES Module with Class-based architecture
 */

// Constants
const DOUBLE_TAP_THRESHOLD_MS = 300;
const SW_UPDATE_INTERVAL_MS = 60000;
const TIMER_TICK_MS = 100;
const STORAGE_KEY = 'bankan_sessions';

const HOLD_COLORS = {
    green: '#52C47B',
    yellow: '#FFD93D',
    orange: '#FF8A5C',
    blue: '#4A90E2',
    red: '#FF6B6B',
    black: '#2C2C2E',
    white: '#FFFFFF',
    purple: '#9B7FD8',
    teal: '#4ECDC4',
    pink: '#FF85A2'
};

const GRADE_COLORS = {
    green: '#52C47B',
    yellow: '#FFD93D',
    orange: '#FF8A5C',
    blue: '#4A90E2',
    red: '#FF6B6B',
    black: '#2C2C2E',
    white: '#FFFFFF',
    purple: '#9B7FD8'
};

/**
 * Utility functions
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isValidColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function formatSessionDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    if (sessionDate.getTime() === today.getTime()) {
        return `Today ${timeStr}`;
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (sessionDate.getTime() === yesterday.getTime()) {
        return `Yesterday ${timeStr}`;
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Timer class - handles countdown timer functionality
 */
class Timer {
    #interval = null;
    #endTime = null;
    #lastTap = 0;
    #display;
    #onComplete;

    constructor(displayElement, onComplete) {
        this.#display = displayElement;
        this.#onComplete = onComplete;
    }

    start(minutes) {
        this.clear();
        this.#endTime = Date.now() + (minutes * 60 * 1000);
        this.#updateDisplay();

        this.#interval = setInterval(() => {
            const remaining = this.#endTime - Date.now();

            if (remaining <= 0) {
                this.clear();
                this.#display.textContent = '00:00';
                this.#onComplete?.();
            } else {
                this.#updateDisplay();
            }
        }, TIMER_TICK_MS);
    }

    handleTap() {
        const now = Date.now();
        if (now - this.#lastTap < DOUBLE_TAP_THRESHOLD_MS) {
            this.clear();
        }
        this.#lastTap = now;
    }

    clear() {
        if (this.#interval) {
            clearInterval(this.#interval);
        }
        this.#interval = null;
        this.#endTime = null;
        this.#display.textContent = '--:--';
    }

    #updateDisplay() {
        if (!this.#endTime) {
            this.#display.textContent = '--:--';
            return;
        }

        const remaining = Math.max(0, this.#endTime - Date.now());
        const totalSeconds = Math.ceil(remaining / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        this.#display.textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    destroy() {
        this.clear();
    }
}

/**
 * SessionsStore class - handles sessions data persistence
 */
class SessionsStore {
    #sessions = [];

    constructor() {
        this.#load();
    }

    #load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    this.#sessions = parsed.filter(s =>
                        s && typeof s.id === 'number' &&
                        typeof s.createdAt === 'number' &&
                        Array.isArray(s.problems)
                    );
                }
            }
        } catch (e) {
            console.error('Failed to load sessions:', e);
            this.#sessions = [];
        }
    }

    #save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#sessions));
        } catch (e) {
            console.error('Failed to save sessions:', e);
        }
    }

    getAll() {
        return this.#sessions.sort((a, b) => b.createdAt - a.createdAt);
    }

    getById(id) {
        return this.#sessions.find(s => s.id === id);
    }

    create() {
        const timestamp = Date.now();
        const session = {
            id: timestamp,
            createdAt: timestamp,
            problems: []
        };
        this.#sessions.push(session);
        this.#save();
        return session;
    }

    deleteById(id) {
        this.#sessions = this.#sessions.filter(s => s.id !== id);
        this.#save();
    }

    addProblem(sessionId, holdColor, gradeColor) {
        const session = this.getById(sessionId);
        if (!session) return null;

        const problem = {
            id: Date.now(),
            holdColor,
            gradeColor,
            attempts: Array.from({ length: 5 }, () => ({ checked: false, review: '' }))
        };

        session.problems.push(problem);
        this.#save();
        return problem;
    }

    updateAttempt(sessionId, problemId, attemptIndex, updates) {
        const session = this.getById(sessionId);
        if (!session) return false;

        const problem = session.problems.find(p => p.id === problemId);
        if (problem && problem.attempts[attemptIndex]) {
            Object.assign(problem.attempts[attemptIndex], updates);
            this.#save();
            return true;
        }
        return false;
    }

    get length() {
        return this.#sessions.length;
    }
}

/**
 * ColorPalette class - handles color selection UI
 */
class ColorPalette {
    #element;
    #colors;
    #selected;
    #onChange;

    constructor(element, colors, defaultColor, onChange) {
        this.#element = element;
        this.#colors = colors;
        this.#selected = defaultColor;
        this.#onChange = onChange;

        this.#render();
        this.#bindEvents();
    }

    #render() {
        this.#element.innerHTML = Object.entries(this.#colors).map(([name, color]) =>
            `<div class="color-option ${name === this.#selected ? 'selected' : ''}" 
                  style="background: ${color}; ${color === '#FFFFFF' ? 'border: 1px solid #ddd;' : ''}" 
                  data-color="${name}"></div>`
        ).join('');
    }

    #bindEvents() {
        const handleSelect = (e) => {
            const target = e.target.closest('.color-option');
            if (!target) return;

            this.#selected = target.dataset.color;
            this.#render();
            this.#onChange?.(this.#selected);
        };

        this.#element.addEventListener('click', handleSelect);
        this.#element.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleSelect(e);
        });
    }

    get selected() {
        return this.#selected;
    }

    getSelectedColor() {
        return this.#colors[this.#selected];
    }
}

/**
 * Main BankanApp class
 */
export class BankanApp {
    #sessionsStore;
    #currentSessionId = null;
    #timer;
    #holdPalette;
    #gradePalette;
    #elements;
    #currentReview = { problemId: null, attemptIndex: null };
    #currentScreen = 'sessions'; // 'sessions' or 'tracker'

    constructor() {
        this.#elements = {
            app: document.getElementById('app'),
            // Screens
            sessionsScreen: null,
            trackerScreen: null
        };

        this.#sessionsStore = new SessionsStore();

        this.#timer = new Timer(document.createElement('div'), () => {
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
        });

        this.#bindGlobalEvents();
        this.#showSessionsList();
        this.#registerServiceWorker();
    }

    #bindGlobalEvents() {
        const app = this.#elements.app;
        
        let touchStartY = 0;
        let isScrolling = false;
        
        // Track touch start for scroll detection
        app.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            isScrolling = false;
        }, { passive: true });
        
        // Detect if user is scrolling
        app.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            if (Math.abs(touchY - touchStartY) > 10) {
                isScrolling = true;
            }
        }, { passive: true });
        
        // Single delegated event handler for all clicks
        const handleClick = (e) => {
            // New session button
            if (e.target.closest('#newSessionBtn')) {
                const session = this.#sessionsStore.create();
                this.#showProblemTracker(session.id);
                return;
            }
            
            // Delete session button
            const deleteBtn = e.target.closest('.session-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const sessionId = parseInt(deleteBtn.dataset.sessionId, 10);
                if (confirm('Delete this session?')) {
                    this.#sessionsStore.deleteById(sessionId);
                    this.#showSessionsList();
                }
                return;
            }
            
            // Session card click (open session)
            const sessionCard = e.target.closest('.session-card');
            if (sessionCard && this.#currentScreen === 'sessions' && !isScrolling) {
                const sessionId = parseInt(sessionCard.dataset.sessionId, 10);
                this.#showProblemTracker(sessionId);
                return;
            }
            
            // Back button
            if (e.target.closest('#backBtn')) {
                this.#showSessionsList();
                return;
            }
            
            // Add problem button
            if (e.target.closest('#addProblemBtn')) {
                this.#sessionsStore.addProblem(
                    this.#currentSessionId,
                    this.#holdPalette.getSelectedColor(),
                    this.#gradePalette.getSelectedColor()
                );
                this.#renderProblems();
                this.#updateFormState();
                return;
            }
            
            // Timer controls
            const timerBtn = e.target.closest('.timer-btn');
            if (timerBtn) {
                const minutes = parseInt(timerBtn.dataset.minutes, 10);
                this.#timer.start(minutes);
                return;
            }
            
            // Timer display (double-tap to clear)
            if (e.target.closest('#timerDisplay')) {
                this.#timer.handleTap();
                return;
            }
            
            // Attempt button
            const attemptBtn = e.target.closest('.attempt-btn');
            if (attemptBtn) {
                const card = attemptBtn.closest('.problem-card');
                const problemId = parseInt(card.dataset.problemId, 10);
                const attemptIndex = parseInt(attemptBtn.dataset.attemptIndex, 10);
                this.#toggleAttempt(problemId, attemptIndex);
                return;
            }
        };
        
        const handleTouch = (e) => {
            const target = e.target;
            
            if (target.closest('#newSessionBtn') || 
                target.closest('.session-delete-btn') ||
                target.closest('.session-card') ||
                target.closest('#backBtn') ||
                target.closest('#addProblemBtn') ||
                target.closest('.timer-btn') ||
                target.closest('#timerDisplay') ||
                target.closest('.attempt-btn')) {
                e.preventDefault();
                handleClick(e);
            }
        };
        
        app.addEventListener('click', handleClick);
        app.addEventListener('touchend', handleTouch);
        
        // Review input events
        app.addEventListener('blur', (e) => {
            if (e.target.classList.contains('review-input')) {
                const problemId = parseInt(e.target.dataset.problemId, 10);
                const attemptIndex = parseInt(e.target.dataset.attemptIndex, 10);
                this.#saveReview(problemId, attemptIndex, e.target.value);
            }
        }, true);
        
        app.addEventListener('keypress', (e) => {
            if (e.target.classList.contains('review-input') && e.key === 'Enter') {
                const problemId = parseInt(e.target.dataset.problemId, 10);
                const attemptIndex = parseInt(e.target.dataset.attemptIndex, 10);
                this.#saveReview(problemId, attemptIndex, e.target.value);
            }
        });
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.#timer.destroy();
        });
    }

    // ==================== SCREEN NAVIGATION ====================
    
    #showSessionsList() {
        this.#currentScreen = 'sessions';
        this.#currentSessionId = null;
        
        const sessions = this.#sessionsStore.getAll();
        
        this.#elements.app.innerHTML = `
            <div class="sessions-screen">
                <header class="sessions-header">
                    <h1>Sessions</h1>
                    <button class="btn-primary new-session-btn" id="newSessionBtn">New Session</button>
                </header>
                
                <main class="sessions-list">
                    ${sessions.length === 0 ? 
                        '<div class="empty-state">No sessions yet. Start a new one! 🧗</div>' :
                        sessions.map(session => `
                            <div class="session-card" data-session-id="${session.id}">
                                <div class="session-info">
                                    <div class="session-date">${formatSessionDate(session.createdAt)}</div>
                                    <div class="session-meta">${session.problems.length} problem${session.problems.length !== 1 ? 's' : ''}</div>
                                </div>
                                <button class="session-delete-btn" data-session-id="${session.id}">×</button>
                            </div>
                        `).join('')
                    }
                </main>
            </div>
        `;
    }
    
    #showProblemTracker(sessionId) {
        this.#currentScreen = 'tracker';
        this.#currentSessionId = sessionId;
        
        const session = this.#sessionsStore.getById(sessionId);
        if (!session) {
            this.#showSessionsList();
            return;
        }
        
        this.#elements.app.innerHTML = `
            <div class="tracker-screen">
                <header>
                    <div class="tracker-header">
                        <button class="back-btn" id="backBtn">← Back</button>
                        <details class="problem-form-inline" id="problemForm">
                            <summary>Add problem</summary>
                            
                            <div class="form-content">
                                <div class="form-group">
                                    <label>Hold color</label>
                                    <div class="color-palette" id="holdColorPalette"></div>
                                </div>

                                <div class="form-group">
                                    <label>Grade color</label>
                                    <div class="color-palette" id="gradeColorPalette"></div>
                                </div>

                                <button class="btn-primary" id="addProblemBtn">Add Problem</button>
                            </div>
                        </details>
                    </div>
                </header>

                <main class="problems-list-container">
                    <section class="problems-list" id="problemsList"></section>
                </main>

                <footer>
                    <div class="timer-section">
                        <div class="timer-display" id="timerDisplay">--:--</div>
                        <div class="timer-controls" id="timerControls">
                            <button class="timer-btn" data-minutes="1">1m</button>
                            <button class="timer-btn" data-minutes="2">2m</button>
                            <button class="timer-btn" data-minutes="3">3m</button>
                            <button class="timer-btn" data-minutes="4">4m</button>
                            <button class="timer-btn" data-minutes="5">5m</button>
                        </div>
                    </div>
                </footer>
            </div>
        `;
        
        // Re-initialize timer display
        const timerDisplay = document.getElementById('timerDisplay');
        this.#timer = new Timer(timerDisplay, () => {
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
        });
        
        // Initialize color palettes
        this.#holdPalette = new ColorPalette(
            document.getElementById('holdColorPalette'),
            HOLD_COLORS,
            'blue',
            () => {}
        );

        this.#gradePalette = new ColorPalette(
            document.getElementById('gradeColorPalette'),
            GRADE_COLORS,
            'green',
            () => {}
        );
        
        this.#renderProblems();
        this.#updateFormState();
    }
    
    // ==================== EVENT BINDINGS ====================
    
    
    // ==================== PROBLEM TRACKER LOGIC ====================
    
    #toggleAttempt(problemId, attemptIndex) {
        const session = this.#sessionsStore.getById(this.#currentSessionId);
        if (!session) return;
        
        const problem = session.problems.find(p => p.id === problemId);
        if (!problem) return;

        // Check if attempt is already checked - prevent unchecking
        if (problem.attempts[attemptIndex].checked) {
            return;
        }

        // Enforce chronological order - only allow next attempt
        const lastCheckedIndex = problem.attempts.findLastIndex(a => a.checked);
        if (attemptIndex !== lastCheckedIndex + 1) {
            // Not the next chronological attempt, ignore
            return;
        }

        this.#sessionsStore.updateAttempt(this.#currentSessionId, problemId, attemptIndex, { checked: true });

        this.#currentReview = { problemId, attemptIndex };
        this.#renderProblems();

        // Focus after render
        setTimeout(() => {
            const input = document.getElementById(`review-${problemId}-${attemptIndex}`);
            if (input) {
                input.focus();
            }
        }, 100);
    }

    #saveReview(problemId, attemptIndex, review) {
        this.#sessionsStore.updateAttempt(this.#currentSessionId, problemId, attemptIndex, { review });
        this.#currentReview = { problemId: null, attemptIndex: null };
        this.#renderProblems();
    }

    #updateFormState() {
        const problemForm = document.getElementById('problemForm');
        const session = this.#sessionsStore.getById(this.#currentSessionId);
        
        if (problemForm && session && session.problems.length > 0 && problemForm.hasAttribute('open')) {
            problemForm.removeAttribute('open');
        }
    }

    #renderProblems() {
        const problemsList = document.getElementById('problemsList');
        if (!problemsList) return;
        
        const session = this.#sessionsStore.getById(this.#currentSessionId);
        if (!session) return;
        
        const problems = session.problems;

        if (problems.length === 0) {
            problemsList.innerHTML = '<div class="empty-state">No problems yet. Add one above! 🧗</div>';
            return;
        }

        problemsList.innerHTML = problems.map(problem => `
            <div class="problem-card" data-problem-id="${problem.id}">
                <div class="problem-header">
                    <div class="color-indicator" style="background: ${problem.holdColor}; ${problem.holdColor === '#FFFFFF' ? 'border: 1px solid #E5E5EA;' : ''}"></div>
                    <div class="color-divider"></div>
                    <div class="color-indicator" style="background: ${problem.gradeColor}; ${problem.gradeColor === '#FFFFFF' ? 'border: 1px solid #E5E5EA;' : ''}"></div>
                </div>

                <div class="attempts-grid">
                    ${problem.attempts.map((attempt, index) => {
                        const lastCheckedIndex = problem.attempts.findLastIndex(a => a.checked);
                        const isNextAttempt = index === lastCheckedIndex + 1;
                        const isDisabled = attempt.checked || !isNextAttempt;
                        
                        return `
                        <button 
                            class="attempt-btn ${attempt.checked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}"
                            data-attempt-index="${index}"
                            ${isDisabled ? 'disabled' : ''}
                        >
                            ${attempt.checked ? '✓' : index + 1}
                        </button>
                    `}).join('')}
                </div>

                ${problem.attempts.map((attempt, index) => {
                    if (attempt.review) {
                        return `<div class="review-text"><strong>Attempt ${index + 1}:</strong> ${escapeHtml(attempt.review)}</div>`;
                    }
                    if (this.#currentReview.problemId === problem.id && this.#currentReview.attemptIndex === index) {
                        return `
                            <div class="review-tips">
                                💡 <strong>Tip:</strong> Say something true & helpful about your attempt
                                <br>
                                💬 <strong>Tip:</strong> Explain why you fell without "I can't" or "it's too hard"
                            </div>
                            <input 
                                type="text" 
                                class="review-input show" 
                                id="review-${problem.id}-${index}"
                                data-problem-id="${problem.id}"
                                data-attempt-index="${index}"
                                placeholder="..."
                            />`;
                    }
                    return '';
                }).join('')}
            </div>
        `).join('');
    }

    #registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('Service Worker registered');

                    setInterval(() => {
                        registration.update();
                    }, SW_UPDATE_INTERVAL_MS);
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new BankanApp());
} else {
    new BankanApp();
}
