// 音频悬停播放
// MP4 文件悬停自动播放
var mouseoverAudioTimeout;
var updateCursorInterval;
var mouseoverAudioProgressTimeout;
var playingAudiosElements = [];
$("#box-container").on('mouseenter', '.box.mp3 .thumbnail, .box.wav .thumbnail, .box.flac .thumbnail, .box.ogg .thumbnail, .box.aac .thumbnail, .box.m4a .thumbnail', function(event) {
    event.stopPropagation();

    // if (dragging) return;
    if (rectSelecting) return;
    if (event.which === 1) return;

    var $scope = angular.element("body").scope();
    var $box = $(".box").has(this);
    var image = $scope.getItemByElement($box[0]);

    if (!image) return;
    if (image.noPreview) return;

    // 悬停 500ms 在开始播放
    clearTimeout(mouseoverAudioTimeout);
    mouseoverAudioTimeout = setTimeout(function () {
        var $audios = $box.find("audio");
        if ($audios.length > 0) {
            return;
            $audios[0].pause();
            $audios[0].src = "";
            $audios.remove();
        }
        var $image = $box.find("img");

        var $autoPlayBtn = $('<div class="autoplay-toggle"></div>');
        var autoplay = localStorage["listAudioAutoPlay"] != 'false';
        if (autoplay) {
            $autoPlayBtn.addClass("pause");
        }
        else {
            $autoPlayBtn.removeClass("pause");
        }
        console.log(autoplay);

        var imageWidth = $image.width();
        var imageHeight = $image.height();
        var src = $image.attr("src");
        var imageDir = `${$bodyScope.libraryPath.replace(/#/g, '%23')}/images/`
        $box.find(".audio-progress-bar").remove();
        $box.find(".current-time").remove();
        var $progressbar = $(`<div class="audio-progress-bar"><img src="${src}" style="height: ${imageHeight}px !important; width: ${imageWidth}px !important;"/></div>`);
        var $currentTime = $(`<div class="current-time">00:00</div>`);
        var $progressbarCurosr = $(`<div class="audio-progress-bar-cursor"></div>`);
        var audio = $('<audio/>', {
            id: 'audio',
            src: $bodyScope.getRawUrl(image),
            type: 'audio/' + image.ext,
            controls: false,
            autoplay: autoplay,
            // muted: muted,
            draggable: true,
            loop: false
        });

        var $controls = $('<div class="controls"></div>');
        $controls.append($currentTime);
        $controls.append($autoPlayBtn);
        
        var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
        audio[0].volume = parseInt(volume) / 100;

        playingAudiosElements.push(audio[0]);

        if ($box.find("audio").length === 0) {

            $autoPlayBtn.on("mouseover", function (event) {
                event.stopPropagation();
            });

            $autoPlayBtn.on("mousedown", function (event) {
                event.stopPropagation();
            });

            $autoPlayBtn.on("dblclick", function (event) {
                event.stopPropagation();
            });

            $autoPlayBtn.on("click", function (event) {
                console.log("click");
                event.stopPropagation();
                // audio.get(0).muted = !audio.get(0).muted;
                // muted = audio.get(0).muted;
                if (!audio[0].paused) {
                    audio[0].pause();
                    $autoPlayBtn.removeClass("pause");
                    autoplay = false;
                }
                else {
                    audio[0].play();
                    $autoPlayBtn.addClass("pause");
                    autoplay = true;
                }
                localStorage.setItem("listAudioAutoPlay", autoplay);
            });

            $box.find(".thumbnail").prepend($controls);

            audio.on('ended', function() {
                var delay = setTimeout(function(){
                    this.currentTime = 0;
                    audio[0].play();
                    clearTimeout(delay);
                }, 200);
            });

            audio.on('playing', function() {
                mouseoverAudioProgressTimeout = setTimeout(function () {
                    $box.find(".thumbnail").prepend($progressbar).prepend($progressbarCurosr);
                    $image.on('mousemove.progressCursor', function (event) {
                        var mouseX = event.offsetX;
                        $progressbarCurosr.css({
                            left: `${mouseX}px`
                        });
                    });
                    setTimeout(function () {
                        $image.on('mousedown.duration', function (event) {
                            var mouseX = event.offsetX;
                            var duration = audio.get(0).duration;
                            var mouseTime = (duration * mouseX / $image.width());
                            if (angular.isNumber(mouseTime) && mouseTime > 0) {
                                audio.get(0).currentTime = mouseTime;
                            }
                        });
                    }, 300);
                }, 100);
            });

            // audio.on('ended', function () {
            //     audio.get(0).currentTime = 0;
            //     setTimeout(function () {
            //         audio.get(0).play();
            //     }, 200);
            // });

            updateCursorInterval = setInterval(function () {
                if (!document.body.contains(audio.get(0))) {
                    clearInterval(updateCursorInterval);
                    return;
                }
                var currentTime = audio.get(0).currentTime;
                var duration = audio.get(0).duration;
                var percentage = currentTime / duration * 100;
                if (percentage > 1 || percentage < 100) {
                    $progressbar.width(percentage + "%");
                }
                else {
                    $progressbar.width("0%");
                }
                $currentTime.html(getDurationString(currentTime, duration));
            }, 16);

            $box.find(".thumbnail").prepend(audio);
            startHoverPreviewWatch($box);
        }
    }, 200);
});

$("#box-container").on('mouseleave', '.box.mp3 .thumbnail, .box.wav .thumbnail, .box.flac .thumbnail, .box.ogg .thumbnail, .box.aac .thumbnail, .box.m4a .thumbnail', removeBoxAudioPlayer);
$("#box-container").on('dragstart', '.box.mp3 .thumbnail, .box.wav .thumbnail, .box.flac .thumbnail, .box.ogg .thumbnail, .box.aac .thumbnail, .box.m4a .thumbnail', removeBoxAudioPlayer);

currentWindow.on('hide', removePlayingAudios);

function removePlayingAudios () {
    $('#box-container .box.hover-active').each(function () {
        cleanupBoxHoverPreview($(this));
    });
};

function removeBoxAudioPlayer (event) {
    
    if (event) {
        if (event.originalEvent) {
            if (!event.originalEvent.screenX || !event.originalEvent.screenY) {
                return;
            } 
        }
        event.stopPropagation();
    }

    var $scope = angular.element("body").scope();
    var $box = $(".box").has(event.target);
    disarmHoverSentinel($box);
    var image = $scope.getItemByElement($box[0]);

    if (!image) return;

    var $image = $box.find("img");

    // 悬停 500ms 在开始播放
    clearTimeout(mouseoverAudioTimeout);
    clearTimeout(mouseoverAudioProgressTimeout);
    clearInterval(updateCursorInterval);
    $image.off('mousedown.duration').off('mousemove.progressCursor');
    $box.find(".current-time").remove();
    $box.find(".audio-progress-bar").off().remove();
    $box.find(".audio-progress-bar-cursor").remove();
    $box.find(".autoplay-toggle").off();
    $box.find(".controls").remove();

    if (playingAudiosElements.length > 0) {
        playingAudiosElements.forEach(function (audio) {
            audio.pause();
            audio.src = "";
            $(audio).remove();
        });
        playingAudiosElements = [];
    }
}
