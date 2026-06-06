/**
 * ==========================================================================
 * LOGIQUE DU JEU "TAP VALENTINA" - VERSION 1.0 (VANILLA JS)
 * ==========================================================================
 * Ce script gère l'état global du jeu, le spawn des différents types
 * de taupes (les incarnations de Valentina), la détection des clics (desktop)
 * et taps (mobile), les animations de l'interface, la gestion du boss final,
 * et la synthèse sonore embarquée via l'API Web Audio (aucun fichier audio requis !).
 */

// --- Éléments du DOM ---
const startScreen = document.getElementById('start-screen');
const playScreen = document.getElementById('play-screen');
const victoryScreen = document.getElementById('victory-screen');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const curScoreEl = document.getElementById('current-score');
const livesDisplayEl = document.getElementById('lives-display');
const levelDisplayEl = document.getElementById('level-display');
const bestScoreEl = document.getElementById('best-score');
const finalScoreEl = document.getElementById('final-score');
const angerProgressEl = document.getElementById('anger-progress');
const quoteBubble = document.getElementById('quote-bubble');
const quoteText = document.getElementById('quote-text');

const gridStage = document.getElementById('grid-stage');
const bossStage = document.getElementById('boss-stage');
const bossCharacter = document.getElementById('boss-character');
const bossHealthProgress = document.getElementById('boss-health-progress');
const bossHpPercentage = document.getElementById('boss-hp-percentage');
const toxicityRatingEl = document.getElementById('toxicity-rating');

const endFace = document.getElementById('end-face');

const victoryBanner = document.querySelector('.victory-banner');
const victoryTitle = document.querySelector('.victory-title');
const victoryQuote = document.querySelector('.victory-quote');

const holes = document.querySelectorAll('.hole');



// --- Variables de configuration du jeu ---
let score = 0;
let highestScore = localStorage.getItem('tap_valentina_best') || 0;
let angerLevel = 0; // De 0 à 100
let isGameRunning = false;
let isBossPhase = false;
let bossHP = 100; // Point de vie du boss
let level = 1;
let bossTimer = null;
let bossTimeLeft = 10;

let moleTimer = null; // Référence sur le setInterval de spawn des taupes
let activeMoles = {}; // Suivi des taupes actuellement visibles pour éviter les bugs

// Vitesse de spawn initiale (millisecondes)
let spawnRate = 1200; 

// --- Images Hit
const HIT_IMAGES = [
    "images/hit-1.png",
    "images/hit-2.png",
    "images/hit-3.png",
    "images/hit-4.png",
    "images/hit-5.png"
];

function applyRandomHitImage(mole) {
    const randomImage = HIT_IMAGES[Math.floor(Math.random() * HIT_IMAGES.length)];
    mole.style.backgroundImage = `url("${randomImage}")`;
}

// --- Citations de Valentina par comportement ---
const QUOTES_NORMALE = [
    "Moi, je dis ça pour aider.",
    "Évidemment.",
    "Sans moi, vous seriez perdus.",
    "Je ne suis pas méchante, je suis lucide.",
    "Je sais."
];

const QUOTES_VICTIME = [
    "Tu sais bien que je suis trop sensible...",
    "Je suis trop gentille, voilà mon problème...",
    "Encore une attaque personnelle !",
    "Je vais faire comme si je n'avais rien entendu."
];

const QUOTES_FAUSSE_GENTILLE_NICE = [
    "Coucou l'équipe ! 😊",
    "Je vous adore aujourd'hui !"
];

const QUOTES_FAUSSE_GENTILLE_MEAN = [
    "Je ne veux blesser personne, mais...",
    "C'est fou comme les gens sont limités."
];

const QUOTES_EGO = [
    "Je suis la seule à tenir ce bureau.",
    "Franchement, mon niveau est trop élevé."
];

const QUOTES_RAGE = [
    "S'EN EST ASSEZ !",
    "C'EST UNE INJUSTICE REVOLTANTE !",
    "VOUS COMPLOTER TOUS CONTRE MOI !"
];

