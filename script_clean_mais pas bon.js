/**
 * ==========================================================================
 * TAP VALENTINA - LOGIQUE DU JEU
 * Version nettoyée / Vanilla JS
 * ==========================================================================
 */

// ========================================================================== 
// 1. CONFIGURATION GLOBALE
// ========================================================================== 

const GAME_CONFIG = {
    maxLives: 3,
    angerMax: 100,

    initialSpawnRate: 1200,
    minSpawnRate: 450,
    speedIncreaseByScore: 18,

    bossMaxHP: 100,
    bossDamagePerTap: 4,
    bossTimeLimit: 10,

    hitAnimationDuration: 750,
    egoBoostFlashDuration: 350,

    moleLifespans: {
        normale: 2000,
        victime: 1800,
        'fausse-gentille': 2000,
        'ego-boost': 2300,
        rage: 650,
        miroir: 2000
    },

    // Probabilités réelles : normale 50%, victime 15%, fausse gentille 12%,
    // ego boost 8%, rage 5%, miroir 10%.
    spawnThresholds: [
        { limit: 0.50, type: 'normale' },
        { limit: 0.65, type: 'victime' },
        { limit: 0.77, type: 'fausse-gentille' },
        { limit: 0.85, type: 'ego-boost' },
        { limit: 0.90, type: 'rage' },
        { limit: 1.00, type: 'miroir' }
    ]
};

const HIT_IMAGES = [
    'images/hit-1.png',
    'images/hit-2.png',
    'images/hit-3.png',
    'images/hit-4.png',
    'images/hit-5.png'
];

const QUOTES = {
    normale: [
        'Moi, je dis ça pour aider.',
        'Évidemment.',
        'Sans moi, vous seriez perdus.',
        'Je ne suis pas méchante, je suis lucide.',
        'Je sais.'
    ],
    victime: [
        'Tu sais bien que je suis trop sensible...',
        'Je suis trop gentille, voilà mon problème...',
        'Encore une attaque personnelle !',
        "Je vais faire comme si je n'avais rien entendu."
    ],
    'fausse-gentille': [
        "Coucou l'équipe ! 😊",
        "Je vous adore aujourd'hui !"
    ],
    'fausse-gentille-mean': [
        'Je ne veux blesser personne, mais...',
        'C’est fou comme les gens sont limités.'
    ],
    'ego-boost': [
        'Je suis la seule à tenir ce bureau.',
        'Franchement, mon niveau est trop élevé.'
    ],
    rage: [
        "C'EN EST ASSEZ !",
        "C'EST UNE INJUSTICE RÉVOLTANTE !",
        'VOUS COMPLOTEZ TOUS CONTRE MOI !'
    ]
};

const BOSS_HURT_PHRASES = [
    'Aïe ! Ma sensibilité !',
    "C'est du harcèlement !",
    'Je vais me plaindre aux RH !',
    "C'est inadmissible !",
    'Je disais ça pour aider !!!',
    'Victime ! Je suis la victime !',
    "Vous n'avez aucun professionnalisme !"
];

// ========================================================================== 
// 2. ÉLÉMENTS DU DOM
// ========================================================================== 

const DOM = {
    screens: {
        start: document.getElementById('start-screen'),
        play: document.getElementById('play-screen'),
        end: document.getElementById('victory-screen')
    },
    buttons: {
        start: document.getElementById('start-btn'),
        restart: document.getElementById('restart-btn')
    },
    score: {
        current: document.getElementById('current-score'),
        best: document.getElementById('best-score'),
        final: document.getElementById('final-score')
    },
    lives: document.getElementById('lives-display'),
    angerProgress: document.getElementById('anger-progress'),
    quoteBubble: document.getElementById('quote-bubble'),
    quoteText: document.getElementById('quote-text'),
    stages: {
        grid: document.getElementById('grid-stage'),
        boss: document.getElementById('boss-stage')
    },
    boss: {
        character: document.getElementById('boss-character'),
        healthProgress: document.getElementById('boss-health-progress'),
        hpPercentage: document.getElementById('boss-hp-percentage')
    },
    end: {
        face: document.getElementById('end-face'),
        banner: document.querySelector('.victory-banner'),
        title: document.querySelector('.victory-title'),
        quote: document.querySelector('.victory-quote'),
        rating: document.getElementById('toxicity-rating')
    },
    holes: document.querySelectorAll('.hole')
};

