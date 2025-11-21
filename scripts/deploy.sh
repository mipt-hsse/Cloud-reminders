#!/bin/bash

set -e

echo "🚀 Starting deployment..."

# Остановка существующих контейнеров
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Сборка образов
echo "🔨 Building images..."
docker-compose -f docker-compose.prod.yml build

# Сборка статических файлов
echo "📦 Collecting static files..."
docker-compose -f docker-compose.prod.yml run --rm web python manage.py collectstatic --noinput

# Применение миграций
echo "📋 Applying migrations..."
docker-compose -f docker-compose.prod.yml run --rm web python manage.py migrate

# Запуск сервисов
echo "▶️ Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "✅ Deployment completed!"
echo "📊 Checking services..."
docker-compose -f docker-compose.prod.yml ps