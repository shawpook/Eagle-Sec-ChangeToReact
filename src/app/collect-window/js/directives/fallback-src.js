EagleApp.directive("ngFallbackSrc", function () {
	return {
		link: function (scope, element, attrs) {
			element.bind("error", function () {
				if (attrs.src !== attrs.ngFallbackSrc) {
					attrs.$set("src", attrs.ngFallbackSrc);
				}
			});
		},
	};
});
