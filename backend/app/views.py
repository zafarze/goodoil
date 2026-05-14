from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import ProtectedError, Sum
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.decorators import parser_classes as drf_parser_classes
from rest_framework.decorators import permission_classes as drf_permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    DailyReport,
    Delivery,
    Employee,
    FuelType,
    Station,
    UserProfile,
)
from .serializers import (
    DailyReportSerializer,
    DeliverySerializer,
    EmployeeSerializer,
    FuelTypeSerializer,
    StationSerializer,
    UserProfileSerializer,
)


class StationViewSet(viewsets.ModelViewSet):
    queryset = Station.objects.all()
    serializer_class = StationSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=True, methods=['get'])
    def remainders(self, request, pk=None):
        """Расчётный остаток по топливу: сумма поступлений - сумма продаж."""
        station = self.get_object()
        result = []
        for fuel in FuelType.objects.all():
            delivered = Delivery.objects.filter(
                station=station, fuel_type=fuel,
            ).aggregate(s=Sum('volume'))['s'] or 0
            sold = sum(
                (item.sold for item in
                 _items_for_station_fuel(station, fuel)),
                start=0,
            )
            result.append({
                'fuel_type_id': fuel.id,
                'fuel_type': fuel.name,
                'unit': fuel.unit,
                'delivered': float(delivered),
                'sold': float(sold),
                'remainder': float(delivered) - float(sold),
            })
        return Response(result)


def _items_for_station_fuel(station, fuel):
    from .models import ReportItem
    return ReportItem.objects.filter(
        report__station=station,
        report__status=DailyReport.Status.CONFIRMED,
        fuel_type=fuel,
    )


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.select_related('station', 'user').all()
    serializer_class = EmployeeSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAdminUser]

    def destroy(self, request, *args, **kwargs):
        employee = self.get_object()
        user = employee.user
        front = employee.passport_front
        back = employee.passport_back
        try:
            with transaction.atomic():
                # employee.delete() raises ProtectedError if DailyReport rows exist.
                employee.delete()
                # User is no longer referenced by Employee after the row above is gone.
                if user is not None:
                    user.delete()
        except ProtectedError:
            return Response(
                {'detail': 'У сотрудника есть отчёты — удаление невозможно. Используйте «Отключить».'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # File cleanup runs after the DB commit. Failures are swallowed — the row is already gone.
        for field in (front, back):
            if field:
                try:
                    field.delete(save=False)
                except (FileNotFoundError, OSError):
                    pass
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=['post'],
        url_path='reset-password',
        permission_classes=[permissions.IsAdminUser],
    )
    def reset_password(self, request, pk=None):
        employee = self.get_object()
        if employee.user_id is None:
            raise ValidationError({'detail': 'У сотрудника нет учётной записи.'})
        new_password = request.data.get('new_password')
        if not new_password:
            raise ValidationError({'new_password': 'Обязательное поле.'})
        try:
            validate_password(new_password, user=employee.user)
        except DjangoValidationError as e:
            raise ValidationError({'new_password': list(e.messages)})
        employee.user.set_password(new_password)
        employee.user.save(update_fields=['password'])
        # Invalidate existing tokens to force re-login after password rotation.
        from rest_framework.authtoken.models import Token
        Token.objects.filter(user=employee.user).delete()
        return Response({'detail': 'Пароль обновлён.'}, status=status.HTTP_200_OK)


class FuelTypeViewSet(viewsets.ModelViewSet):
    queryset = FuelType.objects.all()
    serializer_class = FuelTypeSerializer
    permission_classes = [permissions.IsAdminUser]


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('station', 'fuel_type').all()
    serializer_class = DeliverySerializer
    permission_classes = [permissions.IsAdminUser]


class DailyReportViewSet(viewsets.ModelViewSet):
    queryset = DailyReport.objects.select_related('station', 'employee').prefetch_related('items').all()
    serializer_class = DailyReportSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if station := params.get('station'):
            qs = qs.filter(station_id=station)
        if date_from := params.get('date_from'):
            qs = qs.filter(date__gte=date_from)
        if date_to := params.get('date_to'):
            qs = qs.filter(date__lte=date_to)
        if status_param := params.get('status'):
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        report = self.get_object()
        report.status = DailyReport.Status.CONFIRMED
        report.confirmed_at = timezone.now()
        report.save(update_fields=['status', 'confirmed_at'])
        return Response(self.get_serializer(report).data)


@api_view(['GET'])
@drf_permission_classes([permissions.IsAdminUser])
def passport_file(request, pk, which):
    """Auth-gated passport image streaming. Staff only."""
    try:
        employee = Employee.objects.get(pk=pk)
    except Employee.DoesNotExist:
        raise Http404
    if which == 'front':
        field = employee.passport_front
    elif which == 'back':
        field = employee.passport_back
    else:
        raise Http404
    if not field:
        raise Http404
    return FileResponse(field.open('rb'), as_attachment=False)


@api_view(['GET', 'PATCH'])
@drf_permission_classes([IsAuthenticated])
@drf_parser_classes([MultiPartParser, FormParser, JSONParser])
def profile_me(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if request.method == 'GET':
        return Response(UserProfileSerializer(profile, context={'request': request}).data)
    # PATCH
    serializer = UserProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
@drf_permission_classes([IsAuthenticated])
def profile_change_password(request):
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    if not current_password:
        return Response({'current_password': ['Обязательное поле.']}, status=status.HTTP_400_BAD_REQUEST)
    if not new_password:
        return Response({'new_password': ['Обязательное поле.']}, status=status.HTTP_400_BAD_REQUEST)
    if not request.user.check_password(current_password):
        return Response({'current_password': ['Неверный текущий пароль.']}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new_password, user=request.user)
    except DjangoValidationError as e:
        return Response({'new_password': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])
    # Delete all tokens EXCEPT the one used for this request — keep the current session alive.
    from rest_framework.authtoken.models import Token
    current_token_key = None
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Token '):
        current_token_key = auth_header.split(' ', 1)[1].strip()
    if current_token_key:
        Token.objects.filter(user=request.user).exclude(key=current_token_key).delete()
    else:
        Token.objects.filter(user=request.user).delete()
    return Response({'detail': 'Пароль обновлён.'})


@api_view(['GET'])
@drf_permission_classes([IsAuthenticated])
def profile_me_photo(request):
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        raise Http404
    if not profile.photo:
        raise Http404
    return FileResponse(profile.photo.open('rb'), as_attachment=False)