// ========================================================================== 
// 3. ÉTAT DU JEU
// ========================================================================== 

let score = 0;
let bestScore = Number(localStorage.getItem('tap_valentina_best')) || 0;
let playerLives = GAME_CONFIG.maxLives;
let angerLevel = 0;
let spawnRate = GAME_CONFIG.initialSpawnRate;

let bossHP = GAME_CONFIG.bossMaxHP;
let bossTimeLeft = GAME_CONFIG.bossTimeLimit;

let isGameRunning = false;
let isBossPhase = false;

let moleTimer = null;
let bossTimer = null;
let activeMoles = {};

let audioCtx = null;

// ========================================================================== 
// 4. INITIALISATION
// ========================================================================== 

DOM.score.best.textContent = bestScore;
updateLivesDisplay();
bindEvents();

function bindEvents() {
    DOM.buttons.start.addEventListener('click', () => {
        initAudio();
        playSound('click');
        startGame();
    });

    DOM.buttons.restart.addEventListener('click', () => {
        initAudio();
        playSound('click');
        switchScreen(DOM.screens.end, DOM.screens.start);
    });

    DOM.boss.character.addEventListener('click', (event) => {
        event.stopPropagation();
        handleBossHit(event);
    });

    DOM.boss.character.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleBossHit(event);
    });

    document.querySelectorAll('.ripple').forEach((button) => {
        button.addEventListener('mousedown', createButtonRipple);
    });
}

// ========================================================================== 
// 5. OUTILS GÉNÉRIQUES
// ========================================================================== 

function getRandomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function getEventPosition(event, fallbackElement) {
    const rect = fallbackElement.getBoundingClientRect();
    const touch = event.touches && event.touches[0];

    return {
        x: event.clientX || (touch && touch.clientX) || rect.left + rect.width / 2,
        y: event.clientY || (touch && touch.clientY) || rect.top + rect.height / 3
    };
}

function switchScreen(fromScreen, toScreen) {
    fromScreen.classList.remove('active');

    setTimeout(() => {
        toScreen.classList.add('active');
    }, 150);
}

function createButtonRipple(event) {
    const ripple = document.createElement('span');
    ripple.style.left = `${event.clientX - event.target.offsetLeft}px`;
    ripple.style.top = `${event.clientY - event.target.offsetTop}px`;
    ripple.classList.add('ripple-effect');

    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

function createFloatingEffect(text, x, y, styleClass) {
    const floater = document.createElement('div');
    floater.classList.add('score-floating', styleClass);
    floater.textContent = text;
    floater.style.left = `${x - 20}px`;
    floater.style.top = `${y - 20}px`;

    document.body.appendChild(floater);
    setTimeout(() => floater.remove(), 800);
}

// ========================================================================== 
// 6. AFFICHAGE / UI
// ========================================================================== 

function updateScoreDisplay() {
    DOM.score.current.textContent = score;
}

function updateLivesDisplay() {
    if (!DOM.lives) return;

    const fullHearts = '❤️'.repeat(Math.max(0, playerLives));
    const emptyHearts = '🖤'.repeat(Math.max(0, GAME_CONFIG.maxLives - playerLives));
    DOM.lives.textContent = fullHearts + emptyHearts;
}

function updateAngerDisplay() {
    DOM.angerProgress.style.width = `${angerLevel}%`;
}

function updateBossHealthDisplay() {
    DOM.boss.healthProgress.style.width = `${bossHP}%`;
    DOM.boss.hpPercentage.textContent = bossHP;
}

function sayQuote(type) {
    const list = QUOTES[type] || QUOTES.normale;
    DOM.quoteText.textContent = `"${getRandomItem(list)}"`;
    DOM.quoteBubble.classList.remove('hidden');
}

// ========================================================================== 
// 7. AUDIO
// ========================================================================== 

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        switch (type) {
            case 'click':
                synthNote(350, 450, 0.08, 'sine');
                break;
            case 'hit':
                synthNote(220, 880, 0.12, 'sine');
                break;
            case 'hit-bad':
                synthNote(200, 100, 0.25, 'triangle');
                break;
            case 'hit-rage':
                synthNote(500, 1500, 0.15, 'sawtooth', 0.1);
                break;
            case 'shatter':
                synthNote(1200, 400, 0.2, 'triangle', 0.2);
                synthNote(900, 200, 0.15, 'sine', 0.2);
                break;
            case 'boss-hit':
                synthNote(140, 50, 0.25, 'triangle', 0.4);
                synthNote(100, 40, 0.15, 'square', 0.2);
                break;
            case 'defeat-boss':
                synthNote(300, 40, 0.6, 'sawtooth', 0.5);
                setTimeout(() => synthNote(180, 30, 0.5, 'triangle', 0.5), 100);
                break;
            case 'victory':
                playVictoryArpeggio();
                break;
        }
    } catch (error) {
        console.error('Impossible de lire le son.', error);
    }
}

