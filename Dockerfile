FROM python:3.11-slim

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Создание рабочей директории
WORKDIR /app

# Копирование requirements
COPY requirements.txt .

# Установка Python зависимостей
RUN pip install --no-cache-dir -r requirements.txt

# Копирование проекта
COPY . .

# Создание папок для статических файлов
RUN mkdir -p staticfiles media

# Порт приложения
EXPOSE 8000

# Команда для запуска (для разработки)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]