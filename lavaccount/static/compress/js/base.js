$(function(){window.main_show_preload=function(){$("#page-preload").removeClass("preload-done")},window.main_hide_preload=function(){$("#page-preload").addClass("preload-done")},window.preload_show=function(){$("#page-preload").css("background","rgb(0 0 0 / 0.5)"),main_show_preload()},window.preload_hide=function(){main_hide_preload(),setTimeout(function(){$("#page-preload").css("background","#000000")},500)},window.onbeforeunload=function(){main_show_preload()},$(window).scroll(function(){$(this).scrollTop()>100?$(".scrollup").fadeIn():$(".scrollup").fadeOut()}),$(".scrollup").click(function(){return $("html, body").animate({scrollTop:0},600),!1}),function(){try{let o=localStorage.getItem("cookieDate"),e=document.getElementById("cookie_notification"),n=e.querySelector(".cookie_accept");(!o||+o+31536e6<Date.now())&&e.classList.add("show"),n.addEventListener("click",function(){localStorage.setItem("cookieDate",Date.now()),e.classList.remove("show")})}catch{}}()});