// Dialogues spéciaux criés par le Guinea Pig diabolique géant pendant qu'il se fait taper
const BOSS_HURT_PHRASES = [
    "Aïe ! Ma sensibilité !",
    "C'est du harcèlement !",
    "Je vais me plaindre aux RH !",
    "C'est inadmissible !",
    "Je disais ça pour aider !!!",
    "Victime ! Je suis la victime !",
    "Vous n'avez aucun professionnalisme !"
];

// --- INITIALISATION DU SYNTHÉTISEUR AUDIO RETRO (Web Audio API) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        // Démarre l'API Audio au premier clic du joueur
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

/**
 * Fonction générique pour fabriquer un son de synthétiseur simple d'un jeu rétro.
 */
function playSound(type) {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        switch(type) {
            case 'click': // Clic classique sur bouton
                synthNote(350, 450, 0.08, 'sine');
                break;
            case 'hit': // Hit normal (pop aigu)
                synthNote(220, 880, 0.12, 'sine');
                break;
            case 'hit-bad': // Clic victime/erreur (buzzer)
                synthNote(200, 100, 0.25, 'triangle');
                break;
            case 'hit-rage': // Hit de Valentina enragée (effet de laser)
                synthNote(500, 1500, 0.15, 'sawtooth', 0.1);
                break;
            case 'shatter': // Cassage de miroir (bruit métallique/aigu)
                synthNote(1200, 400, 0.2, 'triangle', 0.2);
                synthNote(900, 200, 0.15, 'sine', 0.2);
                break;
            case 'boss-hit': // Enorme slam sur le boss
                synthNote(140, 50, 0.25, 'triangle', 0.4);
                // Ajout d'une petite onde carrée pour donner de la corpulence
                synthNote(100, 40, 0.15, 'square', 0.2);
                break;
            case 'defeat-boss': // Mort du boss (explosion cartoon)
                synthNote(300, 40, 0.6, 'sawtooth', 0.5);
                setTimeout(() => synthNote(180, 30, 0.5, 'triangle', 0.5), 100);
                break;
            case 'victory': // Arpège de victoire
                let now = audioCtx.currentTime;
                synthNoteOnTime(261.63, 0.1, 'sine', now); // Do
                synthNoteOnTime(329.63, 0.1, 'sine', now + 0.1); // Mi
                synthNoteOnTime(392.00, 0.1, 'sine', now + 0.2); // Sol
                synthNoteOnTime(523.25, 0.3, 'sine', now + 0.3); // Do octave sup
                break;
        }
    } catch (e) {
        console.error("Impossible de lire le son en raison des restrictions audio", e);
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


// --- CONFIGURATION INITIALE DES AUDIO & CLICS ---
bestScoreEl.textContent = highestScore;

startBtn.addEventListener('click', () => {
    initAudio();
    playSound('click');
    startGame();
});

restartBtn.addEventListener('click', () => {
    initAudio();
    playSound('click');
    switchScreen(victoryScreen, startScreen);
});

// Applique l'effet tactile pour mobile et clic normal
document.querySelectorAll('.ripple').forEach(btn => {
    btn.addEventListener('mousedown', function (e) {
        let x = e.clientX - e.target.offsetLeft;
        let y = e.clientY - e.target.offsetTop;
        let ripples = document.createElement('span');
        ripples.style.left = x + 'px';
        ripples.style.top = y + 'px';
        ripples.classList.add('ripple-effect');
        this.appendChild(ripples);
        setTimeout(() => ripples.remove(), 600);
    });
});

// --- LOGIQUE MAITRESSE DU JEU ---

/**
 * Démarre ou réinitialise une partie
 */
function startGame() {
    score = 0;
    angerLevel = 0;
    bossHP = 100;
    playerLives = 3;
    updateLivesDisplay();
    spawnRate = 1200;
    isGameRunning = true;
    isBossPhase = false;
    activeMoles = {};
    level = 1;
    updateLevelDisplay();

    
    curScoreEl.textContent = score;
    angerProgressEl.style.width = '0%';
    
    // Nettoyer tous les trous d'éventuelles taupes résiduelles
    holes.forEach(hole => {
        const container = hole.querySelector('.mole-container');
        container.innerHTML = '';
    });
    
    // Changement d'écran vers le jeu
    switchScreen(startScreen, playScreen);
    
    // Activer la grille normale, désactiver l'écran Boss
    gridStage.classList.add('active');
    bossStage.classList.remove('active');
    
    // Démarrer la boucle de spawn
    startMoleTimer();
}

/**
 * Transition fluide d'écran
 */
function switchScreen(fromScreen, toScreen) {
    fromScreen.classList.remove('active');
    setTimeout(() => {
        toScreen.classList.add('active');
    }, 150);
}

/**
 * Planifier l'apparition des Valentinas
 */
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

/**
 * Calculer la vitesse par rapport au score (plus le score est haut, plus Valentina sort vite !)
 */
function speedUpGame() {
    if (!isGameRunning || isBossPhase) return;
    
    // Calcul de la vitesse dynamique (seuil minimum à 450ms de spawn)
    let newRate = Math.max(450, 1200 - (score * 18));
    if (Math.abs(newRate - spawnRate) > 50) {
        spawnRate = newRate;
        startMoleTimer(); // Redémarre l'intervalle avec le nouveau rythme
    }
}

/**
 * Créer Valentina aléatoirement dans un des 9 trous
 */
function spawnValentina() {
    // 1. Choisir les trous vides disponibles
    const availableHoles = [];
    holes.forEach((hole, index) => {
        const container = hole.querySelector('.mole-container');
        if (container.children.length === 0) {
            availableHoles.push(hole);
        }
    });
    
    // S'il n'y a pas de trous de libre, on passe ce tour
    if (availableHoles.length === 0) return;
    
    // 2. Sélectionner un trou au hasard
    const selectedHole = availableHoles[Math.floor(Math.random() * availableHoles.length)];
    const holeIndex = selectedHole.getAttribute('data-index');
    const container = selectedHole.querySelector('.mole-container');
    
    // 3. Déterminer de manière aléatoire le type de Valentina qui va spawn
    const rand = Math.random();
    let type = 'normale';
    
    if (rand < 0.50) {
        type = 'normale'; // Standard (55%)
    } else if (rand < 0.65) {
        type = 'victime'; // Pleure, fait perdre des points si frappée (15%)
    } else if (rand < 0.77) {
        type = 'fausse-gentille'; // Change d'état en cours de route (12%)
    } else if (rand < 0.85) {
        type = 'ego-boost'; // Nécessite 3 coups pour céder (8%)
    } else if (rand < 0.90) {
        type = 'rage'; // Sort super vite, rapporte gros (5%)
    } else {
        type = 'miroir'; // Masquée par un miroir, cible modifiée (10%)
    }
    
    // 4. Générer le DOM de Valentina
    const mole = document.createElement('div');
    mole.classList.add('valentina', `type-${type}`);
    
    // On ajoute sa structure de visage interne pour le dessin CSS
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
    
    // Ajouts spécifiques selon règles métiers
    if (type === 'miroir') {
        const shield = document.createElement('div');
        shield.classList.add('mirror-shield');
        mole.appendChild(shield);
    }

    if (type === 'victime') {
    const halo = document.createElement('div');
    halo.classList.add('victime-halo');
    mole.appendChild(halo);
    }
    
    container.appendChild(mole);
    
    // 5. Enregistrer son ID de vie
    const moleId = Date.now() + '-' + Math.random();
    activeMoles[moleId] = {
        element: mole,
        type: type,
        holeIndex: holeIndex,
        clicksLeft: type === 'ego-boost' ? 3 : 1, // Ego-boost demande 3 coups
        fakeGentilleState: 'nice', // Etat initial nice
        timeoutIds: []
    };
    
    // Déclenche l'animation de sortie du trou
    setTimeout(() => {
        mole.classList.add('up');
        sayQuote(type);
    }, 50);
    
    // 6. Configurer la disparition du personnage (durée d'apparition aléatoire selon le type)
    let lifespan = 2000; // Par défaut 2.0 sec visible Max
    if (type === 'rage') lifespan = 1800; // Trés dure à attraper !
    if (type === 'ego-boost') lifespan = 2300; // Plus de temps pour lui mettre 3 coups !
    if (type === 'victime') lifespan = 1800;
    
    // Comportement de la fausse gentille qui s'énerve après 700ms
    if (type === 'fausse-gentille') {
        const fakeStateTimeout = setTimeout(() => {
            if (activeMoles[moleId]) {
                activeMoles[moleId].fakeGentilleState = 'mean';
                mole.classList.add('fake-mean');
                // Change de citation immédiat
                sayQuote('fausse-gentille-mean');
            }
        }, 700);
        activeMoles[moleId].timeoutIds.push(fakeStateTimeout);
    }
    
    // Auto-descente dans le trou quand le temps est écoulé
const despawnTimeout = setTimeout(() => {
    if (activeMoles[moleId] && activeMoles[moleId].type === 'rage') {
        loseLife(1);
        createFloatingEffect("Rage ignorée !", window.innerWidth / 2, window.innerHeight / 2, 'negative');
    }

    despawnMole(moleId);
}, lifespan);
    
    activeMoles[moleId].timeoutIds.push(despawnTimeout);
    
    // --- GESTION DU CLIC / TOUCH SUR LA VALENTINA SPÉCIFIQUE ---
    mole.addEventListener('click', (e) => {
        e.stopPropagation(); // Evite le double clic sur le div parent
        handleMoleClick(moleId, e);
    });
    
    // Touchstart compatible avec les écrans tactiles rapides
    mole.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Annule le clic simulé pour éviter le double hit
        e.stopPropagation();
        handleMoleClick(moleId, e);
    });
}

