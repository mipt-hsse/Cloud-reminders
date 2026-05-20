// themes.js — Темы оформления доски

export const THEMES = {
    classic: {
        name: 'Классика',
        boardBg: '#f9f9f9',
        gridMinor: '#ddd',
        gridMajor: '#ccc',
    },
    dark: {
        name: 'Тёмная',
        boardBg: '#1a1a2e',
        gridMinor: '#252544',
        gridMajor: '#303058',
    },
    sky: {
        name: 'Небо',
        boardBg: '#e3f2fd',
        gridMinor: '#bbdefb',
        gridMajor: '#90caf9',
    },
    forest: {
        name: 'Лес',
        boardBg: '#e8f5e9',
        gridMinor: '#c8e6c9',
        gridMajor: '#a5d6a7',
    },
    warm: {
        name: 'Тёплая',
        boardBg: '#fff8e1',
        gridMinor: '#ffecb3',
        gridMajor: '#ffe082',
    },
};

/**
 * Применяет тему к доске.
 * @param {string} themeName - ключ темы из THEMES
 * @param {HTMLElement} boardEl - элемент #sticker-board
 * @param {{ current: string }} currentThemeRef - ссылка на текущую тему
 * @returns {object} объект темы
 */
export function applyTheme(themeName, boardEl, currentThemeRef) {
    const theme = THEMES[themeName] || THEMES.classic;
    if (currentThemeRef) currentThemeRef.current = themeName;
    if (boardEl) boardEl.style.backgroundColor = theme.boardBg;
    return theme;
}
