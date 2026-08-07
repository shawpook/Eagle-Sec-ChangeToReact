EagleApp.directive('extIcon', function() {
    return {
        restrict: 'E',
        link: function(scope, element, attrs) {
        	function init () { 
	            let itemId = attrs.itemId;
	            let item = $bodyScope.itemMappings[itemId];
	            let rawPath = FileUrlHelper.getRawPath(item);
	            let html = `<div class="ext-icon"><img></div>`;
	            element.html(html);
	            FILE_ICON.getFileThumbnail(item, rawPath, function (base64) {
	                element.find("img").attr('src', base64);
	            });
            }
            attrs.$observe('itemId', function (val) {
                init();
            });
        }
    };
});