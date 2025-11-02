from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import CustomUser
from .serializers import RegisterSerializer, UserProfileSerializer,LoginSerializer, AvatarUpdateSerializer
from rest_framework.parsers import MultiPartParser, FormParser

# API Views
class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Автоматически логиним пользователя после регистрации
        login(request, user)
        
        return Response({
            'user': UserProfileSerializer(user).data,
            'message': 'Registration successful'
        }, status=status.HTTP_201_CREATED)

class LoginView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return Response({
                'user': UserProfileSerializer(user).data,
                'message': 'Login successful'
            })
        else:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(View):    
    def post(self, request):
        logout(request)
        # request.session.flush()
        return redirect('login_page')

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = (permissions.IsAuthenticated,)
    
    def get_object(self):
        return self.request.user

class AvatarUpdateView(generics.UpdateAPIView):
    serializer_class = AvatarUpdateSerializer
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        # Удаляем старый аватар если загружается новый
        if 'avatar' in request.FILES and request.user.avatar:
            request.user.avatar.delete(save=False)
        
        return super().update(request, *args, **kwargs)
    
# Template Views
class TemplateLoginView(View):
    def get(self, request):
        if request.user.is_authenticated:
            return redirect('dashboard_page')
        return render(request, 'auth/login.html')
    
    def post(self, request):
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return redirect('dashboard_page')
        else:
            return render(request, 'auth/login.html', {
                'error': 'Invalid username or password'
            })

class TemplateLogoutView(View):
    def post(self, request):
        logout(request)
        # request.session.flush()
        return redirect('login_page')

@method_decorator(login_required, name='dispatch')
class DashboardView(View):
    def get(self, request):
        print(f"Dash access - User: {request.user}, Auth: {request.user.is_authenticated}")
        return render(request, 'app/dashboard.html', {
            'user': request.user
        })