import functools
import json
import threading
import traceback
import urllib.request
import zipfile
from datetime import datetime
from loguru import logger as log

from configs.config import EMAIL_HOST_USER
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User
from django.contrib.sites.models import Site
from django.core.mail import EmailMessage
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.template.loader import get_template
from django.utils.encoding import force_bytes
from django.utils.encoding import force_text
from django.utils.http import urlsafe_base64_decode
from django.utils.http import urlsafe_base64_encode
from lavaccount.settings import DEBUG

from .models import Account, MasterPassword, LoginHistory
from .tokens import account_activation_token


class EmailThread(threading.Thread):
    """ Отправка почты в новом потоке """

    def __init__(self, subject, html_content, recipient_list):
        self.subject = subject
        self.recipient_list = recipient_list
        self.html_content = html_content
        threading.Thread.__init__(self)

    def run(self):
        msg = EmailMessage(self.subject, self.html_content, EMAIL_HOST_USER, self.recipient_list)
        msg.content_subtype = "html"
        msg.send()


class NewLoginHistory(threading.Thread):
    """ Создает новую запись истории авторизаций """

    def __init__(self, user, META, system, browser):
        self.user = user
        self.META = META
        self.system = system
        self.browser = browser
        threading.Thread.__init__(self)

    def run(self):
        ip = get_client_ip(self.META)
        ip_info = get_ip_info(ip)

        if ip_info['completed_requests'] > 9500:
            # TODO: Сделать уведомление на почту что уже много запросов
            send_email(
                email='fivesevenom@gmail.com',
                subject='Привязка email к аккаунту',
                template='email_change_email',
                context={
                    'username': user.username
                }
            )

        if ip_info['success']:
            if ip_info['city'] == ip_info['country']:
                location = f"{ip_info['country']}"
            else:
                location = f"{ip_info['city']}, {ip_info['country']}"

            LoginHistory.objects.create(
                user=self.user,
                ip=ip,
                system=self.system,
                location=location,
                browser=self.browser
            )

            # Удаляем последний элемент, если их становится больше 6, так как
            # в выводится 6 элементов, чтобы не мусорить в БД
            login_history = LoginHistory.objects.filter(user=self.user)
            if login_history.count() > 6:
                last_element = login_history.order_by('-id').last()
                last_element.delete()
        else:
            write_error_to_log_file('ip_info ERROR', ip_info['message'])


def send_email(email: str, subject: str, template: str, context: str) -> None:
    """ Отправка почты """
    htmly = get_template(f'email/{template}.html')
    html_content = htmly.render(context)

    EmailThread(subject, html_content, [email]).start()


def confirm_email(user: User, email: str, subject: str, template: str) -> None:
    """ Отправить письмо о подтверждении почты """
    current_site = Site.objects.get_current()

    send_email(
        email=email,
        subject=subject,
        template=template,
        context={
            'username': user.username,
            'protocol': 'http',
            'domain': current_site.domain,
            'uid': urlsafe_base64_encode(force_bytes(user.pk)),
            'token': account_activation_token.make_token(user)
        }
    )


