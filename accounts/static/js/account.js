$(function() {
    var master_password = null, // Хранит мастер пароль для расшифровки данных таблицы
        press_timer, // Хранит значение таймера для события долгого нажатия кнопки "Пароль"
        is_allow_copy = true, // Разрешает копирование при долгом нажатии кнопки "Пароль"
        is_allow_show_page = false; // Разрешает отображение страницы

    function reload() { // Функция перезагрузки страницы
        location.href = location.href;
    }

    master_password = $('body').attr('data-master_password');
    $('body').attr('data-master_password', null);

    if (master_password != 'DoesNotExist') {
        $('#EnterKeyModal').modal('show'); // Открываем модальное окно ввода ключа
    } else {
        // При первом посещении страницы, а также исходя из результата "DoesNotExist", мастер пароля в базе не существует, поэтому...
        $('#in-old_password').attr('disabled', 'disabled'); // Отключаем поле ввода старого пароля в модальном окне изменения пароля
        $('#MasterPasswordModal').modal('show'); // Открываем модальное окно изменения пароля
    }

    function create_account() { // Функция создания нового аккаунта в таблице
        var site = $("#in-site").val(),
            description = $("#in-description").val(),
            login = $("#in-login").val(),
            password = encrypt($("#in-password").val(), master_password);

        $.ajax({
            url: "create_account/",
            type: "POST",
            data: {
                site: encrypt(site, master_password),
                description: encrypt(description, master_password),
                login: encrypt(login, master_password),
                password: password,
            },
            success: function(result) {
                var account_id = result['account_id'];

                if (result['status'] == "success") {
                    var tr = '<tr data-id="' + account_id + '">' +
                        '<td class="td-site" data-id="' + account_id + '">' + site + '</td>' +
                        '<td class="td-description" data-id="' + account_id + '">' + description + '</td>' +
                        '<td class="td-login td-hide" data-id="' + account_id + '">' + login + '</td>' +
                        '<td class="td-password td-hide" data-id="' + account_id + '">' + password + '</td>' +
                        '<td class="td-btn">' +
                        '<button class="btn btn-primary" data-toggle="modal" data-target="#AccountModal" data-id="' + account_id + '">Открыть</button>' +
                        '</td>' +
                        '</tr>'; // Формируем запись для таблицы

                    $('tbody').append(tr); // Добавляем в конец таблицы только что созданную запись аккаунта
                    // Вызов сортировки два раза, так как вызов один раз приведет к обратной сортировке алфавита (от Я до А)
                    sort_table();
                    sort_table();
                    $('#CreateAccountModal').modal('hide'); // Закрываем модальное окно создания аккаунта
                    // Чистим поля
                    $('#in-site').val('');
                    $('#in-description').val('');
                    $('#in-login').val('');
                    $('#in-password').val('');
                } else {
                    swal("Ошибка!", res['result']);
                }
            }
        });
    }

    function delete_account(account_id) { // Функция удаления аккаунта
        $.ajax({
            url: "delete_account/",
            type: "POST",
            data: {
                account_id: account_id,
            },
            success: function(result) {
                if (result['status'] == "success") {
                    $('tr[data-id="' + account_id + '"]').remove(); // Удаляем запись из таблицы
                    $('#AccountModal').modal('hide'); // Закрываем модальное окно удаления аккаунта
                } else {
                    swal("Ошибка!", result['result']);
                }
            }
        });
    }

    function change_info_account() { // Функция изменения информации аккаунта
        var site = $("#modal-site").val(),
            description = $("#modal-description").val(),
            login = $("#modal-login").val(),
            new_password = $('#modal-new_password').val(),
            account_id = $('#modal-btn-account_delete').attr('data-id');

        if (new_password != "") { // Если был введен новый пароль...
            new_password = encrypt(new_password, master_password); // Шифруем его
        }

        if ($("#modal-site").val() != "") {
            if ($("#modal-description").val() != "") {
                if ($("#modal-login").val() != "") {
                    $.ajax({
                        url: "change_info_account/",
                        type: "POST",
                        data: {
                            site: encrypt(site, master_password),
                            description: encrypt(description, master_password),
                            login: encrypt(login, master_password),
                            new_password: new_password,
                            account_id: account_id
                        },
                        success: function(result) {
                            if (result['status'] == "success") {
                                var tr = $('tr[data-id="' + account_id + '"]'); // Ищем в таблице аккаунт который изменяли
                                // Обновляем значения в таблице
                                tr.find('.td-site').text(site);
                                tr.find('.td-description').text(description);
                                tr.find('.td-login').text(login);
                                if (new_password != "") { // Если был введен пароль...
                                    tr.find('.td-password').text(new_password);
                                    $('#modal-new_password').val(''); // Чистим input ввода пароля
                                }
                                sort_table();
                                sort_table();
                                $('#AccountModal').modal('hide'); // Скрываем модальное окно просмотра аккаунта
                            } else {
                                swal("Ошибка!", result['result']);
                            }
                        }
                    });
                } else {
                    swal('Заполните поле "Логин"');
                }
            } else {
                swal('Заполните поле "Описание"');
            }
        } else {
            swal('Заполните поле "Сайт"');
        }
    }

    function change_or_create_master_password(new_master_password) { // Функция изменения мастер пароля
        var sites = {},
            descriptions = {},
            logins = {},
            passwords = {},
            tds = $('td');

        if (tds.length > 0) { // Если таблица не пустая...
            tds.each(function(index, td) {
                var account_id = td.getAttribute('data-id');
                if (td.className == 'td-site') {
                    // Шифруем строку из ячейки и присваиваем ее массиву под индексом ее id в базе данных
                    sites[account_id] = encrypt(td.innerHTML, new_master_password);
                } else if (td.className == 'td-description') {
                    descriptions[account_id] = encrypt(td.innerHTML, new_master_password);
                } else if (td.className == 'td-login td-hide') {
                    logins[account_id] = encrypt(td.innerHTML, new_master_password);
                } else if (td.className == 'td-password td-hide') {
                    // Тоже самое, только предварительно расшировать, потому что пароль хранится в ячейке в зашифрованном виде
                    passwords[account_id] = encrypt(decrypt(td.innerHTML, master_password), new_master_password);
                }
            });
        }

        $.ajax({
            url: "change_or_create_master_password/",
            type: "POST",
            data: {
                sites: JSON.stringify(sites),
                descriptions: JSON.stringify(descriptions),
                logins: JSON.stringify(logins),
                passwords: JSON.stringify(passwords),
                new_master_password: encrypt(new_master_password, new_master_password),
            },
            success: function(result) {
                if (result['status'] == "success") {
                    reload();
                } else {
                    swal("Ошибка!", result['result']); // Это кастомный alert
                }
            },
        });
    }

    function check_key() { // Функция авторизации/проверки ключа
        var key = $('#in-enter_password').val();

        if (key == '') { // Если ключ не был введен...
            $('#in-enter_password').focus(); // Переводим фокус на input
            $('#EnterKeyModal').modal('show'); // Повторяем запрос ключа
        } else {
            key = decrypt(master_password, key); // Расшифровываем полученый пароль введенным ключем

            if (key == '') { // Если расшифровка не дала результата...
                $('#in-enter_password').val(''); // Чистим input ввода ключа
                $('#in-enter_password').focus(); // Переводим фокус на input
                $('#EnterKeyModal').modal('show'); // Повторяем запрос ключа
            } else {
                master_password = key; // Присваиваем ключ глобальной переменной "Мастер пароль"
                is_allow_show_page = true;
                $('#EnterKeyModal').modal('hide'); // Скрываем модальное окно ввода пароля
            }
        }
    }

    function sort_table() { // Функция сортировки таблицы
        if ($('tr').length > 1) { // Если таблица не пустая...
            $("#Accounts_table").tablesorter({
                sortList: [
                    [0, 0] // Сортируем по первому столбцу, по алфавиту
                ]
            });
        }
    }

    function show_or_copy_password() { // Функция копирования/отображения пароля аккаунта
        var key = decrypt($('#modal-password').val(), master_password);

        if (key != '') { // Если расшифрока дала результат...
            if (is_allow_copy) { // Если копирование разрешено...
                copy_clipboard(key); // Копируем пароль в буфер обмена
            } else {
                swal(key); // Выводим пароль на экран
                is_allow_copy = true; // Разрешаем в дальнейшем копирование
            }
        } else {
            swal('Не правильный пароль');
        }
    }

    function copy_clipboard(text) { // Функция копирования текста в буфер обмена
        var $tmp = $("<input>");
        $("#AccountModal").append($tmp);
        $tmp.val(text).select();
        document.execCommand("copy");
        $tmp.remove();
    }

    function encrypt(str, key) { // Функция шифрования строки
        return CryptoJS.AES.encrypt(str, key).toString();
    }

    function decrypt(str, key) { // Функция дешифрования строки
        try {
            return CryptoJS.AES.decrypt(str, key).toString(CryptoJS.enc.Utf8);
        } catch (e) {
            if (e.message == 'Malformed UTF-8 data') { // Если были искажены данные
                return "";
            } else {
                swal("Ошибка!", 'Error: function Decrypt()');
                throw e;
            }
        }
    }

    $("#btn-enter_password").on('click', function() { // Собитие нажатия кнопки "ОК" в модальном окне ввода ключа
        check_key(); // Проходим авторизацию
    });

    $("#btn-send_account").on('click', function() { // Событие нажатия на кнопку "Отправить" в модальном окне создания нового аккаунта
        if ($("#in-site").val() != "") {
            if ($("#in-description").val() != "") {
                if ($("#in-login").val() != "") {
                    if ($("#in-password").val() != "") {
                        create_account();
                    } else {
                        swal('Заполните поле "Пароль"');
                    }
                } else {
                    swal('Заполните поле "Логин"');
                }
            } else {
                swal('Заполните поле "Описание"');
            }
        } else {
            swal('Заполните поле "Сайт"');
        }
    });

    $("#btn-send_master_password").on('click', function() { // Событие нажатия на кнопку "Отправить" в модальном окне изменения мастер пароля
        if (($("#in-old_password").val() == "" && $("#in-old_password").attr('disabled')) ||
            ($("#in-old_password").val() != "" && !$("#in-old_password").attr('disabled'))) {
            if ($("#in-new_password").val() != "") {
                if ($("#in-repeat_new_password").val() != "") {
                    if ($("#in-new_password").val() == $("#in-repeat_new_password").val()) {
                        if (!$("#in-old_password").attr('disabled')) {
                            if (master_password == $('#in-old_password').val()) {
                                change_or_create_master_password($("#in-repeat_new_password").val());
                            } else {
                                swal('Не правильный старый пароль');
                            }
                        } else {
                            change_or_create_master_password($("#in-repeat_new_password").val());
                        }
                    } else {
                        swal('Пароли не совпадают');
                    }
                } else {
                    swal('Заполните поле "Подтвердите новый пароль"');
                }
            } else {
                swal('Заполните поле "Новый пароль"');
            }
        } else {
            swal('Заполните поле "Старый пароль"');
        }
    });

    $("#modal-btn-account_delete").on('click', function() { // Событие нажатия на кнопку "Удалить" в модальном окне просмотра аккаунта
        swal({
                title: "Ты уверен?",
                text: "Эту запись потом не восстановить!",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: '#DD6B55',
                confirmButtonText: 'Да, удалить это!'
            },
            function() { // Если была нажата кнопка "Да, удалить это!"...
                delete_account($("#modal-btn-account_delete").attr("data-id")); // Удаляем аккаунт
            }
        );
    });

    $("#modal-btn-save").on('click', function() { // Событие нажатия кнопки "Сохранить" в модальном окне просмотра аккаунта
        var key = decrypt($('#modal-password').val(), master_password);

        if (key != '') { // Если расшифрока дала результат...
            change_info_account(); // Изменяем аккаунт
        } else {
            swal('Не правильный пароль');
        }
    });

    $("#modal-btn-password").on('click', function() { // Событие нажатия кнопки "Пароль" в модальном окне просмотра аккаунта
        show_or_copy_password();
    });

    $("#modal-btn-login").on('click', function() { // Событие нажатия кнопки "Логин" в модальном окне просмотра аккаунта
        copy_clipboard($('.td-login[data-id="' + $('#modal-btn-account_delete').attr('data-id') + '"]').text());
    });

    $('#AccountModal').on('show.bs.modal', function(event) { // Событие открытия модального окна просмотра аккаунта
        var account_id = $(event.relatedTarget).attr('data-id'),
            site = $('.td-site[data-id="' + account_id + '"]').text(),
            description = $('.td-description[data-id="' + account_id + '"]').text(),
            login = $('.td-login[data-id="' + account_id + '"]').text(),
            password = $('.td-password[data-id="' + account_id + '"]').text();

        // Заполняем модальное окно
        $('#modal-site').val(site);
        $('#modal-description').val(description);
        $('#modal-login').val(login);
        $('#modal-password').val(password);
        $('#modal-new_password').val('');
        $('#modal-btn-account_delete').attr('data-id', account_id);
        $('#modal-btn-account_delete').attr('data-site', site);
    });

    $('#EnterKeyModal').on('shown.bs.modal', function() { // Событие открытия модального окна ввода ключа
        // Данное событие необходимо для реализации автофокуса для input
        $('#in-enter_password').focus();
    });

    $("#EnterKeyModal").on('hidden.bs.modal', function() { // Событие закрытия модального окна ввода ключа
        if (is_allow_show_page) { // Если не нажата кнопка "Отмена"...
            var tds = $('td')
            if (tds.length > 0) { // Если таблицы не пустая...
                tds.each(function(index, td) { // Проходим циклом по всем ячейкам
                    // Кроме ячейки пароля и ячейки в которой находится кнопка "Открыть"
                    if (td.className != 'td-password td-hide' && td.className != 'td-btn') {
                        td.innerHTML = decrypt(td.innerHTML, master_password); // Расшифровываем ячейку
                    }
                });
                sort_table(); // Сортируем таблицу
            }
            $('.account_container').css('display', 'block'); // Показываем таблицу
        }
    });

    $('#in-search').on('keyup', function() {
        if ($(this).val() == "") {
            $('tbody tr').css('display', '');
        } else {
            var td = $('.td-site:contains(' + $(this).val().toLowerCase() + ')');
            $('tr').fadeOut(100);
            td.parent().fadeIn(100);
        }
    });

    $('#in-enter_password').on('keydown', function(e) {
        if (e.keyCode == 13) { // Если нажата клавиша "Enter"...
            check_key(); // Проходим авторизацию
        }
    });

    // Событие долгого нажатия кнопки "Пароль" клавишой мыши или сенсором телефона в модальном окне просмотра аккаунта
    $("#modal-btn-password").on('touchend mouseup', (function() { // Событие отжатия клавиши или сенсора
        clearTimeout(press_timer); // Очищаем таймер
    })).on('touchstart mousedown', (function() { // Событие нажатия клавиши или сенсора
        press_timer = window.setTimeout(function() { // Устанавливаем таймер
            is_allow_copy = false; // Запрещаем копирование пароля в буфер обмена так как...
            show_or_copy_password(); // В этой функции мы покажем пароль на экране
        }, 500); // 500 миллисекунд
    }));
});