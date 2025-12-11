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


// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentAvatarFile = null; // Добавляем глобальную переменную для хранения файла аватарки

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ DJANGO ===
window.showAuthenticatedView = function(userData) {
  const guestView = document.getElementById('guest-view');
  const userView = document.getElementById('user-view');
  
  if (guestView && userView) {
    guestView.style.display = 'none';
    userView.style.display = 'flex';
    
    // Обновляем имя пользователя
    updateUserName(userData);
    
    // Обновляем аватар
    updateUserAvatar(userData.avatar);
  }
};

// Функция для обновления имени пользователя
function updateUserName(userData) {
  const userNameEl = document.querySelector('.user-name');
  if (!userNameEl) return;
  
  let displayName;
  
  if (userData.firstName && userData.lastName) {
    displayName = `${userData.firstName} ${userData.lastName}`;
  } else if (userData.firstName) {
    displayName = userData.firstName;
  } else if (userData.lastName) {
    displayName = userData.lastName;
  } else {
    displayName = userData.username || 'Пользователь';
  }
  
  userNameEl.textContent = displayName;
}

// === ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ИМЕНИ В САЙДБАРЕ ===
function updateSidebarName(data) {
  const userNameEl = document.querySelector('.user-name');
  if (!userNameEl) return;
  
  let displayName;
  
  if (data.firstName && data.lastName) {
    displayName = `${data.firstName} ${data.lastName}`;
  } else if (data.firstName) {
    displayName = data.firstName;
  } else if (data.lastName) {
    displayName = data.lastName;
  } else {
    displayName = data.username || 'Пользователь';
  }
  
  userNameEl.textContent = displayName;
}

// === ФУНКЦИИ ДЛЯ ВЫХОДА ===
window.initializeLogoutHandlers = function() {
  const logoutBtn = document.getElementById('logout-btn');
  
  logoutBtn?.addEventListener('click', function(e) {
    e.preventDefault();
    window.performLogout();
  });
};

window.performLogout = function() {
  setTimeout(() => {window.showLogoutLoading();
  
  // Создаем форму для выхода
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = window.DJANGO_DATA.urls.logout;
  form.style.display = 'none';
  
  // Добавляем CSRF токен
  const csrfInput = document.createElement('input');
  csrfInput.type = 'hidden';
  csrfInput.name = 'csrfmiddlewaretoken';
  csrfInput.value = window.DJANGO_DATA.csrfToken;
  
  form.appendChild(csrfInput);
  document.body.appendChild(form);
  
  // Отправляем форму
  form.submit();},100)
  
};

window.showLogoutLoading = function() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.classList.add('loading');
    logoutBtn.style.pointerEvents = 'none';
  }
};

window.hideLogoutLoading = function() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.classList.remove('loading');
    logoutBtn.style.pointerEvents = 'auto';
  }
};


// === ОБРАБОТЧИКИ ФОРМ  ===
signupForm?.addEventListener('submit', function(e) {
  // Форма отправится через Django, можно добавить индикатор загрузки
  const submitBtn = this.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Регистрация...';
    submitBtn.disabled = true;
  }
});

loginForm?.addEventListener('submit', function(e) {
  const submitBtn = this.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = 'Вход...';
    submitBtn.disabled = true;
  }
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
    currentAvatarFile = file;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const avatarPreview = document.getElementById('avatar-preview');
      const avatarIcon = document.querySelector('.avatar-icon');
      
      if (avatarPreview && avatarIcon) {
        avatarPreview.src = event.target.result;
        avatarPreview.style.display = 'block';
        avatarIcon.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  }
});


