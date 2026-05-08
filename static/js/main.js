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
window.showAuthenticatedView = function (userData) {
  const guestView = document.getElementById('guest-view');
  const userView = document.getElementById('user-view');

  if (guestView && userView) {
    guestView.style.display = 'none';
    userView.style.display = 'block';

    if (typeof updateAllUserNames === 'function') {
      const unifiedData = {
        username: userData.username,
        firstName: userData.firstName || userData.first_name,
        lastName: userData.lastName || userData.last_name
      };
      updateAllUserNames(unifiedData);
    } else {
      updateSidebarName(userData);
    }

    if (typeof updateAllAvatars === 'function') {
      updateAllAvatars(userData.avatar || userData.avatar_url);
    }
  }
};

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

// === ПОКАЗ ОШИБОК ОТ СЕРВЕРА ===
window.showDjangoError = function (message) {
  if (!message) return;
  if (window.DJANGO_DATA.isRegisterError) {
    const signupModal = document.getElementById('signup-modal');
    if (signupModal) {
      signupModal.style.display = 'flex';
      createErrorBanner(signupModal, message);
      return;
    }
  }
  const loginModal = document.getElementById('login-modal');
  const lowerMsg = message.toLowerCase();
  if (!lowerMsg.includes('регистрац') && loginModal) {
    loginModal.style.display = 'flex';
    createErrorBanner(loginModal, message);
  } else {
    alert(message);
  }
};

// Вспомогательная функция для рисования красной плашки
function createErrorBanner(modal, text) {
  // Если ошибка уже есть — удаляем старую, чтобы не дублировать
  const existingError = modal.querySelector('.server-error-banner');
  if (existingError) existingError.remove();

  const content = modal.querySelector('.modal-content');

  const errorDiv = document.createElement('div');
  errorDiv.className = 'server-error-banner';
  // Стили ошибки
  errorDiv.style.backgroundColor = '#ffebee';
  errorDiv.style.color = '#c62828';
  errorDiv.style.padding = '10px';
  errorDiv.style.borderRadius = '4px';
  errorDiv.style.marginBottom = '15px';
  errorDiv.style.fontSize = '14px';
  errorDiv.style.border = '1px solid #ef9a9a';
  errorDiv.textContent = text;

  // Вставляем ошибку в начало формы (после заголовка)
  const title = content.querySelector('h2');
  if (title) {
    title.insertAdjacentElement('afterend', errorDiv);
  } else {
    content.prepend(errorDiv);
  }
}

// === ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ (То самое, чего не хватало) ===
document.addEventListener('DOMContentLoaded', function () {
  // 1. Проверяем, передал ли Django ошибку через HTML
  if (window.DJANGO_DATA && window.DJANGO_DATA.error) {
    window.showDjangoError(window.DJANGO_DATA.error);
    if (history.replaceState) {
      const mainUrl = window.DJANGO_DATA.urls.dashboard_page || '/';
      history.replaceState(null, null, mainUrl);
    }
  }

  // 2. Инициализация профиля, если нужно
  if (window.DJANGO_DATA && window.DJANGO_DATA.isAuthenticated) {
    // Убедимся, что интерфейс обновлен (на случай кэширования)
    if (typeof window.showAuthenticatedView === 'function') {
      window.showAuthenticatedView(window.DJANGO_DATA.user);
    }
  }
});

// === ФУНКЦИИ ДЛЯ ВЫХОДА ===
window.initializeLogoutHandlers = function () {
  const logoutBtn = document.getElementById('logout-btn');

  logoutBtn?.addEventListener('click', function (e) {
    e.preventDefault();
    window.performLogout();
  });
};

window.performLogout = function () {
  setTimeout(() => {
    window.showLogoutLoading();

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
    form.submit();
  }, 100)

};

window.showLogoutLoading = function () {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.classList.add('loading');
    logoutBtn.style.pointerEvents = 'none';
  }
};

window.hideLogoutLoading = function () {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.classList.remove('loading');
    logoutBtn.style.pointerEvents = 'auto';
  }
};


