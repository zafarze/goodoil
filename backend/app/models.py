from django.db import models


class Station(models.Model):
    name = models.CharField(max_length=100, unique=True)
    address = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name


class Employee(models.Model):
    full_name = models.CharField(max_length=150)
    telegram_id = models.BigIntegerField(unique=True)
    station = models.ForeignKey(Station, on_delete=models.PROTECT, related_name='employees')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.full_name} ({self.station})'


class FuelType(models.Model):
    class Unit(models.TextChoices):
        LITERS = 'L', 'Литры'
        TONS = 'T', 'Тонны'

    name = models.CharField(max_length=50, unique=True)
    unit = models.CharField(max_length=2, choices=Unit.choices, default=Unit.LITERS)

    def __str__(self):
        return f'{self.name} ({self.get_unit_display()})'


class Delivery(models.Model):
    date = models.DateField()
    fuel_type = models.ForeignKey(FuelType, on_delete=models.PROTECT, related_name='deliveries')
    station = models.ForeignKey(Station, on_delete=models.PROTECT, related_name='deliveries')
    volume = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-id']

    def __str__(self):
        return f'{self.date} {self.station} {self.fuel_type} +{self.volume}'


class DailyReport(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Черновик'
        CONFIRMED = 'confirmed', 'Подтвержден'

    date = models.DateField()
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='reports')
    station = models.ForeignKey(Station, on_delete=models.PROTECT, related_name='reports')
    photo = models.ImageField(upload_to='reports/%Y/%m/', blank=True, null=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['-date', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['date', 'station', 'employee'],
                name='uniq_report_per_employee_per_day',
            ),
        ]

    def __str__(self):
        return f'{self.date} {self.station} ({self.get_status_display()})'


class ReportItem(models.Model):
    report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='items')
    fuel_type = models.ForeignKey(FuelType, on_delete=models.PROTECT)
    sold = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    remainder = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['report', 'fuel_type'],
                name='uniq_fuel_per_report',
            ),
        ]

    def __str__(self):
        return f'{self.report} / {self.fuel_type}: {self.sold}'
