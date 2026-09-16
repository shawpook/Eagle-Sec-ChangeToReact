(function() {
    'use strict';

    EagleApp
        .factory('UrlStateService', ['$location', '$rootScope', function($location, $rootScope) {
            var listeners = [];
            function getState() {
                var search = $location.search();
                return {
                    view: search.view || 'all',
                    folder: search.folder || null,  // Keep as string, don't parseInt
                    smartfolder: search.smartfolder || null,  // Keep as string, don't parseInt
                    color: search.color || null,
                    page: search.page ? parseInt(search.page) : 1,
                    imageFilter: search.imageFilter || null
                };
            }
            
            function setState(params, replace) {
                var current = $location.search();
                var merged = angular.extend({}, current, params);
                
                angular.forEach(merged, function(value, key) {
                    if (value === null || value === undefined || value === '') {
                        delete merged[key];
                    }
                });
                
                $location.search(merged);
                
                if (replace) {
                    $location.replace();
                }
                $rootScope.$evalAsync();
            }
            
            function clearState() {
                $location.search({});
            }
            
            function onChange(fn) {
                listeners.push(fn);
                return function() {
                    var index = listeners.indexOf(fn);
                    if (index > -1) {
                        listeners.splice(index, 1);
                    }
                };
            }
            $rootScope.$on('$locationChangeStart', function(event, newUrl, oldUrl) {
                if ($bodyScope.isDetailMode) { event.preventDefault(); }
            });
            
            // Removed popstate and hashchange listeners - $locationChangeSuccess handles everything
            $rootScope.$on('$locationChangeSuccess', function(event, newUrl, oldUrl) {
                if (newUrl !== oldUrl) {
                    var state = getState();
                    listeners.forEach(function(fn) {
                        fn(state);
                    });
                }
            });
            
            return {
                canGoBack: function() {
                    return currentWindow.webContents.canGoBack();
                },
                canGoForward: function() {
                    return currentWindow.webContents.canGoForward();
                },
                getState: getState,
                setState: setState,
                clearState: clearState,
                onChange: onChange
            };
        }]);
})();