// === ОБРАБОТЧИКИ ФОРМ (AJAX) ===
signupForm?.addEventListener('submit', async function (e) {
  e.preventDefault();

  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn?.textContent || 'Зарегистрироваться';

  if (submitBtn) {
    submitBtn.textContent = '...';
    submitBtn.disabled = true;
  }

  try {
    const formData = new FormData(this);
    const actionUrl = this.getAttribute('action');
    const csrfToken = window.DJANGO_DATA?.csrfToken || document.querySelector('[name=csrfmiddlewaretoken]')?.value;

    const response = await fetch(actionUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken
      }
    });

    const result = await response.json();

    if (response.ok && result.success) {
      const modal = document.getElementById('signup-modal');
      const content = modal.querySelector('.modal-content');

      content.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i data-lucide="mail-check" class="w-16 h-16 text-[#58a6ff] mx-auto mb-4"></i>
                    <h2 class="text-2xl font-black mb-4">Почти готово!</h2>
                    <p class="text-white/70">Мы отправили письмо на указанный email. Пожалуйста, перейдите по ссылке внутри, чтобы активировать аккаунт.</p>
                </div>
            `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
      const modal = document.getElementById('signup-modal');
      createErrorBanner(modal, result.error || 'Ошибка регистрации');

      if (submitBtn) {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error('Ошибка:', error);
    const modal = document.getElementById('signup-modal');
    createErrorBanner(modal, 'Ошибка соединения с сервером');

    if (submitBtn) {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  }
});

loginForm?.addEventListener('submit', async function (e) {
  e.preventDefault();

  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn?.textContent || 'Войти';
  const formData = new FormData(this);
  const actionUrl = this.getAttribute('action');

  if (submitBtn) {
    submitBtn.textContent = 'Вход...';
    submitBtn.disabled = true;
  }

  try {
    const csrfToken = window.DJANGO_DATA?.csrfToken || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    const response = await fetch(actionUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken
      }
    });

    const result = await response.json();

    if (response.ok && result.success) {
      window.location.reload();
    } else {
      const modal = document.getElementById('login-modal');
      createErrorBanner(modal, result.error || 'Ошибка входа');

      if (submitBtn) {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
      }
    }
  } catch (error) {
    console.error("Ошибка сети:", error);
    const modal = document.getElementById('login-modal');
    createErrorBanner(modal, 'Ошибка соединения с сервером');

    if (submitBtn) {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
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
    } else if (id === 'email' && !/^\S+@\S+$/.test(value)) {
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

function updateAllUserNames(data) {

  const fName = data.firstName || data.first_name || '';
  const lName = data.lastName || data.last_name || '';
  const username = data.username || '';

  let displayName;

  if (fName || lName) {
    displayName = `${fName} ${lName}`.trim();
  } else {
    displayName = username || 'Пользователь';
  }

  const nameElements = document.querySelectorAll('.user-name');
  nameElements.forEach(el => {
    el.textContent = displayName;
  });
}

function loadProfileData() {
  if (!window.DJANGO_DATA?.user) {
    console.error('Нет данных пользователя');
    return;
  }

  const user = window.DJANGO_DATA.user;

  const username = user.username || '';
  const email = user.email || '';
  const firstName = user.firstName || user.first_name || '';
  const lastName = user.lastName || user.last_name || '';
  const avatar = user.avatar_url || user.avatar || '';

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
    formData.append('first_name', document.getElementById('firstName').value.trim());
    formData.append('last_name', document.getElementById('lastName').value.trim());

    if (currentAvatarFile) {
      formData.append('avatar', currentAvatarFile);
    }

    // Токен
    const csrfToken = window.DJANGO_DATA?.csrfToken || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    if (csrfToken) formData.append('csrfmiddlewaretoken', csrfToken);

    // Отправка
    const result = await saveProfileToServer(formData);

    if (result.success) {
      const newData = result.data.user;

      console.log('Server updated data:', newData);

      const unifiedData = {
        username: newData.username,
        email: newData.email,
        firstName: newData.first_name,
        lastName: newData.last_name,
        avatar: newData.avatar_url || newData.avatar
      };
      if (window.DJANGO_DATA) {
        window.DJANGO_DATA.user = {
          ...window.DJANGO_DATA.user,
          ...unifiedData
        };
      }
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
// ==========================================
// 3. ЛОГИКА ДОСОК (СОЗДАНИЕ, РЕДАКТИРОВАНИЕ, ЦВЕТА)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // --- ЛОГИКА ОКНА ПОДЕЛИТЬСЯ ---
  const shareModal = document.getElementById('share-board-modal');
  const closeShareModalBtn = document.getElementById('close-share-board');
  const viewerInput = document.getElementById('viewer-link-input');
  const editorInput = document.getElementById('editor-link-input');

  let boardId = null;

  // 1. Открытие модалки при клике на иконку
  document.querySelectorAll('.board-share-trigger').forEach(trigger => {
    trigger.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation(); // Останавливаем переход внутрь доски

      boardId = trigger.getAttribute('data-id');
      const csrfToken = window.DJANGO_DATA.csrfToken; // Берем токен из вашего объекта

      try {
        // Вызываем API, которое мы создали во views.py
        const url = `${window.DJANGO_DATA.urls.shareApiBase}${boardId}/share_links/`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'X-CSRFToken': csrfToken }
        });

        const data = await response.json();

        if (data.success) {
          viewerInput.value = data.viewer_link;
          editorInput.value = data.editor_link;
          shareModal.style.display = 'flex';

          document.getElementById('invite-search-input').value = '';
          fetchInviteUsers(boardId, '');
        } else {
          alert('Ошибка: ' + data.error);
        }
      } catch (error) {
        console.error('Ошибка получения ссылок:', error);
      }
    });
  });

  // 2. Закрытие модалки
  if (closeShareModalBtn) {
    closeShareModalBtn.addEventListener('click', () => {
      shareModal.style.display = 'none';
      // Сбрасываем текст кнопок при закрытии
      document.querySelectorAll('.copy-link-btn').forEach(btn => btn.innerText = 'Копировать');
    });
  }

  // 3. Копирование ссылок
  document.querySelectorAll('.copy-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const inputEl = document.getElementById(targetId);

      inputEl.select();
      inputEl.setSelectionRange(0, 99999); // Для мобильных

      navigator.clipboard.writeText(inputEl.value).then(() => {
        // Визуальный отклик
        const originalText = btn.innerText;
        btn.innerText = 'Скопировано!';
        setTimeout(() => {
          btn.innerText = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Ошибка копирования: ', err);
      });
    });
  });

  // Закрытие при клике вне модалки (если у вас уже есть общий обработчик, можете это пропустить)
  window.addEventListener('click', (e) => {
    if (e.target === shareModal) {
      shareModal.style.display = 'none';
    }
  });

  let inviteSearchTimeout = null;
  const inviteInput = document.getElementById('invite-search-input');
  const inviteList = document.getElementById('invite-users-list');
  const inviteTitle = document.getElementById('invite-section-title');

  // Поиск пользователей для отправки приглашения
  async function fetchInviteUsers(boardId, query = '') {
    if (!inviteList) return;

    inviteList.innerHTML = '<div class="p-4 text-center text-sm text-white/50">Ищем...</div>';

    try {
      const response = await fetch(`/api/board/${boardId}/invite-search/?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success) {
        if (inviteTitle) inviteTitle.textContent = data.section_title;
        inviteList.innerHTML = '';

        if (data.users.length === 0) {
          inviteList.innerHTML = '<div class="p-4 text-center text-sm text-white/50">Ничего не найдено</div>';
          return;
        }

        data.users.forEach(user => {
          const item = document.createElement('div');
          item.className = 'flex items-center justify-between p-3 hover:bg-[#21262d] transition-colors group cursor-default';

          const avatarHtml = user.avatar_url
            ? `<img src="${user.avatar_url}" class="w-8 h-8 rounded-full object-cover">`
            : `<div class="w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-xs font-bold text-white">${user.full_name.charAt(0).toUpperCase()}</div>`;
          item.innerHTML = `
            <div class="flex items-center gap-3">
                ${avatarHtml}
                <div>
                    <div class="text-sm font-medium text-white">${user.full_name}</div>
                    <div class="text-xs text-white/50">@${user.username}</div>
                </div>
            </div>
            
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button data-user-id="${user.id}" data-role="viewer" class="invite-btn text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white/70 hover:text-white px-2 py-1.5 rounded-lg transition-all font-medium" title="Только просмотр">
                    Читатель
                </button>
                <button data-user-id="${user.id}" data-role="editor" class="invite-btn text-xs bg-[#58a6ff]/20 hover:bg-[#58a6ff] text-[#58a6ff] hover:text-[#010409] px-2 py-1.5 rounded-lg transition-all font-medium" title="Полный доступ">
                    Редактор
                </button>
            </div>
        `;
          inviteList.appendChild(item);
        });

        inviteList.querySelectorAll('.invite-btn').forEach(btn => {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const userId = this.getAttribute('data-user-id');
            const role = this.getAttribute('data-role');
            window.inviteUser(userId, role, this);
          });
        });

      }
    } catch (err) {
      console.error(err);
      inviteList.innerHTML = '<div class="p-4 text-center text-sm text-[#ff7b72]">Ошибка загрузки</div>';
    }
  }

  window.inviteUser = async function (userId, accessLevel, btnElement) {
    if (!boardId) return;

    const originalText = btnElement.innerText;
    btnElement.innerText = '...';
    btnElement.disabled = true;

    try {
      const response = await fetch(`/api/board/${boardId}/add_collaborator/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': window.DJANGO_DATA.csrfToken
        },
        body: JSON.stringify({
          user_id: userId,
          access_level: accessLevel
        })
      });

      const data = await response.json();

      if (data.success) {
        btnElement.style.backgroundColor = '#238636';
        btnElement.style.color = 'white';
        btnElement.innerText = 'Добавлен!';

        setTimeout(() => {
          document.getElementById('invite-search-input').dispatchEvent(new Event('input'));
        }, 800);

      } else {
        alert('Ошибка: ' + data.error);
        btnElement.innerText = originalText;
        btnElement.disabled = false;
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка сети при добавлении пользователя');
      btnElement.innerText = originalText;
      btnElement.disabled = false;
    }
  }

  inviteInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(inviteSearchTimeout);

    inviteList.innerHTML = '<div class="p-4 text-center text-sm text-white/50">Ищем...</div>';

    inviteSearchTimeout = setTimeout(() => {
      if (boardId) {
        fetchInviteUsers(boardId, query);
      }
    }, 300);
  });


  // --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ЦВЕТОВ ---
  function setupColorPicker(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const options = container.querySelectorAll('.color-option');

    // Обработка клика по цвету
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    // Метод: получить выбранный цвет
    container.getSelectedColor = () => {
      const selected = container.querySelector('.color-option.selected');
      return selected ? selected.dataset.color : '#ffffff';
    };

    // Метод: установить активный цвет (для окна редактирования)
    container.setColor = (colorToSelect) => {
      options.forEach(o => {
        o.classList.remove('selected');
        // Сравниваем цвета (приводим к нижнему регистру на всякий случай)
        if (o.dataset.color.toLowerCase() === colorToSelect.toLowerCase()) {
          o.classList.add('selected');
        }
      });
      // Если цвет не нашелся (например старая доска), выбираем белый
      if (!container.querySelector('.color-option.selected')) {
        const whiteOpt = container.querySelector('[data-color="#ffffff"]');
        if (whiteOpt) whiteOpt.classList.add('selected');
      }
    };
  }

  // Инициализируем палитры
  setupColorPicker('create-color-options');
  setupColorPicker('edit-color-options');


  // --- ПЕРЕМЕННЫЕ МОДАЛОК ---
  const createModal = document.getElementById('create-board-modal');
  const editModal = document.getElementById('edit-board-modal');

  // Кнопки открытия/закрытия
  const openCreateBtn = document.getElementById('open-create-board-modal');
  const closeCreateBtn = document.getElementById('close-create-board');
  const closeEditBtn = document.getElementById('close-edit-board');

  // Формы
  const createForm = document.getElementById('create-board-form');
  const editForm = document.getElementById('edit-board-form');
  const deleteBoardBtn = document.getElementById('delete-board-btn');


  // --- 1. ЛОГИКА СОЗДАНИЯ ДОСКИ ---

  // Открытие окна создания
  if (openCreateBtn) {
    openCreateBtn.addEventListener('click', () => {
      createModal.style.display = 'flex';
      const titleInput = document.getElementById('new-board-title');
      if (titleInput) {
        titleInput.value = 'Новая доска'; // Сброс названия
        titleInput.focus();
      }
      // Сброс цвета на белый
      const createPicker = document.getElementById('create-color-options');
      if (createPicker && createPicker.setColor) createPicker.setColor('#ffffff');
    });
  }

  // Отправка формы создания
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('new-board-title').value;
      const picker = document.getElementById('create-color-options');
      const color = picker ? picker.getSelectedColor() : '#ffffff';
      const csrfToken = window.DJANGO_DATA.csrfToken;

      try {
        const response = await fetch(window.DJANGO_DATA.urls.createBoard, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
          },
          body: JSON.stringify({ title: title, color: color })
        });

        const data = await response.json();

        if (data.success) {
          window.location.href = `${window.DJANGO_DATA.urls.boardBase}${data.board_id}/`;
        } else {
          alert('Ошибка при создании доски: ' + data.error);
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Произошла ошибка сети');
      }
    });
  }


  // --- 2. ЛОГИКА РЕДАКТИРОВАНИЯ ДОСКИ ---

  // Навешиваем обработчики на все "шестеренки"
  document.querySelectorAll('.board-settings-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Чтобы не сработал клик по карточке (переход)

      // Получаем данные из data-атрибутов
      const id = trigger.dataset.id;
      const title = trigger.dataset.title;
      const color = trigger.dataset.color || '#ffffff';

      // Заполняем форму
      document.getElementById('edit-board-id').value = id;
      document.getElementById('edit-board-title').value = title;

      // Устанавливаем цвет
      const editPicker = document.getElementById('edit-color-options');
      if (editPicker && editPicker.setColor) {
        editPicker.setColor(color);
      }

      editModal.style.display = 'flex';
    });
  });

  // Сохранение изменений (Update)
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-board-id').value;
      const title = document.getElementById('edit-board-title').value;
      const picker = document.getElementById('edit-color-options');
      const color = picker ? picker.getSelectedColor() : '#ffffff';

      try {
        const response = await fetch(window.DJANGO_DATA.urls.updateBoard, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.DJANGO_DATA.csrfToken
          },
          body: JSON.stringify({ board_id: id, title: title, color: color })
        });
        const data = await response.json();
        if (data.success) {
          window.location.reload(); // Перезагружаем страницу, чтобы обновить цвет и название
        } else {
          alert('Ошибка: ' + data.error);
        }
      } catch (err) { console.error(err); }
    });
  }

  // Удаление доски
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  let boardIdToDelete = null; // Переменная для хранения ID

  // 1. Нажатие кнопки "Удалить доску" в окне настроек
  if (deleteBoardBtn) {
    deleteBoardBtn.addEventListener('click', (e) => {
      e.preventDefault();

      // Запоминаем ID доски, которую редактируем
      boardIdToDelete = document.getElementById('edit-board-id').value;

      // Скрываем окно настроек, чтобы не мешало
      editModal.style.display = 'none';

      // Показываем окно подтверждения
      if (deleteConfirmModal) deleteConfirmModal.style.display = 'flex';
    });
  }

  // 2. Нажатие "Да" (Подтверждение)
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!boardIdToDelete) return;

      try {
        const response = await fetch(window.DJANGO_DATA.urls.deleteBoard, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.DJANGO_DATA.csrfToken
          },
          body: JSON.stringify({ board_id: boardIdToDelete })
        });

        const data = await response.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert('Ошибка удаления: ' + data.error);
        }
      } catch (err) {
        console.error(err);
        alert('Ошибка сети');
      }
    });
  }

  // 3. Нажатие "Нет" (Отмена)
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      // Скрываем подтверждение
      if (deleteConfirmModal) deleteConfirmModal.style.display = 'none';

      // Возвращаем окно настроек (удобно для пользователя)
      editModal.style.display = 'flex';
    });
  }

  // Закрытие подтверждения при клике вне окна
  window.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) {
      deleteConfirmModal.style.display = 'none';
      editModal.style.display = 'flex';
    }
  });


  // --- 3. ОБЩИЕ ФУНКЦИИ ЗАКРЫТИЯ ---

  // Закрытие по крестикам
  if (closeCreateBtn) closeCreateBtn.onclick = () => createModal.style.display = 'none';
  if (closeEditBtn) closeEditBtn.onclick = () => editModal.style.display = 'none';

  // Закрытие по клику вне окна (делегирование)
  window.addEventListener('click', (e) => {
    if (e.target === createModal) createModal.style.display = 'none';
    if (e.target === editModal) editModal.style.display = 'none';
  });
});
document.addEventListener('click', function (e) {
  const logoutBtn = e.target.closest('#logout-btn') || e.target.closest('.js-logout-trigger');

  if (logoutBtn) {
    e.preventDefault();
    e.stopPropagation();

    console.log("Клик по выходу зафиксирован");

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = window.DJANGO_DATA.urls.logout;

    const token = window.DJANGO_DATA?.csrfToken ||
      document.querySelector('[name=csrfmiddlewaretoken]')?.value;

    if (!token) {
      console.error("CSRF Token not found!");
      window.location.href = window.DJANGO_DATA.urls.logout;
      return;
    }

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'csrfmiddlewaretoken';
    hiddenInput.value = token;

    form.appendChild(hiddenInput);
    document.body.appendChild(form);
    form.submit();
  }
});

// // === ЛОГИКА ОТВЕТСТВЕННЫХ ЗА ЗАДАЧУ ===

// let selectedAssignees = new Set();
// let boardMembersCache = [];

// async function openAssigneesDropdown(boardId) {
//   const dropdown = document.getElementById('assignees-dropdown');
//   dropdown.classList.remove('hidden');

//   if (boardMembersCache.length === 0) {
//     dropdown.innerHTML = '<div class="p-4 text-center text-sm text-white/50">Загрузка...</div>';
//     try {
//       const response = await fetch(`${window.DJANGO_DATA.urls.membersApiBase}${boardId}/members/`);
//       const data = await response.json();

//       if (data.success) {
//         boardMembersCache = data.users;
//         renderAssigneesDropdown();
//       } else {
//         dropdown.innerHTML = `<div class="p-3 text-[#ff7b72] text-sm">${data.error}</div>`;
//       }
//     } catch (err) {
//       console.error(err);
//       dropdown.innerHTML = '<div class="p-3 text-[#ff7b72] text-sm">Ошибка сети</div>';
//     }
//   } else {
//     renderAssigneesDropdown();
//   }
// }

// function renderAssigneesDropdown() {
//   const dropdown = document.getElementById('assignees-dropdown');
//   dropdown.innerHTML = '';

//   if (boardMembersCache.length === 0) {
//     dropdown.innerHTML = '<div class="p-3 text-white/50 text-sm text-center">Нет доступных участников</div>';
//     return;
//   }

//   boardMembersCache.forEach(user => {
//     const isSelected = selectedAssignees.has(user.id);
//     const item = document.createElement('div');
//     item.className = `flex items-center gap-3 p-3 cursor-pointer hover:bg-[#21262d] transition-colors ${isSelected ? 'bg-[#21262d]' : ''}`;

//     const avatarHtml = user.avatar_url
//       ? `<img src="${user.avatar_url}" class="w-8 h-8 rounded-full object-cover">`
//       : `<div class="w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-xs font-bold text-white">${user.full_name.charAt(0).toUpperCase()}</div>`;

//     item.innerHTML = `
//             ${avatarHtml}
//             <div class="flex-1">
//                 <div class="text-sm font-medium text-white">${user.full_name}</div>
//                 <div class="text-xs text-white/50">@${user.username}</div>
//             </div>
//             ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-[#58a6ff]"></i>' : ''}
//         `;

//     item.onclick = () => toggleAssignee(user);
//     dropdown.appendChild(item);
//   });

//   if (typeof lucide !== 'undefined') lucide.createIcons();
// }

// function toggleAssignee(user) {
//   if (selectedAssignees.has(user.id)) {
//     selectedAssignees.delete(user.id);
//   } else {
//     selectedAssignees.add(user.id);
//   }
//   renderAssigneesDropdown();
//   renderSelectedAssigneesUI();
// }

// function renderSelectedAssigneesUI() {
//   const container = document.getElementById('task-assignees-container');
//   const addBtn = document.getElementById('add-assignee-btn');

//   container.innerHTML = '';

//   selectedAssignees.forEach(id => {
//     const user = boardMembersCache.find(u => u.id === id);
//     if (!user) return;

//     const avatar = document.createElement('div');
//     avatar.className = 'relative group -ml-2 first:ml-0';
//     avatar.innerHTML = user.avatar_url
//       ? `<img src="${user.avatar_url}" class="w-8 h-8 rounded-full object-cover border-2 border-[#0d1117]" title="${user.full_name}">`
//       : `<div class="w-8 h-8 rounded-full bg-[#30363d] border-2 border-[#0d1117] flex items-center justify-center text-xs font-bold text-white" title="${user.full_name}">${user.full_name.charAt(0).toUpperCase()}</div>`;

//     container.appendChild(avatar);
//   });

//   container.appendChild(addBtn);
// }

// // === ОБРАБОТЧИКИ СОБЫТИЙ ===

// document.getElementById('add-assignee-btn')?.addEventListener('click', (e) => {
//   e.stopPropagation();

//   const pathParts = window.location.pathname.split('/');
//   const boardId = pathParts[pathParts.indexOf('board') + 1];

//   if (boardId) openAssigneesDropdown(boardId);
// });

// window.addEventListener('click', (e) => {
//   const dropdown = document.getElementById('assignees-dropdown');
//   if (dropdown && !e.target.closest('#assignees-dropdown') && !e.target.closest('#add-assignee-btn')) {
//     dropdown.classList.add('hidden');
//   }
// });

// === СИСТЕМА УВЕДОМЛЕНИЙ (ИНВАЙТЫ) ===
const notifBell = document.getElementById('notification-bell');
const notifDropdown = document.getElementById('notification-dropdown');
const notifBadge = document.getElementById('notification-badge');
const notifList = document.getElementById('notification-list');
const notifCount = document.getElementById('notification-count');

// Открытие/закрытие меню по клику на колокольчик
notifBell?.addEventListener('click', (e) => {
  e.stopPropagation();
  notifDropdown.classList.toggle('hidden');
});

// Закрытие при клике вне меню
window.addEventListener('click', (e) => {
  if (notifDropdown && !e.target.closest('#notification-container')) {
    notifDropdown.classList.add('hidden');
  }
});

// 1. Загрузка уведомлений
async function fetchInvitations() {
  try {
    const response = await fetch(window.DJANGO_DATA.urls.invitationsBase);
    const data = await response.json();

    if (data.success) {
      renderInvitations(data.invitations);
    }
  } catch (error) {
    console.error("Ошибка загрузки уведомлений:", error);
  }
}

// 2. Отрисовка списка
function renderInvitations(invitations) {
  if (!notifList) return;

  if (invitations.length > 0) {
    notifBadge.classList.remove('hidden');
    notifCount.textContent = invitations.length;
    notifList.innerHTML = '';
  } else {
    notifBadge.classList.add('hidden');
    notifCount.textContent = '0';
    notifList.innerHTML = '<div class="p-6 text-center text-sm text-white/50">Нет новых приглашений</div>';
    return;
  }

  invitations.forEach(inv => {
    const item = document.createElement('div');
    item.className = 'p-4 border-b border-[#30363d] last:border-0 hover:bg-[#21262d] transition-colors';
    item.innerHTML = `
              <div class="flex items-start gap-3 mb-3">
                  <div class="w-8 h-8 rounded-full bg-[#58a6ff]/20 text-[#58a6ff] flex items-center justify-center shrink-0">
                      <i data-lucide="mail" class="w-4 h-4"></i>
                  </div>
                  <div>
                      <div class="text-sm text-white/80"><span class="font-bold text-white">@${inv.inviter}</span> приглашает вас на доску:</div>
                      <div class="font-black text-white mt-0.5">${inv.board_title}</div>
                      <div class="text-[10px] text-white/40 uppercase tracking-widest mt-1">Роль: ${inv.access_level}</div>
                  </div>
              </div>
              <div class="flex gap-2">
                  <button onclick="respondToInvite(${inv.board_id}, 'accept')" class="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-bold py-2 rounded-lg transition-colors">
                      Принять
                  </button>
                  <button onclick="respondToInvite(${inv.board_id}, 'decline')" class="flex-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white/70 hover:text-white text-xs font-bold py-2 rounded-lg transition-colors">
                      Отклонить
                  </button>
              </div>
          `;
    notifList.appendChild(item);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 3. Функция ответа на приглашение (Глобальная, чтобы работала из onclick)
window.respondToInvite = async function (boardId, action) {
  try {
    const response = await fetch(`${window.DJANGO_DATA.urls.invitationsBase}${boardId}/respond/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.DJANGO_DATA.csrfToken
      },
      body: JSON.stringify({ action: action })
    });

    const data = await response.json();

    if (data.success) {
      if (action === 'accept') {
        window.location.reload();
      } else {
        fetchInvitations();
      }
    } else {
      alert("Ошибка: " + data.error);
    }
  } catch (error) {
    console.error("Ошибка при ответе на инвайт:", error);
  }
}

if (window.DJANGO_DATA.isAuthenticated) {
  fetchInvitations();
}