import os

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

from .models import (
    DailyReport,
    Delivery,
    Employee,
    FuelType,
    ReportItem,
    Station,
    UserProfile,
)


class StationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Station
        fields = ['id', 'name', 'address']


_PASSPORT_IMAGE_TYPES = {'image/jpeg', 'image/png'}
_PASSPORT_IMAGE_EXTS = {'.jpg', '.jpeg', '.png'}
_PROFILE_IMAGE_TYPES = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'}
_PROFILE_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
_MAX_IMAGE_SIZE = 5 * 1024 * 1024


def _validate_image(file, allowed_types, allowed_exts, types_label):
    if file is None:
        return file
    if file.size > _MAX_IMAGE_SIZE:
        raise serializers.ValidationError('Файл больше 5 МБ.')
    content_type = (file.content_type or '').lower()
    ext = os.path.splitext(file.name)[1].lower()
    if content_type not in allowed_types or ext not in allowed_exts:
        raise serializers.ValidationError(
            f'Недопустимый формат файла ({content_type or "неизвестный"}). Допустимы: {types_label}.'
        )
    try:
        Image.open(file).verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise serializers.ValidationError('Файл повреждён или не является изображением.')
    file.seek(0)
    return file


def _validate_passport_image(file):
    return _validate_image(file, _PASSPORT_IMAGE_TYPES, _PASSPORT_IMAGE_EXTS, 'JPEG, PNG')


def _validate_profile_image(file):
    if file is None:
        return file
    if file.size == 0:
        raise serializers.ValidationError('Файл пустой.')
    if file.size > _MAX_IMAGE_SIZE:
        raise serializers.ValidationError('Файл больше 5 МБ.')
    ct = (file.content_type or '').lower()
    name = (getattr(file, 'name', '') or '').lower()
    ext = os.path.splitext(name)[1]

    # Reject formats Pillow can't read out of the box, with a helpful hint.
    unsupported = ('heic', 'heif', 'avif')
    if any(tag in ct for tag in unsupported) or ext in {'.heic', '.heif', '.avif'}:
        fmt = ext.lstrip('.').upper() or ct.split('/')[-1].upper() or 'этот'
        raise serializers.ValidationError(
            f'Формат {fmt} не поддерживается. Сохраните фото в JPEG или PNG.'
        )
    if ct and not ct.startswith('image/'):
        raise serializers.ValidationError(
            f'Это не изображение (тип: {ct}).'
        )
    try:
        Image.open(file).verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise serializers.ValidationError(
            f'Не удалось прочитать файл как изображение ({ct or ext or "формат неизвестен"}). '
            'Сохраните фото в JPEG или PNG и попробуйте ещё раз.'
        )
    file.seek(0)
    return file


def _is_empty_string(v):
    return v is None or (isinstance(v, str) and not v.strip())


class EmployeeSerializer(serializers.ModelSerializer):
    station_name = serializers.CharField(source='station.name', read_only=True, allow_null=True, default=None)
    # write-only fields for create credentials
    username = serializers.CharField(write_only=True, required=False, max_length=150)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=1)
    # read-only fields exposing linked user info
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Employee
        fields = [
            'id', 'full_name', 'telegram_id', 'station', 'station_name', 'is_active',
            'birth_date', 'phone', 'address', 'passport_front', 'passport_back',
            'user', 'user_username', 'username', 'new_password',
        ]

    def validate_passport_front(self, value):
        return _validate_passport_image(value)

    def validate_passport_back(self, value):
        return _validate_passport_image(value)

    def validate(self, attrs):
        errors = {}
        if self.instance is None:
            # create: only identity + credentials are required
            for field in ['full_name', 'username']:
                if _is_empty_string(attrs.get(field)):
                    errors[field] = 'Обязательное поле.'
            if not attrs.get('new_password'):
                errors['new_password'] = 'Обязательное поле.'
            if errors:
                raise serializers.ValidationError(errors)
            # Password strength check; include full_name for similarity validator.
            new_password = attrs.get('new_password')
            if new_password:
                dummy_user = User(
                    username=attrs.get('username', ''),
                    first_name=attrs.get('full_name', ''),
                )
                try:
                    validate_password(new_password, user=dummy_user)
                except DjangoValidationError as exc:
                    raise serializers.ValidationError({'new_password': list(exc.messages)})
        else:
            # update: username cannot be changed
            if 'username' in attrs:
                raise serializers.ValidationError({'username': 'Логин нельзя менять после создания.'})
            new_password = attrs.get('new_password')
            if new_password:
                # Guard: legacy employee rows with no linked User account
                if self.instance.user_id is None:
                    raise serializers.ValidationError(
                        {'new_password': 'У сотрудника нет учётной записи.'}
                    )
                # Password strength check against the actual user for similarity validation
                try:
                    validate_password(new_password, user=self.instance.user)
                except DjangoValidationError as exc:
                    raise serializers.ValidationError({'new_password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        username = validated_data.pop('username')
        new_password = validated_data.pop('new_password')
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    password=new_password,
                    is_active=True,
                )
                # create_user sets is_staff=False by model default — assert as guard
                assert user.is_staff is False
                employee = Employee.objects.create(user=user, **validated_data)
        except IntegrityError:
            raise serializers.ValidationError({'username': 'Логин уже занят.'})
        return employee

    def update(self, instance, validated_data):
        # Reject username on update (defense in depth — already rejected in validate())
        validated_data.pop('username', None)
        new_password = validated_data.pop('new_password', None)
        with transaction.atomic():
            # Mirror is_active onto the linked User BEFORE saving the Employee
            if 'is_active' in validated_data and instance.user_id is not None:
                instance.user.is_active = validated_data['is_active']
                instance.user.save(update_fields=['is_active'])
            if new_password and instance.user_id is not None:
                instance.user.set_password(new_password)
                instance.user.save(update_fields=['password'])
                # Invalidate existing tokens — force re-login on next request
                from rest_framework.authtoken.models import Token
                Token.objects.filter(user=instance.user).delete()
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if instance.passport_front and request:
            data['passport_front'] = request.build_absolute_uri(
                f'/api/employees/{instance.pk}/passport/front/'
            )
        else:
            data['passport_front'] = None
        if instance.passport_back and request:
            data['passport_back'] = request.build_absolute_uri(
                f'/api/employees/{instance.pk}/passport/back/'
            )
        else:
            data['passport_back'] = None
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)
    # FileField bypasses DRF's built-in ImageField validation (which produces a generic
    # "Загруженный файл не является корректным файлом" before our validate_photo runs).
    photo = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = UserProfile
        fields = ['username', 'is_staff', 'full_name', 'phone', 'address', 'birth_date', 'photo']

    def validate_photo(self, file):
        return _validate_profile_image(file)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if instance.photo and request:
            data['photo'] = request.build_absolute_uri('/api/profile/me/photo/')
        else:
            data['photo'] = None
        return data


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
