/**
 * Bankan - Climbing Problem Tracker
 * ES Module with Class-based architecture
 */

// Constants
const DOUBLE_TAP_THRESHOLD_MS = 300;
const SW_UPDATE_INTERVAL_MS = 60000;
const TIMER_TICK_MS = 100;
const STORAGE_KEY = 'bankan_problems';

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
 * ProblemStore class - handles data persistence
 */
class ProblemStore {
    #problems = [];

    constructor() {
        this.#load();
    }

    #load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    this.#problems = parsed.filter(p =>
                        p && typeof p.id === 'number' &&
                        isValidColor(p.holdColor) &&
                        isValidColor(p.gradeColor) &&
                        Array.isArray(p.attempts)
                    );
                }
            }
        } catch (e) {
            console.error('Failed to load problems:', e);
            this.#problems = [];
        }
    }

    #save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#problems));
        } catch (e) {
            console.error('Failed to save problems:', e);
        }
    }

    getAll() {
        return this.#problems;
    }

    getById(id) {
        return this.#problems.find(p => p.id === id);
    }

    add(holdColor, gradeColor) {
        const problem = {
            id: Date.now(),
            holdColor,
            gradeColor,
            attempts: Array.from({ length: 5 }, () => ({ checked: false, review: '' }))
        };

        this.#problems.push(problem);
        this.#save();
        return problem;
    }

    updateAttempt(problemId, attemptIndex, updates) {
        const problem = this.getById(problemId);
        if (problem && problem.attempts[attemptIndex]) {
            Object.assign(problem.attempts[attemptIndex], updates);
            this.#save();
            return true;
        }
        return false;
    }

    clear() {
        this.#problems = [];
        this.#save();
    }

    get length() {
        return this.#problems.length;
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
    #store;
    #timer;
    #holdPalette;
    #gradePalette;
    #elements;
    #currentReview = { problemId: null, attemptIndex: null };
    #touchState = { startX: 0, startY: 0, problemId: null };

    constructor() {
        this.#elements = {
            holdColorPalette: document.getElementById('holdColorPalette'),
            gradeColorPalette: document.getElementById('gradeColorPalette'),
            problemsList: document.getElementById('problemsList'),
            problemForm: document.getElementById('problemForm'),
            timerDisplay: document.getElementById('timerDisplay'),
            timerControls: document.getElementById('timerControls'),
            addProblemBtn: document.getElementById('addProblemBtn'),
            clearSessionBtn: document.getElementById('clearSessionBtn')
        };

        this.#store = new ProblemStore();

        this.#timer = new Timer(this.#elements.timerDisplay, () => {
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
        });

        this.#holdPalette = new ColorPalette(
            this.#elements.holdColorPalette,
            HOLD_COLORS,
            'blue',
            () => {}
        );

        this.#gradePalette = new ColorPalette(
            this.#elements.gradeColorPalette,
            GRADE_COLORS,
            'green',
            () => {}
        );

        this.#bindEvents();
        this.#render();
        this.#updateFormState();
        this.#registerServiceWorker();
    }

    #bindEvents() {
        // Add problem button
        this.#elements.addProblemBtn.addEventListener('click', () => this.#addProblem());
        this.#elements.addProblemBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.#addProblem();
        });

        // Clear session button
        this.#elements.clearSessionBtn.addEventListener('click', () => this.#clearSession());
        this.#elements.clearSessionBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.#clearSession();
        });

        // Timer display (double-tap to clear)
        this.#elements.timerDisplay.addEventListener('click', () => this.#timer.handleTap());
        this.#elements.timerDisplay.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.#timer.handleTap();
        });

        // Timer control buttons
        const handleTimerBtn = (e) => {
            const btn = e.target.closest('.timer-btn');
            if (btn) {
                const minutes = parseInt(btn.dataset.minutes, 10);
                this.#timer.start(minutes);
            }
        };

        this.#elements.timerControls.addEventListener('click', handleTimerBtn);
        this.#elements.timerControls.addEventListener('touchend', (e) => {
            const btn = e.target.closest('.timer-btn');
            if (btn) {
                e.preventDefault();
                handleTimerBtn(e);
            }
        });

        // Problems list (event delegation)
        const handleAttemptClick = (e) => {
            const attemptBtn = e.target.closest('.attempt-btn');
            if (attemptBtn) {
                const card = attemptBtn.closest('.problem-card');
                const problemId = parseInt(card.dataset.problemId, 10);
                const attemptIndex = parseInt(attemptBtn.dataset.attemptIndex, 10);
                this.#toggleAttempt(problemId, attemptIndex);
            }
        };

        this.#elements.problemsList.addEventListener('click', handleAttemptClick);
        this.#elements.problemsList.addEventListener('touchend', (e) => {
            const btn = e.target.closest('.attempt-btn');
            if (btn) {
                e.preventDefault();
                handleAttemptClick(e);
            }
        });

        // Swipe to delete
        this.#elements.problemsList.addEventListener('touchstart', (e) => this.#handleTouchStart(e));
        this.#elements.problemsList.addEventListener('touchmove', (e) => this.#handleTouchMove(e));
        this.#elements.problemsList.addEventListener('touchend', (e) => this.#handleTouchEnd(e));

        // Review input events (delegated)
        this.#elements.problemsList.addEventListener('blur', (e) => {
            if (e.target.classList.contains('review-input')) {
                const problemId = parseInt(e.target.dataset.problemId, 10);
                const attemptIndex = parseInt(e.target.dataset.attemptIndex, 10);
                this.#saveReview(problemId, attemptIndex, e.target.value);
            }
        }, true);

        this.#elements.problemsList.addEventListener('keypress', (e) => {
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

    #addProblem() {
        this.#store.add(
            this.#holdPalette.getSelectedColor(),
            this.#gradePalette.getSelectedColor()
        );
        this.#render();
        this.#updateFormState();
    }

    #toggleAttempt(problemId, attemptIndex) {
        const problem = this.#store.getById(problemId);
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

        this.#store.updateAttempt(problemId, attemptIndex, { checked: true });

        this.#currentReview = { problemId, attemptIndex };
        this.#render();

        // Focus after render
        setTimeout(() => {
            const input = document.getElementById(`review-${problemId}-${attemptIndex}`);
            if (input) {
                input.focus();
            }
        }, 100);
    }

    #saveReview(problemId, attemptIndex, review) {
        this.#store.updateAttempt(problemId, attemptIndex, { review });
        this.#currentReview = { problemId: null, attemptIndex: null };
        this.#render();
    }

    #clearSession() {
        if (confirm('Clear all problems?')) {
            this.#store.clear();
            this.#render();
            if (!this.#elements.problemForm.hasAttribute('open')) {
                this.#elements.problemForm.setAttribute('open', '');
            }
        }
    }

    #handleTouchStart(e) {
        const card = e.target.closest('.problem-card');
        if (!card || e.target.closest('.attempt-btn')) return;

        const touch = e.touches[0];
        this.#touchState = {
            startX: touch.clientX,
            startY: touch.clientY,
            problemId: parseInt(card.dataset.problemId, 10)
        };
    }

    #handleTouchMove(e) {
        if (!this.#touchState.startX || e.target.closest('.attempt-btn')) return;

        const card = e.target.closest('.problem-card');
        if (!card) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - this.#touchState.startX;
        const deltaY = touch.clientY - this.#touchState.startY;

        // Only respond to horizontal swipes
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
            card.classList.add('swiping');
            card.style.transform = `translateX(${deltaX}px)`;
        }
    }

    #handleTouchEnd(e) {
        if (!this.#touchState.startX) return;

        const card = document.querySelector(`.problem-card[data-problem-id="${this.#touchState.problemId}"]`);
        if (!card) {
            this.#touchState = { startX: 0, startY: 0, problemId: null };
            return;
        }

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - this.#touchState.startX;
        const deltaY = touch.clientY - this.#touchState.startY;

        // Check if it's a swipe (more than 100px horizontal)
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 100) {
            // Delete the problem
            this.#store.deleteById(this.#touchState.problemId);
            this.#render();
            this.#updateFormState();
        } else {
            // Reset the card
            card.classList.remove('swiping');
            card.style.transform = '';
        }

        this.#touchState = { startX: 0, startY: 0, problemId: null };
    }

    #updateFormState() {
        if (this.#store.length > 0 && this.#elements.problemForm.hasAttribute('open')) {
            this.#elements.problemForm.removeAttribute('open');
        }
    }

    #render() {
        const problems = this.#store.getAll();

        if (problems.length === 0) {
            this.#elements.problemsList.innerHTML = '<div class="empty-state">No problems yet. Add one above! 🧗</div>';
            return;
        }

        this.#elements.problemsList.innerHTML = problems.map(problem => `
            <div class="problem-card" data-problem-id="${problem.id}">
                <div class="delete-hint">Swipe to delete →</div>
                <div class="problem-header">
                    <div class="color-indicator" style="background: ${problem.holdColor}; ${problem.holdColor === '#FFFFFF' ? 'border: 1px solid #E5E5EA;' : ''}"></div>
                    <div class="color-divider"></div>
                    <div class="color-indicator" style="background: ${problem.gradeColor}; ${problem.gradeColor === '#FFFFFF' ? 'border: 1px solid #E5E5EA;' : ''}"></div>
                </div>

                <div class="attempts-grid">
                    ${problem.attempts.map((attempt, index) => `
                        <button 
                            class="attempt-btn ${attempt.checked ? 'checked' : ''}"
                            data-attempt-index="${index}"
                        >
                            ${attempt.checked ? '✓' : index + 1}
                        </button>
                    `).join('')}
                </div>

                ${problem.attempts.map((attempt, index) => {
                    if (attempt.review) {
                        return `<div class="review-text"><strong>Attempt ${index + 1}:</strong> ${escapeHtml(attempt.review)}</div>`;
                    }
                    if (this.#currentReview.problemId === problem.id && this.#currentReview.attemptIndex === index) {
                        return `<input 
                            type="text" 
                            class="review-input show" 
                            id="review-${problem.id}-${index}"
                            data-problem-id="${problem.id}"
                            data-attempt-index="${index}"
                            placeholder="Add review for attempt ${index + 1}..."
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