/**
 * Faire parler Valentina instantanément au milieu du jeu
 */
function sayQuote(type) {
    let list = QUOTES_NORMALE;
    if (type === 'victime') list = QUOTES_VICTIME;
    else if (type === 'fausse-gentille') list = QUOTES_FAUSSE_GENTILLE_NICE;
    else if (type === 'fausse-gentille-mean') list = QUOTES_FAUSSE_GENTILLE_MEAN;
    else if (type === 'ego-boost') list = QUOTES_EGO;
    else if (type === 'rage') list = QUOTES_RAGE;
    
    const text = list[Math.floor(Math.random() * list.length)];
    
    quoteText.textContent = `"${text}"`;
    quoteBubble.classList.remove('hidden');
}

/**
 * Faire disparaitre la taupe du trou et la supprimer du manager
 */
function despawnMole(moleId) {
    const moleInfo = activeMoles[moleId];
    if (!moleInfo) return;
    
    const mole = moleInfo.element;
    
    // Animation de descente
    mole.classList.remove('up');
    
    // Supprimer tous ses minuteurs d'état en cours
    moleInfo.timeoutIds.forEach(id => clearTimeout(id));
    
    // Supprimer physiquement après la transition css
    setTimeout(() => {
        if (mole.parentNode) {
            mole.parentNode.removeChild(mole);
        }
        delete activeMoles[moleId];
    }, 200);
}

