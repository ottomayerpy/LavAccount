$(function() {
    $('button.show-password').on('touchstart mousedown', function() {
        $('#id_password').attr('type', 'text');
    }).on('touchend mouseup', function() {
    	$('#id_password').attr('type', 'password');
    });
});