$(function(){function e(e,n){let t=$(".js-log_item");if(""==e)t.fadeIn(100);else{let i=$(".js-log_item .js-"+n+":contains("+e+")");t.fadeOut(100),i.parent().parent().fadeIn(100)}}$("#in-search_type").on("keyup",function(){e($(this).val(),"type")}),$("#in-search_user").on("keyup",function(){e($(this).val(),"user")}),$("#in-search_date").on("keyup",function(){e($(this).val(),"date")})});