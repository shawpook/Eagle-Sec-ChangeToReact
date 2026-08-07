angular.module('tippy', []).directive('tippy', function($timeout, $rootScope) {
    return {
        restrict: 'A',
        link: function ($scope, element, attrs, controllersArr) {

            let instance = null;

            init();

            attrs.$observe('tippyContent', function (val) {
                init();
            });
            
            function init () {
                if (!attrs.tippyContent) return;
                if (instance) {
                    instance.destroy();
                }
                instance = tippy(element[0], {
                    animation: 'scale',
                    arrow: false,
                    content: attrs.tippyContent || '',
                    placement: attrs.tippyPlacement || 'right',
                    allowHTML: true,
                });
            }
        }
    }
});