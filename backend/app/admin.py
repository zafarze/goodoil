from django.contrib import admin

from .models import (
    DailyReport,
    Delivery,
    Employee,
    FuelType,
    ReportItem,
    Station,
)


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'address')
    search_fields = ('name', 'address')


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'telegram_id', 'station', 'is_active')
    list_filter = ('station', 'is_active')
    search_fields = ('full_name', 'telegram_id')


@admin.register(FuelType)
class FuelTypeAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'unit')


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('id', 'date', 'station', 'fuel_type', 'volume')
    list_filter = ('station', 'fuel_type', 'date')
    date_hierarchy = 'date'


class ReportItemInline(admin.TabularInline):
    model = ReportItem
    extra = 0


@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display = ('id', 'date', 'station', 'employee', 'status', 'created_at')
    list_filter = ('status', 'station', 'date')
    date_hierarchy = 'date'
    inlines = [ReportItemInline]


@admin.register(ReportItem)
class ReportItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'report', 'fuel_type', 'sold', 'revenue', 'remainder')
    list_filter = ('fuel_type',)