function synthNote(startFreq, endFreq, duration, waveType = 'sine', maxVolume = 0.3) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(maxVolume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function synthNoteOnTime(freq, duration, waveType, startTime) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
}

function playVictoryArpeggio() {
    const now = audioCtx.currentTime;
    synthNoteOnTime(261.63, 0.1, 'sine', now);
    synthNoteOnTime(329.63, 0.1, 'sine', now + 0.1);
    synthNoteOnTime(392.00, 0.1, 'sine', now + 0.2);
    synthNoteOnTime(523.25, 0.3, 'sine', now + 0.3);
}

// ========================================================================== 
// 8. DÉBUT / RESET DE PARTIE
// ========================================================================== 

function startGame() {
    resetGameState();
    clearAllMoles();

    switchScreen(DOM.screens.start, DOM.screens.play);

    DOM.stages.grid.classList.add('active');
    DOM.stages.boss.classList.remove('active');
    DOM.quoteBubble.classList.add('hidden');

    startMoleTimer();
}

function resetGameState() {
    score = 0;
    angerLevel = 0;
    bossHP = GAME_CONFIG.bossMaxHP;
    bossTimeLeft = GAME_CONFIG.bossTimeLimit;
    playerLives = GAME_CONFIG.maxLives;
    spawnRate = GAME_CONFIG.initialSpawnRate;

    isGameRunning = true;
    isBossPhase = false;
    activeMoles = {};

    if (moleTimer) clearInterval(moleTimer);
    if (bossTimer) clearInterval(bossTimer);

    updateScoreDisplay();
    updateLivesDisplay();
    updateAngerDisplay();
    updateBossHealthDisplay();
}

// ========================================================================== 
// 9. SPAWN DES VALENTINAS
// ========================================================================== 

function startMoleTimer() {
    if (moleTimer) clearInterval(moleTimer);

    moleTimer = setInterval(() => {
        if (!isGameRunning || isBossPhase) {
            clearInterval(moleTimer);
            return;
        }

        spawnValentina();
    }, spawnRate);
}

function speedUpGame() {
    if (!isGameRunning || isBossPhase) return;

    const newRate = Math.max(
        GAME_CONFIG.minSpawnRate,
        GAME_CONFIG.initialSpawnRate - score * GAME_CONFIG.speedIncreaseByScore
    );

    if (Math.abs(newRate - spawnRate) > 50) {
        spawnRate = newRate;
        startMoleTimer();
    }
}

function spawnValentina() {
    const availableHoles = getAvailableHoles();
    if (availableHoles.length === 0) return;

    const selectedHole = getRandomItem(availableHoles);
    const container = selectedHole.querySelector('.mole-container');
    const type = chooseMoleType();
    const moleId = `${Date.now()}-${Math.random()}`;
    const mole = createMoleElement(type);

    container.appendChild(mole);

    activeMoles[moleId] = {
        element: mole,
        type,
        clicksLeft: type === 'ego-boost' ? 3 : 1,
        fakeGentilleState: 'nice',
        wasHit: false,
        timeoutIds: []
    };

    const showTimeout = setTimeout(() => {
        if (!activeMoles[moleId]) return;
        mole.classList.add('up');
        sayQuote(type);
    }, 50);

    activeMoles[moleId].timeoutIds.push(showTimeout);
    setupSpecialMoleBehavior(moleId);
    setupMoleAutoDespawn(moleId);
    setupMoleInput(mole, moleId);
}

