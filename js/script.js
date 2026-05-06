const DDD_TO_STATE = {
    11: "São Paulo", 12: "São Paulo", 13: "São Paulo", 14: "São Paulo", 15: "São Paulo", 16: "São Paulo", 17: "São Paulo", 18: "São Paulo", 19: "São Paulo",
    21: "Rio de Janeiro", 22: "Rio de Janeiro", 24: "Rio de Janeiro", 27: "Espírito Santo", 28: "Espírito Santo",
    31: "Minas Gerais", 32: "Minas Gerais", 33: "Minas Gerais", 34: "Minas Gerais", 35: "Minas Gerais", 37: "Minas Gerais", 38: "Minas Gerais",
    41: "Paraná", 42: "Paraná", 43: "Paraná", 44: "Paraná", 45: "Paraná", 46: "Paraná", 47: "Santa Catarina", 48: "Santa Catarina", 49: "Santa Catarina",
    51: "Rio Grande do Sul", 53: "Rio Grande do Sul", 54: "Rio Grande do Sul", 55: "Rio Grande do Sul",
    61: "Distrito Federal", 62: "Goiás", 63: "Tocantins", 64: "Goiás", 65: "Mato Grosso", 66: "Mato Grosso", 67: "Mato Grosso do Sul", 68: "Acre", 69: "Rondônia",
    71: "Bahia", 73: "Bahia", 74: "Bahia", 75: "Bahia", 77: "Bahia", 79: "Sergipe",
    81: "Pernambuco", 82: "Alagoas", 83: "Paraíba", 84: "Rio Grande do Norte", 85: "Ceará", 86: "Piauí", 87: "Pernambuco", 88: "Ceará", 89: "Piauí",
    91: "Pará", 92: "Amazonas", 93: "Pará", 94: "Pará", 95: "Roraima", 96: "Amapá", 97: "Amazonas", 98: "Maranhão", 99: "Maranhão"
};

const PREFIX_COLORS = {
    "1": "#9b59b6", "2": "#3498db", "3": "#e67e22",
    "4": "#1abc9c", "5": "#2ecc71", "6": "#f1c40f",
    "7": "#e74c3c", "8": "#8d00d3", "9": "#16a085"
};

const revealed = new Set();
let allDDDs = [];

const LANGUAGES = ['es', 'en', 'pt'];
let currentLang = 'es';

let isGameMode = false;
let gameDifficulty = 'hard';
let currentTarget = null;
let isWaitingNextTurn = false;

// --- SISTEMA DE AUDIO ---
const sfxSwitch = new Audio('sounds/switch.ogg');
const sfxClick = new Audio('sounds/click.ogg');
const sfxSuccess = new Audio('sounds/success.ogg');
const sfxError = new Audio('sounds/error.ogg');

// Bajar el volumen para que no sean intrusivos
sfxSwitch.volume = 0.15;
sfxClick.volume = 0.05;
sfxSuccess.volume = 0.2;
sfxError.volume = 0.2;

// Función global para reproducir sonido
function playSound(audio) {
    audio.currentTime = 0; // Reinicia el audio para que suene aunque se haga clic muy rápido
    audio.play().catch(e => {
        // Los navegadores bloquean el audio si el usuario no ha interactuado con la página aún.
        // Este catch evita que salgan errores rojos en la consola.
    });
}

function t(key) {
    return UI_TEXT[currentLang][key];
}

function applyLanguage() {
    document.documentElement.lang = currentLang;
    document.title = t('pageTitle');
    document.getElementById('main-title').textContent = t('headerTitle');
    document.getElementById('main-subtitle').textContent = t('headerSubtitle');
    document.getElementById('btn-reveal').textContent = t('revealButton');
    document.getElementById('btn-reset').textContent = t('resetButton');
    document.getElementById('btn-lang').textContent = t('langButton');
    document.getElementById('btn-game').textContent = isGameMode ? t('explorerModeBtn') : t('gameModeBtn');
    document.getElementById('counter-label').textContent = t('counterLabel');
    document.getElementById('game-prompt').textContent = t('findDDD');
    
    if (document.getElementById('diff-title')) {
        document.getElementById('diff-title').textContent = t('diffTitle');
        document.getElementById('btn-easy').textContent = t('btnEasy');
        document.getElementById('btn-hard').textContent = t('btnHard');
    }
}

