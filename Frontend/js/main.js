// === ЭЛЕМЕНТЫ DOM ===
const guestView = document.getElementById('guest-view');
const userView = document.getElementById('user-view');
const signupModal = document.getElementById('signup-modal');
const loginModal = document.getElementById('login-modal');
const settingsModal = document.getElementById('settings-modal');

const signupBtn = document.querySelector('.signup-btn');
const loginBtn = document.querySelector('.login-btn');
const settingsBtn = document.querySelector('.setting-btn');
const exitIcon = document.getElementById('logout-btn');

const closeSignup = document.getElementById('close-signup');
const closeLogin = document.getElementById('close-login');
const closeSettings = document.getElementById('close-settings');

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const settingsForm = document.getElementById('settings-form');

const avatarUpload = document.getElementById('avatar-upload');
const avatarPreview = document.getElementById('avatar-preview');

// === МОДАЛЬНЫЕ ОКНА: ОТКРЫТИЕ ===
signupBtn?.addEventListener('click', () => {
  signupModal.style.display = 'flex';
});

loginBtn?.addEventListener('click', () => {
  loginModal.style.display = 'flex';
});

settingsBtn?.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
  loadProfileData();
});

// === ЗАКРЫТИЕ МОДАЛОК ПО КРЕСТИКУ ===
closeSignup?.addEventListener('click', () => {
  signupModal.style.display = 'none';
});

closeLogin?.addEventListener('click', () => {
  loginModal.style.display = 'none';
});

closeSettings?.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

// === ЗАКРЫТИЕ ПО КЛИКУ ВНЕ ОКНА ===
window.addEventListener('click', (e) => {
  if (e.target === signupModal) signupModal.style.display = 'none';
  if (e.target === loginModal) loginModal.style.display = 'none';
  if (e.target === settingsModal) settingsModal.style.display = 'none';
});

// === ВХОД И РЕГИСТРАЦИЯ (ИМИТАЦИЯ) ===
signupForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  signupModal.style.display = 'none';
  guestView.style.display = 'none';
  userView.style.display = 'flex';
});

loginForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  loginModal.style.display = 'none';
  guestView.style.display = 'none';
  userView.style.display = 'flex';
});

// === ВЫХОД ИЗ ПРОФИЛЯ ===
exitIcon?.addEventListener('click', () => {
  userView.style.display = 'none';
  guestView.style.display = 'block';
});

// === ДОБАВЛЕНИЕ ДОСКИ ===
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

// === ЗАГРУЗКА АВАТАРКИ ===

avatarUpload?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (event) => {
      avatarPreview.src = event.target.result;
      avatarPreview.style.display = 'block';
      document.querySelector('.avatar-icon').style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    alert('Пожалуйста, выберите изображение.');
  }
});

// === ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ ===
function loadProfileData() {
  const saved = localStorage.getItem('profileData');
  const data = saved
    ? JSON.parse(saved)
    : {
      username: 'veronika_i',
      email: 'veronika@example.com',
      firstName: 'Вероника',
      lastName: 'Иванова',
      avatar: null,
    };

  document.getElementById('username').value = data.username;
  document.getElementById('email').value = data.email;
  document.getElementById('firstName').value = data.firstName;
  document.getElementById('lastName').value = data.lastName;

  if (data.avatar) {
    avatarPreview.src = data.avatar;
    avatarPreview.style.display = 'block';
    document.querySelector('.avatar-icon').style.display = 'none';
  } else {
    avatarPreview.style.display = 'none';
    document.querySelector('.avatar-icon').style.display = 'block';
  }
}

// === ВАЛИДАЦИЯ ФОРМЫ НАСТРОЕК ===
function validateForm() {
  let isValid = true;
  const fields = ['username', 'email', 'firstName', 'lastName'];

  fields.forEach((id) => {
    const input = document.getElementById(id);
    const group = input.closest('.form-group');
    const error = group.querySelector('.error-message');
    const value = input.value.trim();

    group.classList.remove('error');
    if (error) error.textContent = '';

    if (!value) {
      group.classList.add('error');
      if (error) error.textContent = 'Это поле обязательно';
      isValid = false;
    } else if (id === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
      group.classList.add('error');
      if (error) error.textContent = 'Некорректный email';
      isValid = false;
    }
  });

  return isValid;
}

// === СОХРАНЕНИЕ ПРОФИЛЯ ===
settingsForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const data = {
    username: document.getElementById('username').value.trim(),
    email: document.getElementById('email').value.trim(),
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    avatar: avatarPreview.style.display === 'none' ? null : avatarPreview.src,
  };

  localStorage.setItem('profileData', JSON.stringify(data));

  // Обновляем имя в сайдбаре
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) {
    userNameEl.textContent = `${data.firstName} ${data.lastName}`;
  }

  alert('✅ Профиль успешно обновлён!');
  settingsModal.style.display = 'none';
});