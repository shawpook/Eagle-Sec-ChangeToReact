angular.module("vsAutoScroll", []).directive("vsAutoScroll", function () {
	return {
		scope: {
			index: "=index",
		},
		restrict: "A",
		link: function (
			scope, elem, attrs, controllersArr
		) {
			var $container = $(elem);
			var size = parseInt(attrs.vsSize) || 30;
			if (attrs.scrollContainer) {
				$container = $(attrs.scrollContainer);
			}
			scope.$on("VS-REPEAT-AUTO-SCROLL", (event, idx) => {
				try {
					if (idx !== undefined) {
						var $containerScope = angular.element($container).scope();
						if (!$containerScope.sizes || !$containerScope.sizesCumulative) return;
						var sizes = $containerScope.sizes;
						var sizesCumulative = $containerScope.sizesCumulative;
						var targetPos = sizesCumulative[idx];
						var scrollTop = $container.scrollTop();
						var containerHeight = $container.outerHeight() - $container.css("padding-top").replace("px", "") - $container.css("padding-bottom").replace("px", "");
						var to;
						// 如果根本不在画面上，直接跳跃
						if (Math.abs(targetPos - scrollTop) > containerHeight) {
							to = targetPos - containerHeight / 2;
						}
						// 处于画面下方
						else if (targetPos > scrollTop + containerHeight - sizes[idx]) {
							to = targetPos - containerHeight + sizes[idx];
						}
						// 处于画面上方
						else if (targetPos < scrollTop) {
							to = targetPos;
						}
						$container.scrollTop(to);
					}
				} catch (err) {}
			});
		},
	};
});