function getAvailableHoles() {
    return Array.from(DOM.holes).filter((hole) => {
        const container = hole.querySelector('.mole-container');
        return container.children.length === 0;
    });
}

function chooseMoleType() {
    const rand = Math.random();
    const match = GAME_CONFIG.spawnThresholds.find((entry) => rand < entry.limit);
    return match ? match.type : 'normale';
}

function createMoleElement(type) {
    const mole = document.createElement('div');
    mole.classList.add('valentina', `type-${type}`);

    // Les sous-éléments sont conservés pour compatibilité avec l'ancien CSS,
    // mais les visuels PNG les masquent désormais.
    mole.innerHTML = `
        <div class="valentina-fringe"></div>
        <div class="valentina-jacket"></div>
        <div class="valentina-face">
            <div class="valentina-glasses"></div>
            <div class="valentina-eyes">
                <div class="eye"></div>
                <div class="eye"></div>
            </div>
            <div class="valentina-nose"></div>
            <div class="valentina-mouth"></div>
        </div>
    `;

    if (type === 'miroir') {
        const shield = document.createElement('div');
        shield.classList.add('mirror-shield');
        mole.appendChild(shield);
    }

    return mole;
}

function setupSpecialMoleBehavior(moleId) {
    const info = activeMoles[moleId];
    if (!info || info.type !== 'fausse-gentille') return;

    const timeoutId = setTimeout(() => {
        if (!activeMoles[moleId] || info.wasHit) return;

        info.fakeGentilleState = 'mean';
        info.element.classList.add('fake-mean');
        sayQuote('fausse-gentille-mean');
    }, 700);

    info.timeoutIds.push(timeoutId);
}

function setupMoleAutoDespawn(moleId) {
    const info = activeMoles[moleId];
    if (!info) return;

    const lifespan = GAME_CONFIG.moleLifespans[info.type] || GAME_CONFIG.moleLifespans.normale;

    const timeoutId = setTimeout(() => {
        const currentInfo = activeMoles[moleId];
        if (!currentInfo) return;

        if (currentInfo.type === 'rage' && !currentInfo.wasHit) {
            loseLife(1);
            createFloatingEffect('Rage ignorée !', window.innerWidth / 2, window.innerHeight / 2, 'negative');
        }

        despawnMole(moleId);
    }, lifespan);

    info.timeoutIds.push(timeoutId);
}

function setupMoleInput(mole, moleId) {
    mole.addEventListener('click', (event) => {
        event.stopPropagation();
        handleMoleClick(moleId, event);
    });

    mole.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleMoleClick(moleId, event);
    });
}

function clearAllMoles() {
    DOM.holes.forEach((hole) => {
        const container = hole.querySelector('.mole-container');
        container.innerHTML = '';
    });

    activeMoles = {};
}

function despawnMole(moleId) {
    const info = activeMoles[moleId];
    if (!info) return;

    info.timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
    info.element.classList.remove('up');

    setTimeout(() => {
        if (info.element.parentNode) {
            info.element.parentNode.removeChild(info.element);
        }
        delete activeMoles[moleId];
    }, 200);
}

// ========================================================================== 
// 10. CLIC SUR VALENTINA
// ========================================================================== 

function handleMoleClick(moleId, event) {
    const info = activeMoles[moleId];
    if (!info || info.wasHit) return;

    const mole = info.element;
    const { x, y } = getEventPosition(event, mole);

    if (info.type === 'victime') {
        handleVictimHit(info, moleId, x, y);
    } else if (info.type === 'ego-boost') {
        handleEgoBoostHit(info, moleId, x, y);
    } else {
        handleStandardHit(info, moleId, x, y);
    }

    updateScoreDisplay();
    speedUpGame();
}

