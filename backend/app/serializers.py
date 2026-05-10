from rest_framework import serializers

from .models import (
    DailyReport,
    Delivery,
    Employee,
    FuelType,
    ReportItem,
    Station,
)


class StationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Station
        fields = ['id', 'name', 'address']


class EmployeeSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source='station.name', read_only=True)

    class Meta:
        model = Employee
        fields = ['id', 'full_name', 'telegram_id', 'station', 'station_name', 'is_active']


class FuelTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelType
        fields = ['id', 'name', 'unit']


class DeliverySerializer(serializers.ModelSerializer):
    fuel_type_name = serializers.CharField(source='fuel_type.name', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True)

    class Meta:
        model = Delivery
        fields = [
            'id', 'date', 'station', 'station_name',
            'fuel_type', 'fuel_type_name', 'volume', 'note', 'created_at',
        ]
        read_only_fields = ['created_at']


class ReportItemSerializer(serializers.ModelSerializer):
    fuel_type_name = serializers.CharField(source='fuel_type.name', read_only=True)

    class Meta:
        model = ReportItem
        fields = ['id', 'fuel_type', 'fuel_type_name', 'sold', 'revenue', 'remainder']


class DailyReportSerializer(serializers.ModelSerializer):
    items = ReportItemSerializer(many=True, required=False)
    station_name = serializers.CharField(source='station.name', read_only=True)
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)

    class Meta:
        model = DailyReport
        fields = [
            'id', 'date', 'employee', 'employee_name', 'station', 'station_name',
            'photo', 'status', 'created_at', 'confirmed_at', 'items',
        ]
        read_only_fields = ['created_at', 'confirmed_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        report = DailyReport.objects.create(**validated_data)
        for item in items_data:
            ReportItem.objects.create(report=report, **item)
        return report

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                ReportItem.objects.create(report=instance, **item)
        return instance
