var AnnotationPreview = {
    hovering: false,
    isShow: false,
    lastElem: undefined,
    hoverTimeout: undefined,
    hideTimeout: undefined,
    inputTimeout: undefined,
    $container: undefined,
    show: function (autoFocus) {

        if (!AnnotationPreview.lastElem) return;

        AnnotationPreview.isShow = true;
        AnnotationPreview.$container = $("#annotation-preview-container");
        var $annotationBox = AnnotationPreview.$container.find(".annotation-box");
        var $annotationArrow = AnnotationPreview.$container.find(".annotation-arrow");
        var commentScope = angular.element(AnnotationPreview.lastElem).scope();

        if (!commentScope) return;
        var comment = commentScope.comment;

        // if ($bodyScope.currentComment !== comment) {
            $bodyScope.currentComment = comment;
            $bodyScope.$apply();
            let $input = $("#annotation-preview-container .annotation-box");
            $input.html(comment.annotation);
            try {
                document.execCommand('selectAll', false, null);
                document.getSelection().collapseToEnd();
            }
            catch (err) {}
        // }

        var offset = AnnotationPreview.lastElem.getClientRects()[0];
        if (!offset) return;
        var x = offset.left;
        var y = offset.top;
        var width = offset.width;
        var height = offset.height;
        var displayX = x + width / 2;

        var windowWidth = $(window).width();
        var windowHeight = $(window).height();

        var finalX = displayX;
        var finalY = y - 2;

        AnnotationPreview.$container.addClass("show");

        var boxWidth = $annotationBox.width();
        var boxHeight = $annotationBox.outerHeight();
        var offsetX = 0;
        var offsetY = 0;

        // if (finalX + boxWidth/2 > windowWidth) {
        // 	offsetX = (finalX + boxWidth/2 - windowWidth);
        // }
        // else if (finalX < boxWidth/2) {
        // 	finalX = boxWidth;
        // }

        if (finalY + boxHeight/2 > windowHeight) {
            offsetY = (finalY + boxHeight/2 - windowHeight);
        }
        else if (finalY < boxHeight/2) {
            finalY = boxHeight + 6;
        }

        $annotationBox.css({
        	left: finalX - offsetX,
        	top: finalY - offsetY
        });

        $annotationArrow.css({
        	left: finalX - 5,
        	top: finalY - 6
        });
        
        AnnotationPreview.$container.addClass("show");

        if (autoFocus) {
        	setTimeout(function () {
        		AnnotationPreview.focus();
        	}, 100);
        }
    },
    focus: function () {
    	try {
	    	var $box = $("#annotation-preview-container .annotation-box");
	    	if ($box.length > 0) {
                setTimeout(() => {
                    $box.focus();
                    document.execCommand('selectAll', false, null);
                    var selection = document.getSelection();
                    if (selection) {
                        selection.collapseToEnd();
                    }
                }, 24);
	    	}
    	}
    	catch (err) {}
    },
    blur: function () {
        try {
        	setTimeout(function () {
        		$("#annotation-preview-container .annotation-box").blur();
	    		window.getSelection().removeAllRanges();
        	}, 100)
	    	$timeout(function () {
	    		$bodyScope.currentComment = undefined;
	    	}, 1);
    	}
    	catch (err) {}
    },
    hide: function () {
        AnnotationPreview.isShow = false;
        AnnotationPreview.$container = $("#annotation-preview-container");
        if (AnnotationPreview.$container.hasClass("show")) {
            AnnotationPreview.$container.removeClass("show");
        }
        // $("#annotation-preview-container-input").focus();
        // setTimeout(function () {
        //     $("#annotation-preview-container-input").blur();
        // }, 50);
    }
};

$("body").on('paste input', '#annotation-preview-container .annotation-box', function(event) {
    const $this = $(this);
    if ($this.data('before') === $this.html()) return;

	var that = this;
	var comment = $bodyScope.currentComment;
	clearTimeout(AnnotationPreview.inputTimeout);
	AnnotationPreview.inputTimeout = setTimeout(function () {

        var html = $(that).html();
        html = html.replaceAll("&amp;", "&");
        comment.annotation = html;
        $bodyScope.$evalAsync();

		console.log(comment.annotation);
		if (comment && comment.annotation !== undefined) {
	    	if ($bodyScope.current) {
	    		ayncsImagesChange([$bodyScope.current]);
                hiddenByCurrentFilter([$bodyScope.current]);
	    	}
	    }
	}, 500);
});

$("body").on('keydown', '#annotation-preview-container .annotation-box', function(event) {
    if (event.keyCode === 13) {
        if (event.shiftKey || event.ctrlKey) {
            event.preventDefault();

            // insert change line to plain text contenteditable
            var selection = window.getSelection();
            var range = selection.getRangeAt(0);
            var br = document.createElement("br");
            range.deleteContents();
            range.insertNode(br);
            range.setStartAfter(br);
            range.setEndAfter(br);
            selection.removeAllRanges();
            selection.addRange(range);
            
            return;
        }
    }
});

$("body").on('focus', '#annotation-preview-container .annotation-box', function(event) {
    const $this = $(this);
    $this.data('before', $this.html());
    if (!$bodyScope.isCommentMode) {
        let $this = $(this);
        event.stopPropagation();
        event.preventDefault();
        setTimeout(function () {
            $this.blur();
        }, 33);
    }
});

$("body").on('mouseover', '#annotation-preview-container .annotation-box', function(event) {
    AnnotationPreview.hovering = true;
});

$("body").on('mouseleave', '#annotation-preview-container .annotation-box', function(event) {
    if ($(document.activeElement).hasClass("annotation-box")) return;
    AnnotationPreview.hovering = false;
    if (AnnotationPreview.lastElem) {
        clearTimeout(AnnotationPreview.hoverTimeout);
        clearTimeout(AnnotationPreview.hideTimeout);
        AnnotationPreview.hide();
    }
});

$("body").on('mouseover', '.content-panel .detail-container .comments .comment', function(event) {;
    if ($(document.activeElement).hasClass("annotation-box")) return;
    clearTimeout(AnnotationPreview.hoverTimeout);
    clearTimeout(AnnotationPreview.hideTimeout);
    AnnotationPreview.lastElem = this;
    AnnotationPreview.hoverTimeout = setTimeout(function () {
    	AnnotationPreview.show();
    }, 30);
});

$("body").on('click', '.content-panel .detail-container .comments .comment', function(event) {;
    clearTimeout(AnnotationPreview.hoverTimeout);
    clearTimeout(AnnotationPreview.hideTimeout);
    AnnotationPreview.lastElem = this;
    AnnotationPreview.hoverTimeout = setTimeout(function () {
        AnnotationPreview.show();
    }, 30);
});

$("body").on('mouseleave', '.content-panel .detail-container .comments .comment', function(event) {
    if ($(document.activeElement).hasClass("annotation-box")) return;
    clearTimeout(AnnotationPreview.hoverTimeout);
    AnnotationPreview.hideTimeout = setTimeout(function () {
        if (AnnotationPreview.lastElem && !AnnotationPreview.hovering) {
            clearTimeout(AnnotationPreview.hoverTimeout);
            clearTimeout(AnnotationPreview.hideTimeout);
            AnnotationPreview.hide();
        }
    }, 50);
});