function handleVictimHit(info, moleId, x, y) {
    score = Math.max(0, score - 1);
    increaseAnger(15);
    loseLife(1);
    playSound('hit-bad');
    createFloatingEffect('-1 Victime !', x, y, 'negative');

    playFinalHitAnimation(info, moleId);
}

function handleEgoBoostHit(info, moleId, x, y) {
    info.clicksLeft -= 1;

    if (info.clicksLeft > 0) {
        playSound('hit');
        playTemporaryHitFlash(info);
        createFloatingEffect(`${info.clicksLeft} coups restants !`, x, y, 'text');
        return;
    }

    score += 3;
    increaseAnger(25);
    playSound('hit-rage');
    createFloatingEffect('+3 Ego brisé !', x, y, 'positive');

    playFinalHitAnimation(info, moleId);
}

function handleStandardHit(info, moleId, x, y) {
    const reward = getStandardHitReward(info);

    score += reward.points;
    increaseAnger(reward.anger);
    playSound(reward.sound);
    createFloatingEffect(reward.text, x, y, 'positive');

    if (info.type === 'miroir') {
        const shield = info.element.querySelector('.mirror-shield');
        if (shield) shield.style.display = 'none';
    }

    playFinalHitAnimation(info, moleId);
}

function getStandardHitReward(info) {
    if (info.type === 'rage') {
        return { points: 5, anger: 30, sound: 'hit-rage', text: '+5 RAGE 💢' };
    }

    if (info.type === 'miroir') {
        return { points: 2, anger: 15, sound: 'shatter', text: '+2 Miroir cassé ! 🪞' };
    }

    if (info.type === 'fausse-gentille' && info.fakeGentilleState === 'mean') {
        return { points: 2, anger: 20, sound: 'hit-rage', text: '+2 Cynisme dénoncé !' };
    }

    return { points: 1, anger: 10, sound: 'hit', text: '+1' };
}

function applyRandomHitImage(mole) {
    mole.style.backgroundImage = `url("${getRandomItem(HIT_IMAGES)}")`;
}

function playTemporaryHitFlash(info) {
    applyRandomHitImage(info.element);
    info.element.classList.add('is-hit');

    setTimeout(() => {
        if (!activeMoles || info.wasHit) return;
        info.element.classList.remove('is-hit');
        info.element.style.backgroundImage = '';
    }, GAME_CONFIG.egoBoostFlashDuration);
}

function playFinalHitAnimation(info, moleId) {
    info.wasHit = true;
    info.timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
    info.timeoutIds = [];

    applyRandomHitImage(info.element);
    info.element.classList.add('is-hit');

    setTimeout(() => {
        despawnMole(moleId);
    }, GAME_CONFIG.hitAnimationDuration);
}

function increaseAnger(amount) {
    if (isBossPhase) return;

    angerLevel = Math.min(GAME_CONFIG.angerMax, angerLevel + amount);
    updateAngerDisplay();

    if (angerLevel >= GAME_CONFIG.angerMax) {
        triggerBossStage();
    }
}

// ========================================================================== 
// 11. VIES / DÉFAITE
// ========================================================================== 

function loseLife(amount = 1) {
    if (!isGameRunning) return;

    playerLives = Math.max(0, playerLives - amount);
    updateLivesDisplay();

    createFloatingEffect(`-${amount} ❤️`, window.innerWidth / 2, window.innerHeight / 2, 'negative');

    if (playerLives <= 0) {
        triggerGameOver();
    }
}

// ========================================================================== 
// 12. BOSS FINAL
// ========================================================================== 

function triggerBossStage() {
    isBossPhase = true;
    DOM.quoteBubble.classList.add('hidden');

    if (moleTimer) clearInterval(moleTimer);

    Object.keys(activeMoles).forEach((moleId) => despawnMole(moleId));

    DOM.stages.grid.classList.remove('active');
    DOM.stages.boss.classList.add('active');

    bossHP = GAME_CONFIG.bossMaxHP;
    bossTimeLeft = GAME_CONFIG.bossTimeLimit;
    updateBossHealthDisplay();

    playSound('hit-rage');
    shakePlayScreen(1000);
    startBossTimer();
}

