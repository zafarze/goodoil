from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .auth_views import LoginView
from .views import (
    DailyReportViewSet,
    DeliveryViewSet,
    EmployeeViewSet,
    FuelTypeViewSet,
    StationViewSet,
    passport_file,
    profile_change_password,
    profile_me,
    profile_me_photo,
)

router = DefaultRouter()
router.register('stations', StationViewSet)
router.register('employees', EmployeeViewSet)
router.register('fuel-types', FuelTypeViewSet)
router.register('deliveries', DeliveryViewSet)
router.register('reports', DailyReportViewSet)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('employees/<int:pk>/passport/<str:which>/', passport_file, name='employee-passport'),
    path('profile/me/', profile_me, name='profile-me'),
    path('profile/me/change-password/', profile_change_password, name='profile-change-password'),
    path('profile/me/photo/', profile_me_photo, name='profile-photo'),
    path('', include(router.urls)),
]
