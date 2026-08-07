EagleApp.directive('layoutPanel', () => {
	return {
		restrict: 'E',
		scope: {
			theme: '=',
		},
		templateUrl: 'js/directives/layout-panel.html',
		link: ($scope, element, attrs, controllersArr) => {

			const $menu = $("#layout-panel");
			const $shortcutInput = $("#layout-panel-search");

			$scope.onLayoutChange = (layout) => {
				switch (layout) {
					case "GridLayout":
						$scope.$parent.switchGridLayout();
						break;
					case "JustifiedLayout":
						$scope.$parent.switchJustifiedLayout();
						break;
					case "SquareLayout":
						$scope.$parent.switchSquareLayout();
						break;
					case "ListLayout":
						$scope.$parent.switchListLayout();
						break;
				}
			};

			$scope.closePanel = () => {
				$menu.removeClass("open");
				$shortcutInput.blur();
			};

			$scope.openPanel = () => {
				moveToCursorPosition($menu);
				$menu.addClass("open");
				setTimeout(() => $shortcutInput.focus(), 50);
			};

			$scope.$on("OPEN_LAYOUT_PANEL", () => $scope.openPanel());

			$shortcutInput.on("keyup", (event) => {
				switch (event.keyCode) {
					case 27:
						event.stopPropagation();
						$scope.closePanel();
						break;
				}
			});

		}
	};
});