/**
 * Traiter l'impact de coup sur Valentina
 */
function handleMoleClick(moleId, event) {
    const info = activeMoles[moleId];
    if (!info) return;
    
    const mole = info.element;
    const type = info.type;
    
    if (mole.classList.contains('is-hit')) return;

    // On annule les timers automatiques dès que Valentina est touchée
    info.timeoutIds.forEach(id => clearTimeout(id));
    info.timeoutIds = [];


    // Coordonnées pour l'affichage du chiffre de score flottant
    const rect = mole.getBoundingClientRect();
    const clickX = event.clientX || (event.touches && event.touches[0].clientX) || rect.left + rect.width / 2;
    const clickY = event.clientY || (event.touches && event.touches[0].clientY) || rect.top + rect.height / 3;
    
    // Réaction selon type
    if (type === 'victime') {
        // Taper la victime déclenche sa victimisation, ôte du score mais accélère sa colère !
        score = Math.max(0, score - 1);
        increaseAnger(15);
        loseLife(1);
        playSound('hit-bad');
        createFloatingEffect("-1 Victime !", clickX, clickY, 'negative');
        
        applyRandomHitImage(mole);
        mole.classList.add('is-hit');
        setTimeout(() => {
            despawnMole(moleId);
        }, 750);
        
    } else if (type === 'ego-boost') {
        info.clicksLeft--;
        
        if (info.clicksLeft > 0) {
            // Pas encore mort ! Secousse et flash
            playSound('hit');
            applyRandomHitImage(mole);
            mole.classList.add('is-hit');
            setTimeout(() => {
                mole.classList.remove('is-hit');
                mole.style.backgroundImage = "";
            }, 350);
            
            createFloatingEffect(`裂 ${info.clicksLeft} !`, clickX, clickY, 'text');
        } else {
            // Vaincu au bout de 3 coups !
            score += 3;
            increaseAnger(25);
            playSound('hit-rage');
            createFloatingEffect("+3 Ego Brisé !", clickX, clickY, 'positive');
            
            applyRandomHitImage(mole);
            mole.classList.add('is-hit');
            setTimeout(() => {
                despawnMole(moleId);
            }, 750);
        }
        
    } else {
        // Mode Standard / Miroir / Rage / Fausse gentille
        let earnedPoints = 1;
        let earnedAnger = 10;
        let soundStr = 'hit';
        let feedbackText = '+1';
        
        if (type === 'rage') {
            earnedPoints = 5;
            earnedAnger = 30;
            soundStr = 'hit-rage';
            feedbackText = '+5 RAGE 💢';
        } else if (type === 'miroir') {
            earnedPoints = 2;
            earnedAnger = 15;
            soundStr = 'shatter';
            feedbackText = '+2 Miroir Cassé ! 🪞';
            
            // Masquer le miroir en premier
            const sh = mole.querySelector('.mirror-shield');
            if (sh) sh.style.display = 'none';
        } else if (type === 'fausse-gentille') {
            if (info.fakeGentilleState === 'mean') {
                earnedPoints = 2; // Taper quand elle s'est énervée rapporte plus !
                earnedAnger = 20;
                soundStr = 'hit-rage';
                feedbackText = '+2 Cynisme dénoncé !';
            } else {
                earnedPoints = 1;
                earnedAnger = 10;
                feedbackText = '+1 Touche tactile';
            }
        }
        
        score += earnedPoints;
        increaseAnger(earnedAnger);
        playSound(soundStr);
        createFloatingEffect(feedbackText, clickX, clickY, 'positive');
        
        applyRandomHitImage(mole);
        mole.classList.add('is-hit');
        setTimeout(() => {
            despawnMole(moleId);
        }, 750);
    }
    
    // Actualisation du score affiché
    curScoreEl.textContent = score;
    speedUpGame();
}

