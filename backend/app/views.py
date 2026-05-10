from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    DailyReport,
    Delivery,
    Employee,
    FuelType,
    Station,
)
from .serializers import (
    DailyReportSerializer,
    DeliverySerializer,
    EmployeeSerializer,
    FuelTypeSerializer,
    StationSerializer,
)


class StationViewSet(viewsets.ModelViewSet):
    queryset = Station.objects.all()
    serializer_class = StationSerializer

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
    queryset = Employee.objects.select_related('station').all()
    serializer_class = EmployeeSerializer


class FuelTypeViewSet(viewsets.ModelViewSet):
    queryset = FuelType.objects.all()
    serializer_class = FuelTypeSerializer


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('station', 'fuel_type').all()
    serializer_class = DeliverySerializer


class DailyReportViewSet(viewsets.ModelViewSet):
    queryset = DailyReport.objects.select_related('station', 'employee').prefetch_related('items').all()
    serializer_class = DailyReportSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if station := params.get('station'):
            qs = qs.filter(station_id=station)
        if date_from := params.get('date_from'):
            qs = qs.filter(date__gte=date_from)
        if date_to := params.get('date_to'):
            qs = qs.filter(date__lte=date_to)
        if status := params.get('status'):
            qs = qs.filter(status=status)
        return qs

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        report = self.get_object()
        report.status = DailyReport.Status.CONFIRMED
        report.confirmed_at = timezone.now()
        report.save(update_fields=['status', 'confirmed_at'])
        return Response(self.get_serializer(report).data)
