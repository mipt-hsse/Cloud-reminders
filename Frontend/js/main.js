// Элементы
const guestView = document.getElementById('guest-view');
const userView = document.getElementById('user-view');
const signupModal = document.getElementById('signup-modal');
const closeSignup = document.getElementById('close-signup');
const loginBtn = document.querySelector('.login-btn');
const signupBtn = document.querySelector('.signup-btn');
const exitIcon = document.getElementById('icon-exit');
const signupForm = document.getElementById('signup-form');

// Log in — сразу в профиль (для демо)
loginBtn?.addEventListener('click', () => {
  guestView.style.display = 'none';
  userView.classList.add('visible');
});

// Sign Up — показать модалку
signupBtn?.addEventListener('click', () => {
  signupModal.style.display = 'flex';
});

// Закрыть модалку
closeSignup?.addEventListener('click', () => {
  signupModal.style.display = 'none';
});

// Клик вне модалки — закрыть
window.addEventListener('click', (e) => {
  if (e.target === signupModal) {
    signupModal.style.display = 'none';
  }
});

// Отправка формы регистрации
signupForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('fullname').value.split(' ')[0] || 'Пользователь';
  // Имитация регистрации
  signupModal.style.display = 'none';
  guestView.style.display = 'none';
  userView.classList.add('visible');
  // Можно обновить имя в профиле, если нужно
});

// Выход из профиля по иконке
exitIcon?.addEventListener('click', () => {
  userView.classList.remove('visible');
  guestView.style.display = 'block';
});