const W = 800, H = 740;
const svg = d3.select('#map-svg');
const mapContainer = svg.append('g').attr('id', 'map-container');

const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
        mapContainer.attr('transform', event.transform);
    });

svg.call(zoom);

const badgeSize = { w: 22, h: 14 };
const tooltip = document.getElementById('tooltip');

function showTooltip(event, text) {
    tooltip.textContent = text;
    tooltip.style.opacity = 1;
    tooltip.style.left = (event.clientX + 14) + 'px';
    tooltip.style.top = (event.clientY - 28) + 'px';
}

function hideTooltip() {
    tooltip.style.opacity = 0;
}

function updateCounter() {
    document.getElementById('cnt').textContent = revealed.size;
}

function updateBadge(ddd, show) {
    const g = mapContainer.select(`[data-ddd="${ddd}"]`);
    if (g.empty()) return;

    g.select('.ddd-bg')
        .classed('ddd-bg-hidden', !show)
        .classed('ddd-bg-revealed', show);

    const rect = g.select('rect');
    const x = parseFloat(rect.attr('x')) + badgeSize.w / 2;
    const y = parseFloat(rect.attr('y')) + badgeSize.h / 2;

    g.transition().duration(160).ease(d3.easeCubicIn)
        .attr('transform', `translate(${x},${y}) scale(0, 1) translate(${-x},${-y})`)
        .on('end', function () {
            g.select('.ddd-q').style('opacity', show ? 0 : 1);
            g.select('.ddd-num').style('opacity', show ? 1 : 0);

            d3.select(this)
                .transition().duration(160).ease(d3.easeCubicOut)
                .attr('transform', `translate(${x},${y}) scale(1, 1) translate(${-x},${-y})`)
                .on('end', function () {
                    d3.select(this).attr('transform', null);
                });
        });
}

function extractDDD(feature) {
    const props = feature.properties;
    for (const key in props) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('ddd') || lowerKey.includes('code') || lowerKey.includes('name')) {
            const match = String(props[key]).match(/\b([1-9][1-9])\b/);
            if (match && DDD_TO_STATE[match[1]]) return parseInt(match[1], 10);
        }
    }
    const str = JSON.stringify(props);
    const matches = str.match(/\b([1-9][1-9])\b/g);
    if (matches) {
        for (const m of matches) {
            if (DDD_TO_STATE[m]) return parseInt(m, 10);
        }
    }
    return null; 
}

function nextGameTurn() {
    if (!isGameMode) return;
    isWaitingNextTurn = false;
    
    mapContainer.selectAll('.state-path').transition().duration(300).attr('fill', '#2a2e39');
    
    if (gameDifficulty === 'hard') {
        currentTarget = allDDDs[Math.floor(Math.random() * allDDDs.length)];
        document.getElementById('target-ddd').textContent = currentTarget;
    } else {
        const decades = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
        currentTarget = decades[Math.floor(Math.random() * decades.length)];
        document.getElementById('target-ddd').textContent = currentTarget + "x";
    }
}

const GEOJSON_URL = 'https://gist.githubusercontent.com/guilhermeprokisch/080c2cb1bd28e8aca54d114e453c91a4/raw/brazil_phone_area_codes.geojson';

