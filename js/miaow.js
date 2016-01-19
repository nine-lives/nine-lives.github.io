(function () {
    "use strict";

    var mdt = 1500;
    var $bg = $('#bg');
    var ea = "hello" + "@" + "9ls.com";
    $('#liame').html('<a href="mailto:' + ea + '">' + ea + '</a><br/>');

    function purr() {
        $bg.css('background-position', ($bg.width() / $bg.height() < 0.75) ?
            'bottom left' :
            'bottom right');
    }

    function stroke() {
        var $client = $("#clients *:first-child");
        $client.animate({
            opacity: 0.0,
            marginLeft: -$client.outerWidth()
        }, mdt, 'swing', function () {
            $client.appendTo($client.parent());
            $client.css('margin-left', 0);
            $client.animate({
                opacity: 1.0
            }, mdt);
        });
        setTimeout(stroke, mdt * 4);
    }

    $(window).resize(purr);
    purr();
    setTimeout(stroke, mdt * 3);
})();

(function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;
    i[r] = i[r] || function () {
            (i[r].q = i[r].q || []).push(arguments)
        }, i[r].l = 1 * new Date();
    a = s.createElement(o),
        m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    m.parentNode.insertBefore(a, m)
})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

ga('create', 'UA-72659200-1', 'auto');
ga('send', 'pageview');
