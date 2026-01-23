/**
 * Yoku - Climbing Problem Tracker
 */

const STORAGE_KEY = 'yoku_sessions';
const OLD_STORAGE_KEY = 'bankan_sessions';

const HOLD_COLORS = ['green', 'yellow', 'orange', 'blue', 'red', 'black', 'white', 'purple', 'teal', 'pink'];
const GRADE_COLORS = ['green', 'yellow', 'orange', 'blue', 'red', 'black', 'white', 'purple'];

const HEX_TO_COLOR = {
    '#52C47B': 'green',
    '#FFD93D': 'yellow',
    '#FF8A5C': 'orange',
    '#4A90E2': 'blue',
    '#FF6B6B': 'red',
    '#2C2C2E': 'black',
    '#FFFFFF': 'white',
    '#9B7FD8': 'purple',
    '#4ECDC4': 'teal',
    '#FF85A2': 'pink'
};

function migrateHexToColorName(color) {
    return color?.startsWith('#') ? (HEX_TO_COLOR[color] || 'blue') : color;
}

// Persistence helpers
function loadSessions() {
    try {
        // Migrate from old storage key
        const oldData = localStorage.getItem(OLD_STORAGE_KEY);
        if (oldData && !localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, oldData);
            localStorage.removeItem(OLD_STORAGE_KEY);
        }

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                const sessions = parsed.filter(s =>
                    s && typeof s.id === 'number' &&
                    typeof s.createdAt === 'number' &&
                    Array.isArray(s.problems)
                );

                // Migrate hex colors to color names
                let needsSave = false;
                sessions.forEach(session => {
                    session.problems.forEach(problem => {
                        if (problem.holdColor?.startsWith('#')) {
                            problem.holdColor = migrateHexToColorName(problem.holdColor);
                            needsSave = true;
                        }
                        if (problem.gradeColor?.startsWith('#')) {
                            problem.gradeColor = migrateHexToColorName(problem.gradeColor);
                            needsSave = true;
                        }
                    });
                });

                if (needsSave) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
                }

                return sessions;
            }
        }
    } catch (e) {
        console.error('Failed to load sessions:', e);
    }
    return [];
}

function saveSessions(sessions) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
        console.error('Failed to save sessions:', e);
    }
}

// Date formatting
function formatDate(timestamp) {
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

// Vibration helper
function vibrate(duration = 50) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

// Main app component
document.addEventListener('alpine:init', () => {

    // Timer component
    Alpine.data('timer', () => ({
        display: '--:--',
        endTime: null,
        interval: null,
        lastTap: 0,

        start(minutes) {
            this.clear();
            this.endTime = Date.now() + (minutes * 60 * 1000);
            this.tick();
            this.interval = setInterval(() => this.tick(), 100);
        },

        tick() {
            if (!this.endTime) {
                this.display = '--:--';
                return;
            }

            const remaining = this.endTime - Date.now();

            if (remaining <= 0) {
                this.clear();
                this.display = '00:00';
                vibrate([200, 100, 200]);
                return;
            }

            const totalSeconds = Math.ceil(remaining / 1000);
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            this.display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        },

        handleTap() {
            const now = Date.now();
            if (now - this.lastTap < 300) {
                this.clear();
            }
            this.lastTap = now;
        },

        clear() {
            if (this.interval) clearInterval(this.interval);
            this.interval = null;
            this.endTime = null;
            this.display = '--:--';
        }
    }));

    // Main app component
    Alpine.data('yoku', () => ({
        screen: 'sessions',
        sessions: loadSessions(),
        currentSessionId: null,
        selectedHold: 'blue',
        selectedGrade: 'green',
        editingReview: null,
        holdColors: HOLD_COLORS,
        gradeColors: GRADE_COLORS,

        get currentSession() {
            return this.sessions.find(s => s.id === this.currentSessionId);
        },

        formatDate,

        // Sessions
        createSession() {
            const timestamp = Date.now();
            const session = {
                id: timestamp,
                createdAt: timestamp,
                problems: []
            };
            this.sessions.unshift(session);
            this.save();
            this.openSession(session.id);
        },

        openSession(id) {
            this.currentSessionId = id;
            this.editingReview = null;
            this.screen = 'tracker';
        },

        deleteSession(id) {
            if (confirm('Delete this session?')) {
                this.sessions = this.sessions.filter(s => s.id !== id);
                this.save();
            }
        },

        // Problems
        addProblem() {
            const session = this.currentSession;
            if (!session) return;

            session.problems.push({
                id: Date.now(),
                holdColor: this.selectedHold,
                gradeColor: this.selectedGrade,
                attempts: Array.from({ length: 5 }, () => ({ checked: false, review: '' }))
            });

            this.save();

            // Close form if it has problems
            if (session.problems.length > 0 && this.$refs.problemForm?.open) {
                this.$refs.problemForm.open = false;
            }
        },

        // Attempts
        getNextAttemptIndex(problem) {
            const lastChecked = problem.attempts.findLastIndex(a => a.checked);
            return lastChecked + 1;
        },

        toggleAttempt(problem, index) {
            const attempt = problem.attempts[index];

            if (attempt.checked) {
                // Uncheck and clear review
                attempt.checked = false;
                attempt.review = '';
                this.editingReview = null;
            } else {
                // Only allow next chronological attempt
                if (index !== this.getNextAttemptIndex(problem)) return;

                attempt.checked = true;
                this.editingReview = { problemId: problem.id, attemptIndex: index };
            }

            this.save();
        },

        // Reviews
        startEditReview(problemId, attemptIndex) {
            this.editingReview = { problemId, attemptIndex };
        },

        saveReview(problem, attemptIndex, value) {
            problem.attempts[attemptIndex].review = value;
            this.editingReview = null;
            this.save();
        },

        // Persistence
        save() {
            saveSessions(this.sessions);
        },

        // Service worker
        init() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => {
                        console.log('Service Worker registered');
                        setInterval(() => reg.update(), 60000);
                    })
                    .catch(err => console.log('SW registration failed:', err));
            }
        }
    }));
});