/**
 * Créer un texte flottant dynamique au point d'impact
 */
function createFloatingEffect(text, x, y, styleClass) {
    const floater = document.createElement('div');
    floater.classList.add('score-floating', styleClass);
    floater.textContent = text;
    
    // Position dans la zone parente absolue
    floater.style.left = `${x - 20}px`;
    floater.style.top = `${y - 20}px`;
    
    document.body.appendChild(floater);
    
    // Suppression à la fin de l'animation CSS
    setTimeout(() => {
        floater.remove();
    }, 800);
}

/**
 * Faire monter la jauge de colère vers le boss ultime
 */
function increaseAnger(amount) {
    if (isBossPhase) return;
    
    angerLevel = Math.min(100, angerLevel + amount);
    angerProgressEl.style.width = `${angerLevel}%`;
    
    if (angerLevel >= 100) {
        triggerBossStage();
    }
}

// --- LOGIQUE DE COMBAT DE BOSS (CHAMPIONNAT FINAL COCHON D'INDE) ---

/**
 * Lancer la phase de boss ultime de Valentina sous forme de Cochon d'Inde Géant
 */
function triggerBossStage() {
    isBossPhase = true;
    quoteBubble.classList.add('hidden');
    
    // Arrêter tous les spawns de Valentinas normales et supprimer
    if (moleTimer) clearInterval(moleTimer);
    for (let key in activeMoles) {
        despawnMole(key);
    }
    
    // Transition d'écran dans le jeu : masque l'ancienne grille et affiche le boss
    gridStage.classList.remove('active');
    bossStage.classList.add('active');
    
    // Initialisation vie boss
    bossHP = 100;
    bossHealthProgress.style.width = '100%';
    bossHpPercentage.textContent = bossHP;
    
    playSound('hit-rage');
    
    // Petite secousse de la fenêtre d'entrée
    playScreen.classList.add('screen-shocked');
    setTimeout(() => {
        playScreen.classList.remove('screen-shocked');
    }, 1000);

    bossTimeLeft = 10;

    bossTimer = setInterval(() => {
        bossTimeLeft--;

        createFloatingEffect(`${bossTimeLeft}`, window.innerWidth / 2, 120, 'text');

        if (bossTimeLeft <= 0) {
            clearInterval(bossTimer);

            if (bossHP > 0) {
                triggerGameOver();
            }
        }
    }, 1000);
}

