$(document).on("ready", function () {

	var urlParams = window.location.search.substr(1).split('&').reduce(
        function(accumulator, currentValue) {
            var pair = currentValue
                .split('=')
                .map(function(value) {
                    return decodeURIComponent(value);
                });

            accumulator[pair[0]] = pair[1];

            return accumulator;
        },
        {}
    );

    var path = urlParams.path;
    var orientation = urlParams.orientation;
    orientation = parseInt(orientation);
    var height = parseInt(urlParams.height);
    var width = parseInt(urlParams.width);
    var pixelated = urlParams.zoom === 'pixelated';
    var $image = $("#main-image");
    if (pixelated) {
        $image.addClass("pixelated");
    }
    else {
        $image.removeClass("pixelated");
    }
    $image.addClass(`r${orientation}`);
    switch (orientation) {
    	case 5:
    	case 6:
    	case 7:
    	case 8:
    		if (width > height) {
    			$image.addClass(`fit-height2`);
    		}
    		else {
    			$image.addClass(`fit-width2`);
    		}
    		break;
    	default:
    		if (width > height) {
    			$image.addClass(`fit-width`);
    		}
    		else {
    			$image.addClass(`fit-height`);
    		}
    }
    // path = path.replace(/#/g, '%23');
    $image.attr("src", path);
    $image.addClass("show");
});