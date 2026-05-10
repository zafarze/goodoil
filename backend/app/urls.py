from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .auth_views import LoginView
from .views import (
    DailyReportViewSet,
    DeliveryViewSet,
    EmployeeViewSet,
    FuelTypeViewSet,
    StationViewSet,
)

router = DefaultRouter()
router.register('stations', StationViewSet)
router.register('employees', EmployeeViewSet)
router.register('fuel-types', FuelTypeViewSet)
router.register('deliveries', DeliveryViewSet)
router.register('reports', DailyReportViewSet)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('', include(router.urls)),
]
