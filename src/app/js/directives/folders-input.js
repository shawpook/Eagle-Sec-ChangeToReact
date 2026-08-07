EagleApp.directive('foldersInput', function ($timeout, $rootScope) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/folders-input.html',
        replace: true,
        scope: {
            theme: '=theme',
            folderIds: '=',
            onChange: '&'
        },
        link: function ($scope, element) {
            $scope.folderMappings = $bodyScope.folderMappings;
            $scope.remove = (index) => {
                $scope.folderIds.splice(index, 1);
                $scope.onChange();
            };

            element.on("click", function (e) {
                e.stopPropagation();

                const folders = $bodyScope.folders;
                const originalSelectedIds = $scope.folderIds.reduce((map, id) => {
                    map[id] = true;
                    return map;
                }, {});

                FolderSelectPanel.open({
                    folders: folders,
                    selectedIds: originalSelectedIds,
                    onChanged: (result) => {
                        if (!result?.isDirty) return;
                        const { selectedFolderIds, deselectedFolderIds } = result;
                        $scope.folderIds = Object.keys(selectedFolderIds);
                        $scope.$evalAsync(() => {
                            $timeout(() => {
                                $scope.onChange();
                            });
                        });
                    }
                });
            });
        }
    }
});