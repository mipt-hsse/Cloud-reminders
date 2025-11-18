// Элементы
const guestView = document.getElementById('guest-view');
const userView = document.getElementById('user-view');
const signupModal = document.getElementById('signup-modal');
const closeSignup = document.getElementById('close-signup');
const loginBtn = document.querySelector('.login-btn');
const signupBtn = document.querySelector('.signup-btn');
const exitIcon = document.getElementById('logout-btn');
const signupForm = document.getElementById('signup-form');

// Log in — сразу в профиль (для демо)
//loginBtn?.addEventListener('click', () => {
//  guestView.style.display = 'none';
//  userView.classList.add('visible');
//});

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

// Добавь модалку для входа в HTML (аналогично регистрации)
const loginModal = document.getElementById('login-modal');

// Показать окно входа
loginBtn?.addEventListener('click', () => {
  loginModal.style.display = 'flex';
});

document.getElementById('login-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  // ПОКА ЧТО — имитация входа (как у тебя было)
  loginModal.style.display = 'none';
  guestView.style.display = 'none';
  userView.classList.add('visible');
});

// Обработка формы входа
// document.getElementById('login-form')?.addEventListener('submit', async (e) => {
//   e.preventDefault();
//   const email = document.getElementById('login-email').value;
//   const password = document.getElementById('login-password').value;

//   try {
//     const res = await fetch('/api/auth/login', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email, password })
//     });

//     const data = await res.json();

//     if (res.ok) {
//       // Сохраняем токен
//       localStorage.setItem('authToken', data.token);
//       // Меняем интерфейс
//       guestView.style.display = 'none';
//       userView.classList.add('visible');
//       loginModal.style.display = 'none';

//       // Опционально: подгрузить данные пользователя
//       // updateUserInfo(data.userId);
//     } else {
//       alert(data.error || 'Ошибка входа');
//     }
//   } catch (err) {
//     alert('Ошибка подключения к серверу');
//   }
// });