// Tap frénétique sur le gros Cochon d'Inde
bossCharacter.addEventListener('click', (e) => {
    e.stopPropagation();
    handleBossHit(e);
});

bossCharacter.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleBossHit(e);
});

/**
 * Gère une torgnole au cochon d'inde géant
 */
function handleBossHit(event) {
    if (!isGameRunning || !isBossPhase) return;
    if (bossCharacter.classList.contains('boss-defeated')) return;
    // Réduire sa barre de vie de 4% par click (25 taps rapides nécessaires !)
    bossHP = Math.max(0, bossHP - 4);
    bossHealthProgress.style.width = `${bossHP}%`;
    bossHpPercentage.textContent = bossHP;
    
    // Sons de tam-tam thud d'impact
    playSound('boss-hit');
    
    // Effet visuel choc : Shake sur le boss et flash
    bossCharacter.style.animation = 'none';
    // Force le recomposition moteur pour relancer l'animation
    void bossCharacter.offsetWidth;
    bossCharacter.style.animation = 'hitShakeGiant 0.12s ease-out';
    
    // Secousse légère de l'écran principal
    playScreen.classList.add('screen-shocked');
    setTimeout(() => {
        playScreen.classList.remove('screen-shocked');
    }, 100);
    
    // Trouver l'origine du tap
    const rect = bossCharacter.getBoundingClientRect();
    const touchX = event.clientX || (event.touches && event.touches[0].clientX) || rect.left + rect.width / 2;
    const touchY = event.clientY || (event.touches && event.touches[0].clientY) || rect.top + rect.height / 2;
    
    // Choix d'une insulte/phrase de Valentina pour le flottant
    const phraseChance = Math.random();
    if (phraseChance < 0.35) {
        const randomPhrase = BOSS_HURT_PHRASES[Math.floor(Math.random() * BOSS_HURT_PHRASES.length)];
        createFloatingEffect(randomPhrase, touchX, touchY, 'text');
    } else {
        createFloatingEffect("-4% Ego !", touchX, touchY, 'negative');
    }
    
    // Augmente légèrement le score du joueur en récompense des taps
    score += 1;
    curScoreEl.textContent = score;
    
    // Si la vie est épuisée : Gagné !
    if (bossHP <= 0) {
         completeBossRound();
    }
}