async function updateProfileOnServer(profileData) {
  try {
    const response = await fetch('/api/profile/update/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.DJANGO_DATA.csrfToken,
      },
      body: JSON.stringify(profileData)
    });
    
    if (response.ok) {
      console.log('Профиль обновлен на сервере !!');
    } else {
      console.error('Ошибка обновления профиля на сервере');
    }
  } catch (error) {
    console.error('Ошибка при отправке данных:', error);
  }
}
// Функция для обновления данных в сайдбаре
function updateSidebarData(data) {
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) {
    let displayName;
    
    if (data.firstName && data.lastName) {
      displayName = `${data.firstName} ${data.lastName}`;
    } else if (data.firstName) {
      displayName = data.firstName;
    } else if (data.lastName) {
      displayName = data.lastName;
    } else {
      displayName = data.username;
    }
    
    userNameEl.textContent = displayName;
  }
  
  updateSidebarAvatar(data.avatar);
}
// === ОТПРАВКА ДАННЫХ НА СЕРВЕР ===
async function saveProfileToServer(formData) {
  try {
    const profileUrl = window.DJANGO_DATA.urls.profile;
    
    const response = await fetch(profileUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest', // Помечаем как AJAX запрос
      },
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, data: result };
    } else {
      const errorText = await response.text();
      console.error('Server error:', errorText);
      return { 
        success: false, 
        error: `Ошибка сервера: ${response.status}` 
      };
    }
  } catch (error) {
    console.error('Network error:', error);
    return { 
      success: false, 
      error: 'Сетевая ошибка: ' + error.message 
    };
  }
}