d3.json(GEOJSON_URL).then(function (geojson) {
    const projection = d3.geoMercator().fitSize([W, H], geojson);

    // Centrar mapa
    const currentTranslate = projection.translate();
    projection.translate([currentTranslate[0] + 45, currentTranslate[1]]);
    
    const path = d3.geoPath().projection(projection);

    mapContainer.selectAll('.state-path')
        .data(geojson.features)
        .enter()
        .append('path')
        .attr('class', 'state-path')
        .attr('d', path)
        .attr('fill', d => {
            const ddd = extractDDD(d);
            if (!ddd) return '#333'; 
            const firstDigit = String(ddd).charAt(0);
            return PREFIX_COLORS[firstDigit] || '#555';
        })
        .on('mouseover', function(event, d) {
            if (isGameMode && isWaitingNextTurn) return; 

            const ddd = extractDDD(d);
            if (!ddd) return;

            // En modo fácil, iluminamos toda la macro-región a la vez al pasar el ratón
            if (isGameMode && gameDifficulty === 'easy') {
                const firstDigit = String(ddd).charAt(0);
                mapContainer.selectAll('.state-path')
                    .filter(p => {
                        let pDdd = extractDDD(p);
                        return pDdd && String(pDdd).charAt(0) === firstDigit;
                    })
                    .classed('macro-hover', true);
            } else {
                d3.select(this).classed('macro-hover', true);
            }
        })
        .on('mousemove', function (event, d) {
            if (isGameMode) return; 
            const ddd = extractDDD(d);
            const stateName = DDD_TO_STATE[ddd];
            if (!ddd) return;
            showTooltip(event, `${stateName || t('fallbackRegion')}`);
        })
        .on('mouseout', function (event, d) {
            // Limpiamos el efecto visual al salir del polígono
            mapContainer.selectAll('.state-path').classed('macro-hover', false);
            hideTooltip();
        })
        .on('click', function (event, d) {
            const ddd = extractDDD(d);
            if (!ddd) return;

            if (isGameMode) {
                if (isWaitingNextTurn || document.getElementById('difficulty-modal').style.display === 'flex') return;
                isWaitingNextTurn = true;

                // Al clickar, también forzamos limpiar el hover para que no interfiera con el color de acierto/fallo
                mapContainer.selectAll('.state-path').classed('macro-hover', false);

                let isCorrect = false;
                if (gameDifficulty === 'hard') {
                    isCorrect = (ddd === currentTarget);
                } else {
                    isCorrect = (String(ddd).charAt(0) === currentTarget);
                }

                if (isCorrect) {
                    playSound(sfxSuccess);
                    if (gameDifficulty === 'hard') {
                        d3.select(this).transition().duration(200).attr('fill', '#2ecc71');
                    } else {
                        mapContainer.selectAll('.state-path')
                            .filter(p => {
                                let pDdd = extractDDD(p);
                                return pDdd && String(pDdd).charAt(0) === currentTarget;
                            })
                            .transition().duration(200).attr('fill', '#2ecc71');
                    }
                } else {
                    playSound(sfxError);
                    if (gameDifficulty === 'hard') {
                        mapContainer.selectAll('.state-path')
                            .filter(p => extractDDD(p) === currentTarget)
                            .transition().duration(200).attr('fill', '#e74c3c');
                    } else {
                        mapContainer.selectAll('.state-path')
                            .filter(p => {
                                let pDdd = extractDDD(p);
                                return pDdd && String(pDdd).charAt(0) === currentTarget;
                            })
                            .transition().duration(200).attr('fill', '#e74c3c');
                    }
                }

                setTimeout(nextGameTurn, 1500);
                return;
            }

            // MODO NORMAL
            playSound(sfxClick);
            if (revealed.has(ddd)) {
                revealed.delete(ddd);
                updateBadge(ddd, false);
            } else {
                revealed.add(ddd);
                updateBadge(ddd, true);
            }
            updateCounter();
        });

    geojson.features.forEach(feature => {
        const ddd = extractDDD(feature);
        if (!ddd || allDDDs.includes(ddd)) return;
        
        let centroid = path.centroid(feature);
        if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) {
            try {
                const bounds = path.bounds(feature);
                if (bounds && bounds[0] && bounds[1] && !isNaN(bounds[0][0])) {
                    centroid = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
                } else {
                    return; 
                }
            } catch(e) {
                return; 
            }
        }
        if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;

        allDDDs.push(ddd);

        const posX = centroid[0];
        const posY = centroid[1];

        const g = mapContainer.append('g')
            .attr('class', 'ddd-group')
            .attr('data-ddd', ddd)
            .on('click', function (event) {
                if (isGameMode) return;
                playSound(sfxClick);
                event.stopPropagation();
                const isRevealed = revealed.has(ddd);
                if (isRevealed) revealed.delete(ddd);
                else revealed.add(ddd);
                updateBadge(ddd, !isRevealed);
                updateCounter();
            })
            .on('mousemove', function (event) {
                if (isGameMode) return;
                const stateName = DDD_TO_STATE[ddd];
                showTooltip(event, `${stateName || t('fallbackRegion')}`);
            })
            .on('mouseleave', hideTooltip);

        g.append('rect')
            .attr('class', 'ddd-bg ddd-bg-hidden')
            .attr('x', posX - badgeSize.w / 2)
            .attr('y', posY - badgeSize.h / 2)
            .attr('width', badgeSize.w)
            .attr('height', badgeSize.h)
            .attr('rx', 3).attr('ry', 3);

        g.append('text')
            .attr('class', 'ddd-text ddd-q')
            .attr('font-size', 9)
            .attr('x', posX)
            .attr('y', posY)
            .text('?');

        g.append('text')
            .attr('class', 'ddd-text ddd-num')
            .attr('font-size', 9)
            .attr('x', posX)
            .attr('y', posY)
            .text(ddd);
    });

    document.getElementById('total').textContent = allDDDs.length;

    document.getElementById('btn-reveal').addEventListener('click', () => {
        playSound(sfxClick);
        allDDDs.forEach(ddd => {
            if (!revealed.has(ddd)) {
                revealed.add(ddd);
                updateBadge(ddd, true);
            }
        });
        updateCounter();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        playSound(sfxClick);
        allDDDs.forEach(ddd => {
            if (revealed.has(ddd)) {
                revealed.delete(ddd);
                updateBadge(ddd, false);
            }
        });
        updateCounter();
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });

    document.getElementById('btn-lang').addEventListener('click', () => {
        playSound(sfxSwitch);
        let currentIndex = LANGUAGES.indexOf(currentLang);
        currentLang = LANGUAGES[(currentIndex + 1) % LANGUAGES.length];
        applyLanguage();
    });

    document.getElementById('btn-game').addEventListener('click', () => {
        playSound(sfxClick);
        const banner = document.getElementById('game-banner');
        const counterWrap = document.getElementById('counter-wrap');
        const controls = document.querySelectorAll('#btn-reveal, #btn-reset');

        if (isGameMode) {
            isGameMode = false;
            document.getElementById('difficulty-modal').style.display = 'none';
            document.getElementById('btn-game').textContent = t('gameModeBtn');
            banner.style.display = 'none';
            counterWrap.style.display = 'block';
            controls.forEach(c => c.style.display = 'inline-block');
            
            mapContainer.selectAll('.ddd-group').style('display', 'block');
            isWaitingNextTurn = false;
            currentTarget = null;

            mapContainer.selectAll('.state-path').transition().duration(300).attr('fill', d => {
                const ddd = extractDDD(d);
                if (!ddd) return '#333'; 
                const firstDigit = String(ddd).charAt(0);
                return PREFIX_COLORS[firstDigit] || '#555';
            });
        } else {
            isGameMode = true; 
            document.getElementById('difficulty-modal').style.display = 'flex';
            document.getElementById('btn-game').textContent = t('explorerModeBtn');
            controls.forEach(c => c.style.display = 'none');
            counterWrap.style.display = 'none';
            mapContainer.selectAll('.ddd-group').style('display', 'none');
            svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity); 
        }
    });

    document.getElementById('btn-easy').addEventListener('click', () => {
        playSound(sfxClick);
        startGame('easy');
    });
    
    document.getElementById('btn-hard').addEventListener('click', () => {
        playSound(sfxClick);
        startGame('hard');
    });

    function startGame(difficulty) {
        gameDifficulty = difficulty;
        document.getElementById('difficulty-modal').style.display = 'none';
        document.getElementById('game-banner').style.display = 'block';
        nextGameTurn();
    }

}).catch(err => {
    console.error(t('loadErrorLog'), err);
    alert(t('loadError'));
});

applyLanguage();