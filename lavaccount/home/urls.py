from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='home_url'),
    path('lk/', views.lk, name='lk_url'),
    path('noscript/', views.noscript, name='noscript_url'),
    path('logs/', views.logs, name='logs_url'),
    path('login/', views.lav_login, name="lav_login"),
    path('register/', views.RegisterView.as_view(), name="register_url"),
    path('site_in_service/', views.site_in_service, name="site_in_service_url"),

    path('lk/site_in_service_switch/', views.site_in_service_switch),
    path('create_account/', views.create_account),
    path('delete_account/', views.delete_account),
    path('change_info_account/', views.change_info_account),
    path('change_or_create_master_password/', views.change_or_create_master_password),
    path('register/check_username/', views.check_username),

    path('email_change/', views.email_change, name='email_change_url'),
    path('email_change/done/', views.email_change_done, name='email_change_done_url'),

    path('confirm_email/', views.confirm_email, name='confirm_email_url'),
    path('confirm_email/done/', views.confirm_email_done, name='confirm_email_done_url'),
    path('confirm_email/complete/', views.confirm_email_complete, name='confirm_email_complete_url'),
    path('activate_email/<uidb64>[0-9A-Za-z_\-]+)/<token>[0-9A-Za-z]{1,13}-[0-9A-Za-z]{1,20})/', views.activate_email,
         name='activate_email'),

    path('master_password_reset/', views.master_password_reset, name='master_password_reset_url'),

    path('email/', views.email, name='email_url'),  # TODO: удалить
]
