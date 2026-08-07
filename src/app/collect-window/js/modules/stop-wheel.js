angular.module("stopWheel", []).directive("stopWheel", [
	"$timeout", function ($timeout) {
		return {
			restrict: "A",
			link: function (scope, element, attrs) {
				// NOTE: 如果我想要叫 passive 的話，就要改成這樣，jQuery 的寫法會發神經
				element[0].addEventListener("wheel",
					function (event) {
						const { deltaY } = event;
						const { scrollTop, scrollHeight, clientHeight } = this;

						// 防止滾動到父元素
						if (
							// 往下滾動
							(deltaY > 0 && scrollTop + clientHeight >= scrollHeight) ||
							// 往上滾動
							(deltaY < 0 && scrollTop <= 0)
						) {
							event.preventDefault();
						}
					},
					// passive: false 使得 preventDefault() 能生效
					{ passive: false });
			},
		};
	},
]);
