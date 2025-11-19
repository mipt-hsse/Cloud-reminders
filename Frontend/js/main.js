// Элементы
const guestView = document.getElementById('guest-view');
const userView = document.getElementById('user-view');
const signupModal = document.getElementById('signup-modal');
const loginModal = document.getElementById('login-modal');
const signupBtn = document.querySelector('.signup-btn');
const loginBtn = document.querySelector('.login-btn');
const closeSignup = document.getElementById('close-signup');
const closeLogin = document.getElementById('close-login');
const exitIcon = document.getElementById('logout-btn');
const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');

// Показ модальных окон
signupBtn?.addEventListener('click', () => {
  signupModal.style.display = 'flex';
});

loginBtn?.addEventListener('click', () => {
  loginModal.style.display = 'flex';
});

// Закрытие по крестику
closeSignup?.addEventListener('click', () => {
  signupModal.style.display = 'none';
});

closeLogin?.addEventListener('click', () => {
  loginModal.style.display = 'none';
});

// Закрытие по клику вне окна
window.addEventListener('click', (e) => {
  if (e.target === signupModal) signupModal.style.display = 'none';
  if (e.target === loginModal) loginModal.style.display = 'none';
});

// Отправка регистрации
signupForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  // Имитация успешной регистрации
  signupModal.style.display = 'none';
  guestView.style.display = 'none';
  userView.classList.add('visible');
});

// Отправка входа
loginForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  // Имитация успешного входа
  loginModal.style.display = 'none';
  guestView.style.display = 'none';
  userView.classList.add('visible');
});

// Выход из профиля
exitIcon?.addEventListener('click', () => {
  userView.classList.remove('visible');
  guestView.style.display = 'block';
});

function addBoard(title = 'Новая доска') {
  const container = document.querySelector('.boards-container');
  const board = document.createElement('div');
  board.className = 'board-card';
  board.innerHTML = `
    <div class="board-header">
      <div class="settings-icon">
        <svg class="setting-icon">
          <use href="#icon-setting" />
        </svg>
      </div>
    </div>
    <div class="board-title">${title}</div>
  `;
  container.appendChild(board);
}


