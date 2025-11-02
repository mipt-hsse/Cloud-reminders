from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from .models import CustomUser

class AuthenticationTests(APITestCase):
    def setUp(self):
        self.register_url = reverse('register')
        self.login_url = reverse('token_obtain_pair')
        self.profile_url = reverse('user_profile')
        
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123',
            'password2': 'testpass123',
        }
        
        self.login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }

    def test_user_registration(self):
        response = self.client.post(self.register_url, self.user_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomUser.objects.count(), 1)
        self.assertEqual(CustomUser.objects.get().username, 'testuser')

    def test_user_login(self):
        # Сначала регистрируем пользователя
        self.client.post(self.register_url, self.user_data)
        
        # Пытаемся войти
        response = self.client.post(self.login_url, self.login_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_protected_endpoint(self):
        # Регистрируем и логинимся
        self.client.post(self.register_url, self.user_data)
        login_response = self.client.post(self.login_url, self.login_data)
        token = login_response.data['access']
        
        # Доступ к защищенному endpoint с токеном
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)