def activate_email(uidb64, token) -> bool:
    """ Активация почты """
    try:
        uid = force_text(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except(TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
    if user is not None and account_activation_token.check_token(user, token):
        user.profile.is_active_email = True
        user.save()
        return True
    return False


def hiding_email(email: str) -> str:
    """ Скрывает тремя звездочками часть email адреса """
    return email[0:2] + '***' + email[email.index('@'):]


def master_password_reset(user: User, password: str) -> bool:
    """ Сброс мастер пароля """
    if check_password(password, user.password):
        master_password = MasterPassword.objects.get(user=user)
        master_password.delete()
        accounts = Account.objects.filter(user=user)
        accounts.delete()
        return True
    else:
        return False


def get_ip_info(ip: str) -> dict:
    """ Получить информацию о пользователе по ip """
    # Отправка API запроса
    objects = 'success,message,type,country,city,completed_requests'
    url = f'https://ipwhois.app/json/{ip}?objects={objects}&lang=ru'
    with urllib.request.urlopen(url) as response:
        return json.load(response)


def get_client_ip(META) -> str:
    """ Получить ip адрес пользователя """
    x_forwarded_for = META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[-1].strip()
    else:
        return META.get('REMOTE_ADDR')


def get_client_host(META) -> str:  # WARNING: Функция не используется
    """ Получить host адресной строки пользователя """
    host = META.get('HTTP_HOST')
    if host:
        return host
    return META.get('REMOTE_HOST')


def create_account(site: str, description: str, login: str, password: str, user: User) -> dict:
    """ Создает новый аккаунт """
    if Account.objects.count() >= 100:
        return {
            'status': 'error',
            'message': 'account limit reached'
        }

    account = Account.objects.create(
        user=user,
        site=site,
        description=description,
        login=login,
        password=password
    )

    return {
        'status': 'success',
        'account_id': account.id
    }


def delete_account(account_id: int) -> dict:
    """ Удаляет аккаунт """
    try:
        account = Account.objects.get(id=account_id)
        account.delete()

        return {
            'status': 'success'
        }
    except Account.DoesNotExist:
        return {
            'status': 'error',
            'result': 'DoesNotExist'
        }


def change_info_account(site: str, description: str, new_login: str, new_password: str, account_id: int) -> dict:
    """ Изменяет информацию аккаунта """
    try:
        account = Account.objects.get(id=account_id)
        account.site = site
        account.description = description

        if new_login == '':
            account.login = account.login
        else:
            account.login = new_login

        if new_password == '':
            account.password = account.password
        else:
            account.password = new_password

        account.save()

        return {
            'status': 'success'
        }
    except Account.DoesNotExist:
        return {
            'status': 'error',
            'result': 'DoesNotExist'
        }


def change_or_create_master_password(sites: str, descriptions: str, logins: str, passwords: str,
                                     new_master_password: str, user: User) -> dict:
    """ Изменяет мастер пароль """
    master_password, is_created = MasterPassword.objects.get_or_create(
        user=user,
        defaults={
            'password': new_master_password
        }
    )

    # Если False значит объект найден, и не был создан, а это значит, что
    # существуют записанные аккаунты и их можно переписывать
    if not is_created:
        sites = json.loads(sites)
        descriptions = json.loads(descriptions)
        logins = json.loads(logins)
        passwords = json.loads(passwords)

        # Перезаписываем все аккаунты на новые значения
        account = Account.objects.filter(user=user)

        for item in account:
            item.site = sites[str(item.id)]
            item.description = descriptions[str(item.id)]
            item.login = logins[str(item.id)]
            item.password = passwords[str(item.id)]
            item.save()

        master_password.password = new_master_password
        master_password.save()

    return {
        'status': 'success'
    }


def check_username(username: str) -> dict:
    """ Проверяет существование имени в БД """
    is_exist_username = False

    if User.objects.filter(username=username).exists():
        is_exist_username = True

    return {
        'status': 'success',
        'is_exist_username': is_exist_username
    }


def get_master_password(user: User) -> str:
    """ Возвращает мастер пароль """
    try:
        master_password = MasterPassword.objects.get(user=user)
        return master_password.password
    except MasterPassword.DoesNotExist:
        return 'DoesNotExist'


def base_view(function):
    """ Декоратор для вьюшек, проверяет ajax и обрабатывает исключения """

    @functools.wraps(function)
    def wrapper(request):
        try:
            with transaction.atomic():
                return function(request)
        except Exception as err:
            #if DEBUG:
            log.error(traceback.format_exc())
            #else:
            write_error_to_log_file('ERROR', traceback.format_exc())
            error_response(err)

    return wrapper


def json_response(data: dict, status=200) -> JsonResponse:
    """ Возвращает JSON с правильными HTTP заголовками и в читаемом
    в браузере виде в случае с кириллицей """
    return JsonResponse(
        data=data,
        status=status,
        safe=not isinstance(data, list),
        json_dumps_params={
            'ensure_ascii': False
        }
    )


def error_response(exception: Exception) -> json_response:
    """ Форматирует HTTP ответ с описанием ошибки """
    result = {
        'status': 'error',
        'result': str(exception)
    }

    return json_response(data=result, status=400)


def write_error_to_log_file(error_type: str, traceback_format_exc: str) -> None:
    """ Запись исключения в файл """
    try:
        file = open('logs/log.json')
        text = json.loads(file.read())

        with open('logs/log.json', 'w+') as f:
            text.update({
                len(text): {'type': error_type, 'date': datetime.now().strftime('%d.%m.%Y %H:%M:%S'), 'traceback': traceback_format_exc}
            })
            f.write(
                json.dumps(text, indent=4)
            )

        # Если размер файла больше либо равен 10 мегабайт архивируем логи
        if len(file.read()) >= 10485760:
            with zipfile.ZipFile('logs/log_json__' + datetime.now().strftime('%d-%m-%Y_%H-%M-%S') + '__.zip', 'w') as arzip:
                arzip.write('logs/log.json')
                f = open('logs/log.json', 'w+')
                f.write(json.dumps(json.loads('{}'), indent=4))
                f.close()

        file.close()
    except FileNotFoundError:
        f = open('logs/log.json', 'x')
        text = json.loads('{}')
        text.update({
            len(text): {'type': error_type, 'date': datetime.now().strftime('%d.%m.%Y %H:%M:%S'), 'traceback': traceback_format_exc}
        })
        f.write(json.dumps(text, indent=4))
        f.close()