// === ВАЛИДАЦИЯ ФОРМЫ НАСТРОЕК ===
function validateForm() {
 let isValid = true;
  
  // Проверяем только обязательные поля
  const requiredFields = ['username', 'email'];
  const allFields = ['username', 'email', 'firstName', 'lastName'];

  // Сначала очищаем все ошибки
  allFields.forEach((id) => {
    const input = document.getElementById(id);
    const group = input.closest('.form-group');
    const error = group.querySelector('.error-message');
    
    group.classList.remove('error');
    if (error) error.textContent = '';
  });

  // Проверяем обязательные поля
  requiredFields.forEach((id) => {
    const input = document.getElementById(id);
    const group = input.closest('.form-group');
    const error = group.querySelector('.error-message');
    const value = input.value.trim();

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
// ==========================================
// 1. УНИВЕРСАЛЬНЫЕ ФУНКЦИИ ОБНОВЛЕНИЯ UI
// ==========================================

// Функция обновляет аватар ВЕЗДЕ (в сайдбаре, в шапке, в настройках)
function updateAllAvatars(avatarUrl) {
  // Находим все возможные места, где может быть аватар
  const avatarsToUpdate = [
    document.getElementById('sidebar-avatar'),      // Сайдбар
    document.getElementById('avatar-preview'),      // Превью в настройках
    document.querySelector('.user-avatar img')      // Аватар в шапке (если есть тег img)
  ];
  
  // Элементы-заглушки (иконки), которые надо скрыть, если есть фото
  const iconsToHide = document.querySelectorAll('.account-icon, .avatar-icon');
  
  // Проверяем, есть ли валидный URL аватара
  const hasCustomAvatar = avatarUrl && 
                          avatarUrl !== '' && 
                          avatarUrl !== 'undefined' && 
                          avatarUrl !== 'null' &&
                          !avatarUrl.includes('default');

  if (hasCustomAvatar) {
    // 1. Устанавливаем картинку всем элементам img
    avatarsToUpdate.forEach(img => {
      if (img) {
        img.src = avatarUrl;
        img.style.display = 'block';
      }
    });

    // 2. Добавляем класс родителям (для CSS стилей)
    document.querySelectorAll('.user-avatar').forEach(el => el.classList.add('has-avatar'));

    // 3. Скрываем иконки-заглушки
    iconsToHide.forEach(icon => {
      if (icon) icon.style.display = 'none';
    });
    
  } else {
    // Если аватара нет - возвращаем заглушки
    avatarsToUpdate.forEach(img => {
      if (img) img.style.display = 'none';
    });
    
    document.querySelectorAll('.user-avatar').forEach(el => el.classList.remove('has-avatar'));
    
    iconsToHide.forEach(icon => {
      if (icon) icon.style.display = 'block';
    });
  }
}

// Функция обновляет имя ВЕЗДЕ (в сайдбаре, в приветствии)
function updateAllUserNames(data) {
  // Собираем имя из любых форматов (snake_case или camelCase)
  const fName = data.firstName || data.first_name || '';
  const lName = data.lastName || data.last_name || '';
  const username = data.username || '';
  
  let displayName;
  
  if (fName || lName) {
    displayName = `${fName} ${lName}`.trim();
  } else {
    displayName = username || 'Пользователь';
  }

  // Находим все элементы, куда нужно вставить имя (обычно это класс .user-name)
  // Используем querySelectorAll, чтобы обновить и в сайдбаре, и в шапке
  const nameElements = document.querySelectorAll('.user-name');
  nameElements.forEach(el => {
    el.textContent = displayName;
  });
}

// Функция загружает данные В ФОРМУ настроек при открытии
function loadProfileData() {
  if (!window.DJANGO_DATA?.user) {
    console.error('Нет данных пользователя');
    return;
  }

  const user = window.DJANGO_DATA.user;
  
  // Безопасное получение значений (учитываем и camelCase и snake_case)
  const username = user.username || '';
  const email = user.email || '';
  const firstName = user.firstName || user.first_name || '';
  const lastName = user.lastName || user.last_name || '';
  const avatar = user.avatar_url || user.avatar || '';

  // Заполняем инпуты
  const inputs = {
    'username': username,
    'email': email,
    'firstName': firstName,
    'lastName': lastName
  };

  for (const [id, value] of Object.entries(inputs)) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  // Обновляем превью аватара в форме
  updateAllAvatars(avatar);
}

// ==========================================
// 2. ОБРАБОТЧИК СОХРАНЕНИЯ ФОРМЫ
// ==========================================

settingsForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (typeof validateForm === 'function' && !validateForm()) {
    return;
  }

  const saveBtn = settingsForm.querySelector('.save-btn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Сохранение...';
  saveBtn.disabled = true;

  try {
    const formData = new FormData();
    
    // Собираем данные
    formData.append('username', document.getElementById('username').value.trim());
    formData.append('email', document.getElementById('email').value.trim());
    formData.append('first_name', document.getElementById('firstName').value.trim()); // Важно: snake_case для Django
    formData.append('last_name', document.getElementById('lastName').value.trim());   // Важно: snake_case для Django
    
    if (currentAvatarFile) {
      formData.append('avatar', currentAvatarFile);
    }
    
    // Токен
    const csrfToken = window.DJANGO_DATA?.csrfToken || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (csrfToken) formData.append('csrfmiddlewaretoken', csrfToken);

    // Отправка
    const result = await saveProfileToServer(formData);
    
    if (result.success) {
      // === КЛЮЧЕВОЙ МОМЕНТ ОБНОВЛЕНИЯ ===
      
      // 1. Получаем свежие данные от сервера
      // Сервер обычно возвращает { user: { username: "...", avatar_url: "..." } }
      const newData = result.data.user;
      
      console.log('Server updated data:', newData);

      // 2. Нормализуем данные для нашего приложения
      // Собираем единый объект, чтобы не путаться в snake_case/camelCase
      const unifiedData = {
        username: newData.username,
        email: newData.email,
        firstName: newData.first_name, // Берем из ответа сервера
        lastName: newData.last_name,   // Берем из ответа сервера
        avatar: newData.avatar_url || newData.avatar // Берем URL аватара
      };

      // 3. Обновляем ГЛОБАЛЬНЫЙ объект данных
      // Это нужно, чтобы при следующем открытии модалки данные не "прыгнули" назад
      if (window.DJANGO_DATA) {
        window.DJANGO_DATA.user = {
          ...window.DJANGO_DATA.user,
          ...unifiedData
        };
      }

      // 4. Мгновенно обновляем интерфейс
      updateAllUserNames(unifiedData); // Обновит текст имени везде
      updateAllAvatars(unifiedData.avatar); // Обновит картинку везде

      // 5. Закрываем окно
      setTimeout(() => {
        settingsModal.style.display = 'none';
        // Сброс файла
        currentAvatarFile = null;
      }, 50);
      
    } else {
      alert('Ошибка: ' + (result.error || 'Не удалось сохранить'));
    }
    
  } catch (error) {
    console.error(error);
    alert('Произошла ошибка при сохранении');
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
});