function startBossTimer() {
    if (bossTimer) clearInterval(bossTimer);

    bossTimer = setInterval(() => {
        bossTimeLeft -= 1;
        createFloatingEffect(`${bossTimeLeft}`, window.innerWidth / 2, 120, 'text');

        if (bossTimeLeft <= 0) {
            clearInterval(bossTimer);
            if (bossHP > 0) triggerGameOver();
        }
    }, 1000);
}

function handleBossHit(event) {
    if (!isGameRunning || !isBossPhase) return;

    bossHP = Math.max(0, bossHP - GAME_CONFIG.bossDamagePerTap);
    updateBossHealthDisplay();

    playSound('boss-hit');
    restartBossHitAnimation();
    shakePlayScreen(100);

    const { x, y } = getEventPosition(event, DOM.boss.character);
    createBossFloatingFeedback(x, y);

    score += 1;
    updateScoreDisplay();

    if (bossHP <= 0) {
        triggerVictory();
    }
}

function restartBossHitAnimation() {
    DOM.boss.character.style.animation = 'none';
    void DOM.boss.character.offsetWidth;
    DOM.boss.character.style.animation = 'hitShakeGiant 0.12s ease-out';
}

function shakePlayScreen(duration) {
    DOM.screens.play.classList.add('screen-shocked');
    setTimeout(() => DOM.screens.play.classList.remove('screen-shocked'), duration);
}

function createBossFloatingFeedback(x, y) {
    if (Math.random() < 0.35) {
        createFloatingEffect(getRandomItem(BOSS_HURT_PHRASES), x, y, 'text');
        return;
    }

    createFloatingEffect('-4% Ego !', x, y, 'negative');
}

// ========================================================================== 
// 13. FIN DE PARTIE
// ========================================================================== 

function triggerVictory() {
    isGameRunning = false;
    isBossPhase = false;

    if (bossTimer) clearInterval(bossTimer);

    playSound('defeat-boss');
    setTimeout(() => playSound('victory'), 600);

    saveBestScoreIfNeeded();
    showEndScreen({
        banner: 'VICTOIRE !',
        title: 'Valentina s’effondre en larmes',
        quote: '“Vous êtes tous méchants… je disais ça pour aider…”',
        faceClass: 'valentina type-wounded',
        rating: getToxicityRating(score)
    });
}

function triggerGameOver() {
    isGameRunning = false;
    isBossPhase = false;

    if (moleTimer) clearInterval(moleTimer);
    if (bossTimer) clearInterval(bossTimer);

    Object.keys(activeMoles).forEach((moleId) => despawnMole(moleId));
    DOM.quoteBubble.classList.add('hidden');

    showEndScreen({
        banner: 'DÉFAITE !',
        title: 'Valentina triomphe',
        quote: '“Je savais que vous n’étiez pas à mon niveau.”',
        faceClass: 'valentina type-gameover',
        rating: 'Valentina a repris le contrôle 😈'
    });
}

function showEndScreen({ banner, title, quote, faceClass, rating }) {
    DOM.score.final.textContent = score;
    DOM.end.rating.textContent = rating;
    DOM.end.face.className = faceClass;
    DOM.end.banner.textContent = banner;
    DOM.end.title.textContent = title;
    DOM.end.quote.textContent = quote;

    switchScreen(DOM.screens.play, DOM.screens.end);
}

function saveBestScoreIfNeeded() {
    if (score <= bestScore) return;

    bestScore = score;
    localStorage.setItem('tap_valentina_best', bestScore);
    DOM.score.best.textContent = bestScore;
}

function getToxicityRating(finalScore) {
    if (finalScore > 85) {
        return "Génie Anti-Toxique Suprême 👑 (Vous avez sauvé l'agence !)";
    }

    if (finalScore > 60) {
        return 'Spécialiste en Contrôle d’Ego 🛡️ (Un pro du recadrage !)';
    }

    if (finalScore > 35) {
        return 'Pacificateur Moyen de Bureau 🤝 (Peut mieux faire !)';
    }

    return 'Victime Débutante Professionnelle 😢 (Trop sensible !)';
}


