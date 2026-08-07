/**
 * @see http://docs.angularjs.org/guide/concepts
 * @see http://docs.angularjs.org/api/ng.directive:ngModel.NgModelController
 * @see https://github.com/angular/angular.js/issues/528#issuecomment-7573166
 */

angular.module('contenteditable', [])
    .directive('contenteditable', ['$timeout', function($timeout) {
        return {
            restrict: 'A',
            require: '?ngModel',
            link: function(scope, element, attrs, ngModel) {

                function linkify(inputText) {
                    var replacedText, replacePattern1, replacePattern2, replacePattern3;

                    //URLs starting with http://, https://, or ftp://
                    replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
                    replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

                    //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
                    replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
                    replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

                    //Change email addresses to mailto:: links.
                    replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
                    replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

                    return replacedText;
                }

                scope.$on('$destroy', function () {
                    element.find("a").off("click");
                });

                // don't do anything unless this is actually bound to a model
                if (!ngModel) {
                    return
                }

                // ngModel.$$setOptions({debounce: 1000, updateOnDefault: true});.

                // ngModel.$$setOptions({
                //     updateOn: 'blur',
                //     updateOnDefault: true,
                //     debounce: {
                //         'blur': 2000,
                //         'default': 3000
                //     }
                // });

                // options
                var opts = {}
                angular.forEach([
                    'stripBr',
                    'noLineBreaks',
                    'selectNonEditable',
                    'moveCaretToEndOnChange',
                    'stripTags',
                    'allowLink'
                ], function(opt) {
                    var o = attrs[opt]
                    opts[opt] = o && o !== 'false'
                })

                element.on('keydown', function(e) {
                    if (e.keyCode === 27) {
                        e.stopPropagation();
                        e.preventDefault();
                    }

                    // if ctrl / cmd / shift + enter, prevent default, and insert <br>
                    if ((e.ctrlKey || e.metaKey || e.shiftKey) && e.keyCode === 13) {
                        e.preventDefault();
                        e.stopPropagation();
                        document.execCommand('insertHTML', false, '<br><br>');
                    }

                    // prevent trigger electron keydown event when press shift + , and shift + . ,but allow text input
                    if (e.shiftKey && e.keyCode === 188) {
                        e.preventDefault();
                        e.stopPropagation();
                        document.execCommand('insertHTML', false, '<');
                    }
                    if (e.shiftKey && e.keyCode === 190) {
                        e.preventDefault();
                        e.stopPropagation();
                        document.execCommand('insertHTML', false, '>');
                    }
                });

                // view -> model
                element.on('blur', function(e) {
                    // scope.$apply(function() {
                        var html, html2, rerender, originalHTML;
                        html = element.html();
                        originalHTML = html;
                        rerender = false
                        if (opts.stripBr) {
                            html = html.replace(/<br>$/, '')
                        }
                        if (opts.noLineBreaks) {
                            html2 = html.replace(/<div>/g, '').replace(/<br>/g, '').replace(/<\/div>/g, '').replace(/(\r\n|\n|\r)/g, '')
                            if (html2 !== html) {
                                rerender = true
                                html = html2
                            }
                        }

                        // 避免輸出內容出現 <div>xxx</div>
                        html = html.replace(/<div>/g, '').replace(/<\/div>/g, '')

                        if (html && html.replaceAll) {
                            html = html.replaceAll("&amp;", "&");
                        }
                        ngModel.$setViewValue(html);
                        if (originalHTML !== html) {
                            if (rerender) {
                                ngModel.$render()
                            }
                            else if (html.length !== linkify(html)) {
                                ngModel.$render();
                            }
                        }
                        // if (html === '') {
                            // the cursor disappears if the contents is empty
                            // so we need to refocus
                            // $timeout(function() {
                                // element[0].blur()
                                // element[0].focus()
                            // })
                        // }
                    // })
                });

                // element.on('input', function(e) {
                //     var html, html2, rerender
                //     html = element.html()
                //     rerender = false
                //     if (opts.stripBr) {
                //         html = html.replace(/<br>$/, '')
                //     }
                //     if (opts.noLineBreaks) {
                //         html2 = html.replace(/<div>/g, '').replace(/<br>/g, '').replace(/<\/div>/g, '')
                //         if (html2 !== html) {
                //             rerender = true
                //             html = html2
                //         }
                //     }
                //     html = html.replaceAll("&amp;", "&");
                //     ngModel.$setViewValue(html);
                // });

                // model -> view
                var oldRender = ngModel.$render
                ngModel.$render = function() {
                    var el, el2, range, sel
                    if (!!oldRender) {
                        oldRender()
                    }
                    var html = ngModel.$viewValue || ''

                    if (new RegExp(/<\/?[b-z\d][^>]*>/ig).test(html)) {
                        element.text(html);
                    }
                    else {
                        html = html.replace(/<\S[^><]*>/g, '')

                        if (opts.allowLink) {
                            html = linkify(html);
                            element.html(html);
                        }
                        else {
                            element.text(html);
                        }
                    }
                    
                    // NOTE: 不需要再次绑定，因为已經有全域的绑定了
                    // element.find("a").on("click", function () {
                    //     var link = this.href;
                    //     if (link) {
                    //         shell.openExternal(link);
                    //     }
                    // });

                    // NOTE: 这里不能使用 html()，这样会导致一些 < 开头的文字被当成 HTML Tag 最终无法显示在画面上
                    // 例如 <p 无法显示
                    // element.text(html);
                    // element.html(html);

                    if (opts.moveCaretToEndOnChange) {
                        el = element[0]
                        range = document.createRange()
                        sel = window.getSelection()
                        if (el.childNodes.length > 0) {
                            el2 = el.childNodes[el.childNodes.length - 1]
                            range.setStartAfter(el2)
                        } else {
                            range.setStartAfter(el)
                        }
                        range.collapse(true)
                        sel.removeAllRanges()
                        sel.addRange(range)
                    }
                }
                if (opts.selectNonEditable) {
                    element.bind('click', function(e) {
                        var range, sel, target
                        target = e.toElement
                        if (target !== this && angular.element(target).attr('contenteditable') === 'false') {
                            range = document.createRange()
                            sel = window.getSelection()
                            range.setStartBefore(target)
                            range.setEndAfter(target)
                            sel.removeAllRanges()
                            sel.addRange(range)
                        }
                    })
                }
            }
        }
    }]);
