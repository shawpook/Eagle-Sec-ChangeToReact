EagleApp.directive('tagsInput', function ($timeout, $rootScope) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/tags-input.html',
        replace: true,
        scope: {
            theme: '=theme',
            tags: '=',
            onChange: '&'
        },
        link: function ($scope, element) {

            $scope.TagManager = $bodyScope.TagManager;

            $scope.remove = (tag) => {
                const index = $scope.tags.indexOf(tag);
                if (index >= 0) {
                    $scope.tags.splice(index, 1);
                    $scope.onChange();
                }
            };

            element.on("click", function (e) {
                e.stopPropagation();
                const originSelected = $scope.tags.reduce((map, tag) => {
                    map[tag] = true;
                    return map;
                }, {});

                GeneralTagSelectPanel.open({
                    tagManager: $scope.TagManager,
                    selectedTags: originSelected,
                    // showCreateTagBtn: false,
                    onChanged: (result) => {
                        const { selectedTags } = result;
                        $scope.tags = Object.keys(selectedTags);
                        $scope.$evalAsync(() => {
                            $timeout(() => {
                                $scope.onChange && $scope.onChange();
                            });
                        });
                    }
                });
            });
        }
    }
});