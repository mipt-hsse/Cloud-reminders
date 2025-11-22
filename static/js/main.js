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

// Функция для обновления аватара
function updateUserAvatar(avatarUrl) {
  const userAvatar = document.querySelector('.user-avatar');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const accountIcon = userAvatar?.querySelector('.account-icon');
  
  if (!userAvatar || !sidebarAvatar) return;
  
  // Проверяем есть ли реальный аватар
  const hasCustomAvatar = avatarUrl && 
                         avatarUrl !== '' && 
                         avatarUrl !== 'undefined' &&
                         !avatarUrl.includes('default_avatar');
  
  if (hasCustomAvatar) {
    sidebarAvatar.src = avatarUrl;
    sidebarAvatar.style.display = 'block';
    userAvatar.classList.add('has-avatar');
    
    // Скрываем иконку
    if (accountIcon) {
      accountIcon.style.display = 'none';
    }
  } else {
    sidebarAvatar.style.display = 'none';
    userAvatar.classList.remove('has-avatar');
    
    // Показываем иконку
    if (accountIcon) {
      accountIcon.style.display = 'block';
    }
  }
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

function updateUserAvatar(avatarUrl) {
  const userAvatar = document.querySelector('.user-avatar');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const accountIcon = userAvatar?.querySelector('.account-icon');
  
  if (!userAvatar || !sidebarAvatar) {
    console.error('Элементы аватара не найдены');
    return;
  }
  
  const hasCustomAvatar = avatarUrl && 
                         avatarUrl !== '' && 
                         avatarUrl !== 'undefined' &&
                         !avatarUrl.includes('default_avatar');
  
  if (hasCustomAvatar) {
    sidebarAvatar.src = avatarUrl;
    sidebarAvatar.style.display = 'block';
    userAvatar.classList.add('has-avatar');
    
    if (accountIcon) {
      accountIcon.style.display = 'none';
    }
    
    // Также обновляем превью в настройках, если окно открыто
    const avatarPreview = document.getElementById('avatar-preview');
    const avatarIconSettings = document.querySelector('.avatar-icon');
    if (avatarPreview && avatarIconSettings) {
      avatarPreview.src = avatarUrl;
      avatarPreview.style.display = 'block';
      avatarIconSettings.style.display = 'none';
    }
  } else {
    console.log('Сбрасываем аватар к иконке по умолчанию');
    sidebarAvatar.style.display = 'none';
    userAvatar.classList.remove('has-avatar');
    
    if (accountIcon) {
      accountIcon.style.display = 'block';
    }
  }
}


window.showGuestView = function() {
  const guestView = document.getElementById('guest-view');
  const userView = document.getElementById('user-view');
  
  if (guestView && userView) {
    guestView.style.display = 'block';
    userView.style.display = 'none';
  }
};



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

// === ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ ===
function loadProfileData() {
  
  if (!window.DJANGO_DATA?.user) {
    console.error('Данные пользователя не найдены в DJANGO_DATA');
    return;
  }

  const user = window.DJANGO_DATA.user;
  
  // Заполняем форму
  document.getElementById('username').value = user.username || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('firstName').value = user.firstName || '';
  document.getElementById('lastName').value = user.lastName || '';

  // Обновляем аватар
  updateUserAvatar(user.avatar);
  
}
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

// === СОХРАНЕНИЕ ПРОФИЛЯ ===
settingsForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    console.log('Валидация не пройдена');
    return;
  }

  // Показываем загрузку
  const saveBtn = settingsForm.querySelector('.save-btn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Сохранение...';
  saveBtn.disabled = true;

  try {
    // Создаем FormData
    const formData = new FormData();
    // Добавляем данные формы
    const formDataFields = {
      username: document.getElementById('username').value.trim(),
      email: document.getElementById('email').value.trim(),
      first_name: document.getElementById('firstName').value.trim(), 
      last_name: document.getElementById('lastName').value.trim()    
    };
    Object.entries(formDataFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    
    
    // Добавляем аватар, если выбран новый
    if (currentAvatarFile) {
      formData.append('avatar', currentAvatarFile);
    }
    
    // Добавляем CSRF токен
    const csrfToken = window.DJANGO_DATA?.csrfToken || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (csrfToken) {
      formData.append('csrfmiddlewaretoken', csrfToken);
      console.log('CSRF токен добавлен');
    } else {
      console.warn('CSRF токен не найден');
    }


    // Отправляем на сервер
    const result = await saveProfileToServer(formData);
    
    if (result.success) {
      
      // Обновляем интерфейс
      const userData = result.data.user;
      updateUserAvatar(userData.avatar_url);
      // Обновляем глобальные данные
        if (window.DJANGO_DATA.user) {
          window.DJANGO_DATA.user = { ...window.DJANGO_DATA.user, ...userData };
        }

      // Обновляем сайдбар
      updateSidebarName(userData);

      setTimeout(() => {
    settingsModal.style.display = 'none';
  }, 100);
      
    } else {
      alert('❌ Ошибка при сохранении: ' + result.error);
    }
    
  } catch (error) {
    alert('❌ Неизвестная ошибка при сохранении профиля');
  } finally {
    // Восстанавливаем кнопку
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    currentAvatarFile = null;
  }
});