/**
 * Victoire et écran de statistiques
 */
 function completeBossRound() {
     if (!isBossPhase) return;

     isBossPhase = false;

     if (bossTimer) {
         clearInterval(bossTimer);
         bossTimer = null;
     }

     playSound('defeat-boss');

     bossCharacter.classList.add('boss-defeated');

     const bonus = 10 * level;
     score += bonus;
     curScoreEl.textContent = score;

     playerLives = Math.min(3, playerLives + 1);
     updateLivesDisplay();

     createFloatingEffect(
         `+${bonus} Boss humilié !`,
         window.innerWidth / 2,
         window.innerHeight / 2,
         'positive'
     );

     setTimeout(() => {
         level++;
         updateLevelDisplay();

         angerLevel = 0;
         bossHP = 100;
         bossTimeLeft = Math.max(6, 10 - Math.floor(level / 2));

         angerProgressEl.style.width = '0%';
         bossHealthProgress.style.width = '100%';
         bossHpPercentage.textContent = bossHP;

         bossCharacter.classList.remove('boss-defeated');
         bossCharacter.style.animation = '';
         bossCharacter.style.opacity = '';
         bossCharacter.style.transform = '';

         bossStage.classList.remove('active');
         gridStage.classList.add('active');

         quoteBubble.classList.add('hidden');

         createFloatingEffect(
             `NIVEAU ${level}`,
             window.innerWidth / 2,
             120,
             'text'
         );

         spawnRate = Math.max(350, 1200 - level * 90);

         startMoleTimer();
     }, 1200);
 }


function triggerVictory() {
    isGameRunning = false;
    isBossPhase = false;
    
    playSound('defeat-boss');
    
    // Lance la mélodie de fête
    setTimeout(() => {
        playSound('victory');
    }, 600);
    
    // Sauvegarder record
    if (score > highestScore) {
        highestScore = score;
        localStorage.setItem('tap_valentina_best', highestScore);
        bestScoreEl.textContent = highestScore;
    }
    
    // Affichage des scores
    finalScoreEl.textContent = score;
    
    // Diagnostic du toxique-o-mètre humoristique
    let rating = "Victime Inoffensive 🕊️";
    if (score > 85) {
        rating = "Génie Anti-Toxique Suprême 👑 (Vous avez sauvé l'agence !)";
    } else if (score > 60) {
        rating = "Spécialiste en Contrôle d'Ego 🛡️ (Un pro du recadrage!)";
    } else if (score > 35) {
        rating = "Pacificateur Moyen de Bureau 🤝 (Peut mieux faire !)";
    } else {
        rating = "Victime Débutante Professionnelle 😢 (Trop sensible !)";
    }
    toxicityRatingEl.textContent = rating;

    endFace.className = 'valentina type-wounded';

    victoryBanner.textContent = "VICTOIRE !";
    victoryTitle.textContent = "Valentina s’effondre en larmes";
    victoryQuote.textContent = "“Vous êtes tous méchants… je disais ça pour aider…”";
    
    // Changement d'écran fini
    switchScreen(playScreen, victoryScreen);

    if (bossTimer) clearInterval(bossTimer);
}

//ecran de game over


// Ajout d'un systeme de vie.

let playerLives = 3;

function loseLife(amount = 1) {
    playerLives = Math.max(0, playerLives - amount);

    updateLivesDisplay();

    createFloatingEffect(`-${amount} ❤️`, window.innerWidth / 2, window.innerHeight / 2, 'negative');

    if (playerLives <= 0) {
        triggerGameOver();
    }
}

//Version avec une possibilité de perdre

function triggerGameOver() {
    isGameRunning = false;
    isBossPhase = false;

    if (moleTimer) clearInterval(moleTimer);
    if (bossTimer) clearInterval(bossTimer);

    for (let key in activeMoles) {
        despawnMole(key);
    }

    quoteBubble.classList.add('hidden');

    finalScoreEl.textContent = score;
    toxicityRatingEl.textContent = "Valentina a repris le contrôle 😈";

    endFace.className = 'valentina type-gameover';

    victoryBanner.textContent = "DÉFAITE !";
    victoryTitle.textContent = "Valentina triomphe";
    victoryQuote.textContent = "“Je savais que vous n’étiez pas à mon niveau.”";

    switchScreen(playScreen, victoryScreen);
}


function updateLivesDisplay() {
    if (!livesDisplayEl) return;

    const fullHearts = "❤️".repeat(Math.max(0, playerLives));
    const emptyHearts = "🖤".repeat(Math.max(0, 3 - playerLives));

    livesDisplayEl.textContent = fullHearts + emptyHearts;
}



function updateLevelDisplay() {
    if (!levelDisplayEl) return;
    levelDisplayEl.textContent = level;
}
