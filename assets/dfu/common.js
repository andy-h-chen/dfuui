// TODO: cancel file upload on addReport dialog cancel
// TODO: Redirect to login on websocket disconnection
// TODO: always request list from server when 'switch site' is called
// TODO: fix summary tab for 'switch site'
Date.prototype.addDays = function(days) {
    this.setDate(this.getDate() + parseInt(days));
    return this;
};

$.mobile.switchPopup = function(sourceId, targetId) {
    $('#' + sourceId).on('popupafterclose', function() {
        $('#' + targetId).popup('open');
        $('#' + sourceId).off('popupafterclose');
    });
};

$( document ).on( "pagecreate", function() {
    $( ".photopopup" ).on({
        popupbeforeposition: function() {
            var maxHeight = $( window ).height() - 150 + "px";
            $( ".photopopup img" ).css( "max-height", maxHeight );
        }
    });
});

var gui = {},
    dfu = {},
    socket;
gui.hasPermission = function (perm) {
    return true;
    if (!perm || !dfu.user || !dfu.user.all_perms) {
        return false;
    }
    for(var i=0; i<dfu.user.all_perms.length; i++) {
        if (dfu.user.all_perms[i].key === perm) {
            return true;
        }
    }
    return false;
};
gui.utils = (function(){
    var api = {
        copy: function (obj) {
            var i,
                newObj = jQuery.isArray(obj) ? [] : {};

            if (typeof obj === 'number' ||
                typeof obj === 'string' ||
                typeof obj === 'boolean' ||
                obj === null ||
                obj === undefined) {
                return obj;
            }

            if (obj instanceof Date) {
                return new Date(obj);
            }

            if (obj instanceof RegExp) {
                return new RegExp(obj);
            }

            for (i in obj) {
                if (obj.hasOwnProperty(i)) {
                    if (obj[i] && typeof obj[i] === "object") {
                        if (obj[i] instanceof Date) {
                            newObj[i] = obj[i];
                        }
                        else {
                            newObj[i] = api.copy(obj[i]);
                        }
                    }
                    else {
                        newObj[i] = obj[i];
                    }
                }
            }

            return newObj;
        },
        getRandomInt: function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
    };
    return api;
}());

gui.error = (function(){
    var api = {
        /** Wraps a function in a try/catch.
          * On catch of an error it prints it out using `during` to provide context.
          * `during` may be a string or an index into the arguments array of the wrapped function.
          */
        wrap: function (f, during) {
            return function () {
                try {
                    return f.apply(null, arguments);
                } catch (e) {
                    var duringStr = '';
                    if (during !== undefined) {
                        duringStr = ' (during "' + (during >= 0 ? arguments[during] : during) + '")';
                    }
                    console.error(e.name + ': ' + e.message + duringStr);
                    console.log(e && e.stack || e);
                }
            };
        },

        wrapAll: function (lib, prefix) {
            for (var f in lib) {
                if (typeof lib[f] === 'function') {
                    lib[f] = module.exports.wrap(lib[f], prefix ? prefix + f : f);
                }
            }
        },
    };
    return api;
}());

gui.events = (function(){
    var _listeners = {};
    function on(type, listener, once) {
        if (!type) {
            throw "type must be truthy";
        }
        if (!listener || listener === null || typeof listener !== 'function') {
            throw "Could not add listener for event '" + type + "' " + (listener ? "this listener isn't a function" : "this listener is undefined");
        }
        _listeners[type] = _listeners[type] || [];
        for (var i = 0; i < _listeners[type].length; i++) {
            if (_listeners[type][i] && _listeners[type][i].origFunc === listener) {
                console.warn("Could not add listener for event '" + type + "' this listener is already registered on this event");
                return;
            }
        }
        //if (_listeners[type].length === 0) {
        //    module.exports.emit('event.type.added', [type], true);
        //}
        _listeners[type].push({
            origFunc: listener,
            func: gui.error.wrap(listener, type),
            once: !!once,
        });
    }

    function emit(listener, args, sync) {
        if (sync) {
            listener.func.apply(undefined, args);
        } else {
            setTimeout(function () {
                listener.func.apply(undefined, args);
            }, 1);
        }
    }

    var api = {
        on: function (type, listener) {
            on(type, listener, false);
        },

        once: function (type, listener) {
            on(type, listener, true);
        },

        emit: function (type, args, sync) {
            args = args || [];
            // Default value for sync is true.
            sync = sync || sync === undefined;

            if (_listeners[type]) {
                _listeners[type].forEach(function (listener, indexOfArray, array) {
                    emit(listener, args, sync);
                    if (listener.once) {
                        delete array[indexOfArray];
                    }
                });
            }
        },

        clear: function (type) {
            if (type) {
                delete _listeners[type];
            }
        },

        un: function (type, callback) {
            if (type && callback && _listeners[type]) {
                _listeners[type] = _listeners[type].filter(function (listener) {
                    return !((listener.func === callback || listener.origFunc === callback) && _listeners[type].indexOf(listener) !== -1);
                });
            }
        },

        isOn: function (type) {
            if (!_listeners[type]) {
                return false;
            }
            return typeof _listeners[type] !== "undefined" && _listeners[type].length !== 0;
        },

        FILTER_ANY: {} // This is a sentinel value that allows wildcard matching in pre-filerted events.
    };
    return api;
}());

gui.drawBarChart = function (dataName, barColor, dataValue, canvasId) {
    if (!canvasId)
        return;
    // set these values for your data
    var numSamples = 4,
        maxVal = 100,
        stepSize = 50,
        colHead = 30,
        rowHead = 10,
        margin = 10,
        header = "%",
        y;
    var canvasDiv = document.getElementById(canvasId);
    var canvas = document.createElement('canvas');
    canvas.setAttribute('width', canvasDiv.clientWidth);
    canvas.setAttribute('height', canvasDiv.clientHeight);
    canvasDiv.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "black"
    var yScalar = (canvas.height - colHead - margin) / (maxVal);
    var xScalar = (canvas.width - rowHead) / (numSamples );
    ctx.strokeStyle = "rgba(128,128,255, 0.5)"; // light blue line
    ctx.beginPath();
    // print  column header
    //ctx.font = "14pt Helvetica"
    //ctx.fillText(header, 0, colHead - margin);
    // print row header and draw horizontal grid lines
    ctx.font = "12pt Monospace";
    var count =  0;
    for (scale = maxVal; scale >= 0; scale -= stepSize) {
        y = colHead + (yScalar * count * stepSize);
        ctx.fillText(scale, 2, y);
        ctx.moveTo(rowHead, y)
        ctx.lineTo(canvas.width, y)
        count++;
    }
    ctx.stroke();
    // label samples
    ctx.font = "9pt Monospace";
    ctx.textBaseline = "bottom";
    ctx.rotate(-Math.PI/2);
    for (i = 0; i < 4; i++) {
        y = canvas.height - dataValue[i] * yScalar;
        //ctx.fillText(dataName[i], xScalar * (i + 1), y - margin);
        ctx.fillText(dataName[i], -canvas.height + 10, xScalar * (i + 1) + xScalar * 0.05);
    }
    ctx.rotate(Math.PI/2);
    // set a color and a shadow
    ctx.fillStyle = "blue";
    ctx.shadowColor = 'rgba(128,128,128, 0.5)';
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 1;
    // translate to bottom of graph and scale x,y to match data
    ctx.translate(0, canvas.height - margin);
    ctx.scale(xScalar, -1 * yScalar);
    // draw bars
    for (i = 0; i < 4; i++) {
        ctx.fillStyle = barColor[i];
        ctx.fillRect(i + 0.25, 0, 0.6, dataValue[i]);
    }
}

gui.drawChartSweepView = function(canvasId, p1, p2, avg, avgTxt) {
    var DRAGGING_ONHANDLE1 = 1,
        DRAGGING_ONHANDLE2 = 2,
        DRAGGING_NO = 0;
    var div = document.getElementById(canvasId),
        canvas = document.createElement('canvas');
    //console.log(div.clientWidth, div.clientHeight);
    canvas.width = div.clientWidth - 40;
    canvas.height = div.clientHeight - 20;
    div.appendChild(canvas);
    var canvasMargin = 16,
        handleRadius = 12,
        handleXFixed = canvas.width - 15,
        isDragging = DRAGGING_NO,
        textColor = 'black',
        textFont = '1em Nexa',
        axisColor = 'black';
    var mousePos, lastPos;
    var SweepBar = function(handlePosition, barColor, areaColor, rangeMax, rangeMin) {
        //console.log(handlePosition.x, handlePosition.y);
        var self = this,
            percentage = Math.floor(100*(1 - (handlePosition.y - canvasMargin) / (canvas.height - 2*canvasMargin)));
        this.swipeRangeMax = rangeMax;
        this.swipeRangeMin = rangeMin;
        this.handlePos = handlePosition;
        this.barColor = barColor;
        this.areaColor = areaColor;
        this.draw = function(pos) {
            if (pos && pos.y < self.swipeRangeMax && pos.y > self.swipeRangeMin) {
                self.handlePos = pos;
                //console.log(pos.x, pos.y, self.swipeRangeMax, self.swipeRangeMin);
            }
            var x = self.handlePos.x, y = self.handlePos.y;
            ctx.moveTo(x, y);
            ctx.lineTo(0, y);
            ctx.strokeStyle = self.barColor;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, handleRadius, 0, 2*Math.PI, false);
            ctx.fillStyle = self.barColor;
            ctx.fill();
            ctx.fillStyle = self.fillStyle;
            ctx.fillRect(canvasMargin, self.handlePos.y, canvas.width - 2*canvasMargin - 2*handleRadius, canvas.height - canvasMargin - self.handlePos.y);
            percentage = Math.floor(100*(1 - (self.handlePos.y - canvasMargin) / (canvas.height - 2*canvasMargin)));
            ctx.fillStyle = textColor;
            ctx.font = textFont;
            ctx.fillText(percentage, 0, self.handlePos.y - 2);
        };
        this.isOnHandle = function(pos) {
            var x = pos.x, y = pos.y;
            //return  (x < self.handlePos.x + handleRadius && x > self.handlePos.x - handleRadius*20) && 
            return (y < self.handlePos.y + handleRadius && y > self.handlePos.y - handleRadius );
        };
        this.setSwipeRange = function(max, min) {
            self.swipeRangeMax = max;
            self.swipeRangeMin = min;
        };
        this.getValue = function() {
            return percentage;
        };
    };

    var ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;

    var drawAxes = function() {
        ctx.strokeStyle = axisColor;
        ctx.moveTo(canvasMargin, canvasMargin);
        ctx.lineTo(canvasMargin, canvas.height);
        ctx.stroke();
        ctx.moveTo(0, canvas.height - canvasMargin);
        ctx.lineTo(canvas.width - canvasMargin, canvas.height - canvasMargin);
        ctx.moveTo(0, canvasMargin);
        ctx.lineTo(canvas.width - canvasMargin, canvasMargin);
        //ctx.strokeStyle = 'green';
        ctx.stroke();
        ctx.fillStyle = 'green';
        ctx.fillRect(canvasMargin, canvasMargin, canvas.width - 2*canvasMargin - 2*handleRadius, canvas.height - 2*canvasMargin);
        ctx.fillStyle = textColor;
        ctx.font = textFont;
        ctx.fillText("100", 0, canvasMargin - 2);
    };
    var drawAvg = function() {
        if (avg < 0 || avg > 100) return;

        var y = (1 - avg/100) * (canvas.height-2*canvasMargin) + canvasMargin; 
        ctx.moveTo(handleXFixed, y);
        ctx.lineTo(0, y);
        ctx.strokeStyle = 'grey';
        ctx.stroke();
        ctx.font = textFont;
        ctx.fillStyle = textColor;
        ctx.fillText(avgTxt, 20, y - 2);
    };

    // Set up mouse events for drawing
    var drawing = false;
    var mousePos = { x:0, y:0 };
    var lastPos = mousePos;
    canvas.addEventListener("mousedown", function (e) {
        lastPos = getMousePos(canvas, e);
        isDragging = sb1.isOnHandle(lastPos) ? DRAGGING_ONHANDLE1 : (sb2.isOnHandle(lastPos) ? DRAGGING_ONHANDLE2 : DRAGGING_NO);
    }, false);
    canvas.addEventListener("mouseup", function (e) {
        if (isDragging !== DRAGGING_NO) {
            gui.events.emit('chart_swipe_view_updated', [{canvasId: canvasId, upperThreshold: sb2.getValue(), lowerThreshold: sb1.getValue()}]);
        }
        isDragging = DRAGGING_NO;
    }, false);
    canvas.addEventListener("mousemove", function (e) {
        mousePos = getMousePos(canvas, e);
    }, false);

    // Get the position of the mouse relative to the canvas
    function getMousePos(canvasDom, mouseEvent) {
        var rect = canvasDom.getBoundingClientRect();
        return {
            x: mouseEvent.clientX - rect.left,
            y: mouseEvent.clientY - rect.top
        };
    }

    window.requestAnimFrame = (function (callback) {
        return window.requestAnimationFrame || 
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimaitonFrame ||
        function (callback) {
        window.setTimeout(callback, 1000/60);
        };
    })();
    // Draw to the canvas
    function renderCanvas() {
        if (isDragging != DRAGGING_NO) {
            //ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = canvas.width;
            drawAxes();
            if (isDragging == DRAGGING_ONHANDLE1) {
                sb2.draw();
                sb1.draw({x: handleXFixed, y: mousePos.y});
                sb2.setSwipeRange(sb1.handlePos.y, canvasMargin);
            } else {
                sb2.draw({x: handleXFixed, y: mousePos.y});
                sb1.draw();
                sb1.setSwipeRange(canvas.height - canvasMargin, sb2.handlePos.y);
            }
            drawAvg();
            lastPos = mousePos;
        }
    }

    // Allow for animation
    (function drawLoop () {
        requestAnimFrame(drawLoop);
        renderCanvas();
    })();
    // Set up touch events for mobile, etc
    canvas.addEventListener("touchstart", function (e) {
        e.preventDefault();
        mousePos = getTouchPos(canvas, e);
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousedown", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, false);
    canvas.addEventListener("touchend", function (e) {
        e.preventDefault()
        var mouseEvent = new MouseEvent("mouseup", {});
        canvas.dispatchEvent(mouseEvent);
    }, false);
    canvas.addEventListener("touchmove", function (e) {
        e.preventDefault();
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, false);

    // Get the position of a touch relative to the canvas
    function getTouchPos(canvasDom, touchEvent) {
        var rect = canvasDom.getBoundingClientRect();
        return {
            x: touchEvent.touches[0].clientX - rect.left,
            y: touchEvent.touches[0].clientY - rect.top
        };
    }
    drawAxes();
    var y1 = (1 - p1/100) * (canvas.height-2*canvasMargin) + canvasMargin,
        y2 = (1 - p2/100) * (canvas.height-2*canvasMargin) + canvasMargin;
    var sb1 = new SweepBar({x: handleXFixed, y: y1}, 'red', 'red', canvas.height - canvasMargin, y2);
    var sb2 = new SweepBar({x: handleXFixed, y: y2}, 'orange', 'yellow', y1, canvasMargin);
    sb2.draw();
    sb1.draw();
    drawAvg();
};

gui.drawRectOnImg = function (divId, imgId, x, y, width, height) {
    var DRAGGING_NO = 0,
        DRAGGING_YES = 1,
        DRAGGING_RECT = 2,
        DRAGGING_LEFT = 3,
        DRAGGING_RIGHT = 4,
        DRAGGING_TOP = 5,
        DRAGGING_BOTTOM = 6,
        HANDLE_WIDTH = 10;
    var color = 'red',
        lineWidth = 4,
        div = document.getElementById(divId),
        img = document.getElementById(imgId),
        canvas = document.createElement('canvas'),
        rect = {
            x: x,
            y: y,
            width: width>0 ? width : 100,
            height: height>0 ? height : 100
        };
    while (div.hasChildNodes()) {
        div.removeChild(div.childNodes[0]);
    }
    canvas.width = div.clientWidth > img.width ? img.width : div.clientWidth - 1;
    canvas.height = div.clientHeight - 1;
    div.appendChild(canvas);
    var mousePos = {x:0, y: 0},
        lastPos = mousePos,
        isDragging = DRAGGING_NO;
    function drawRect() {
        switch (isDragging) {
        case DRAGGING_RECT:
            var x = rect.x + mousePos.x - lastPos.x,
                y = rect.y + mousePos.y - lastPos.y;
            rect.x = x<0 ? 0 : x+rect.width > canvas.width ? canvas.width-rect.width : x;
            rect.y = y<0 ? 0 : y+rect.height > canvas.height ? canvas.height-rect.height : y;
            break;
        case DRAGGING_LEFT:
            rect.width = -(mousePos.x - lastPos.x) + rect.width;
            rect.x = mousePos.x;
            break;
        case DRAGGING_RIGHT:
            rect.width = (mousePos.x - lastPos.x) + rect.width;
            break;
        case DRAGGING_TOP:
            rect.height = -(mousePos.y - lastPos.y) + rect.height;
            rect.y = mousePos.y;
            break;
        case DRAGGING_BOTTOM:
            rect.height = mousePos.y - lastPos.y + rect.height;
            break;
        }
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.stroke();
    }
    function drawHandles() {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rect.x, rect.y+rect.height/2, HANDLE_WIDTH, 0, 2*Math.PI, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rect.x+rect.width, rect.y+rect.height/2, HANDLE_WIDTH, 0, 2*Math.PI, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rect.x+rect.width/2, rect.y, HANDLE_WIDTH, 0, 2*Math.PI, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rect.x+rect.width/2, rect.y+rect.height, HANDLE_WIDTH, 0, 2*Math.PI, false);
        ctx.stroke();
    }
    function getDraggingState(pos) {
        if (pos.x > rect.x+HANDLE_WIDTH && pos.x<rect.x+rect.width-HANDLE_WIDTH && pos.y>rect.y+HANDLE_WIDTH && pos.y<rect.y+rect.height-HANDLE_WIDTH) {
            return DRAGGING_RECT;
        }
        if (pos.x>rect.x-HANDLE_WIDTH && pos.x<rect.x+HANDLE_WIDTH && pos.y>rect.y && pos.y<rect.y+rect.height) {
            return DRAGGING_LEFT;
        }
        if (pos.x>rect.x+rect.width-HANDLE_WIDTH && pos.x<rect.x+rect.width+HANDLE_WIDTH && pos.y>rect.y && pos.y<rect.y+rect.height) {
            return DRAGGING_RIGHT;
        }
        if (pos.y>rect.y-HANDLE_WIDTH && pos.y<rect.y+HANDLE_WIDTH && pos.x>rect.x && pos.x<rect.x+rect.width) {
            return DRAGGING_TOP;
        }
        if (pos.y>rect.y+rect.height-HANDLE_WIDTH && pos.y<rect.y+rect.height+HANDLE_WIDTH && pos.x>rect.x && pos.x<rect.x+rect.width) {
            return DRAGGING_BOTTOM;
        }
        return DRAGGING_NO;
    }
    // Get the position of the mouse relative to the canvas
    function getMousePos(mouseEvent) {
        var boundingRect = canvas.getBoundingClientRect();
        return {
            x: mouseEvent.clientX - boundingRect.left,
            y: mouseEvent.clientY - boundingRect.top
        };
    }
    canvas.addEventListener("mousedown", function (e) {
        lastPos = getMousePos(e);
        isDragging = getDraggingState(lastPos);
    }, false);
    canvas.addEventListener("mouseup", function (e) {
        isDragging = DRAGGING_NO;
        if (rect.width < 0) {
            rect.x = rect.x + rect.width;
            rect.width = -rect.width;
        }
        if (rect.height < 0) {
            rect.y = rect.y + rect.height;
            rect.height = -rect.height;
        }
        gui.events.emit('rect_on_image_updated', [{rect: rect}]);
    }, false);
    canvas.addEventListener("mousemove", function (e) {
        lastPos = mousePos;
        mousePos = getMousePos(e);
        if (isDragging != DRAGGING_NO) {
            renderCanvas();
        }
    }, false);
    // Get the position of a touch relative to the canvas
    function getTouchPos(touchEvent) {
        var boundingRect = canvas.getBoundingClientRect();
        return {
            x: touchEvent.touches[0].clientX - boundingRect.left,
            y: touchEvent.touches[0].clientY - boundingRect.top
        };
    }
    // Set up touch events for mobile, etc
    canvas.addEventListener("touchstart", function (e) {
        e.preventDefault();
        mousePos = getTouchPos(e);
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousedown", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, false);
    canvas.addEventListener("touchend", function (e) {
        e.preventDefault()
        var mouseEvent = new MouseEvent("mouseup", {});
        canvas.dispatchEvent(mouseEvent);
    }, false);
    canvas.addEventListener("touchmove", function (e) {
        e.preventDefault();
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
         });
        canvas.dispatchEvent(mouseEvent);
    }, false);
    var ctx = canvas.getContext('2d');
    function renderCanvas() {
        canvas.width = canvas.width;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawRect();
        drawHandles();
    }
    renderCanvas();
}

gui.visualize = function(stream, mediaElm, canvasId) {
    var canvas = $('#' + canvasId)[0];
    var canvasCtx = canvas.getContext("2d");
    var audioCtx = new (window.AudioContext || webkitAudioContext)();
    var analyser = audioCtx.createAnalyser();
    var source;
    if (stream) {
        source = audioCtx.createMediaStreamSource(stream);
    } else if (mediaElm) {
        source = audioCtx.createMediaElementSource(mediaElm);
    }
    analyser.fftSize = 1024;
    var bufferLength = analyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    var numOfBars = Math.floor(canvas.width / 10),
        bar_width = 8;
    //analyser.connect(audioCtx.destination);
    var draw = function() {
        console.log(canvasId, stream == null, mediaElm == null);
        var WIDTH = canvas.width,
        HEIGHT = canvas.height;

        requestAnimationFrame(draw);

        if (!(stream && stream.activeState || mediaElm)) return;
        //analyser.getByteTimeDomainData(dataArray);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.globalAlpha = 0.2;
        canvasCtx.fillStyle = '#B8BBBB';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
        canvasCtx.fillStyle = '#FF6600';
        var bar_x = 0
        for (var i = 0; i < bufferLength; i+=Math.floor(bufferLength/numOfBars)) {
            bar_x += bar_width + 2;
            var bar_height = (dataArray[i] / 2);
            // fillRect( x, y, width, height ) // Explanation of the parameters below
            canvasCtx.fillRect(bar_x, canvas.height/2, bar_width, -bar_height);
            canvasCtx.fillRect(bar_x, canvas.height/2, bar_width, bar_height);
        }
      };
      draw();
    };

gui.toast = function(msg, delay) {
        $("<div class='ui-loader ui-overlay-shadow ui-body-e ui-corner-all'><h3>"+msg+"</h3></div>")
        .css({ display: "block", 
                opacity: 0.9,
                background: 'white', 
                position: "fixed",
                padding: "7px",
                "text-align": "center",
                width: "270px",
                left: ($(window).width() - 284)/2,
                top: $(window).height()/2 })
        .appendTo( $.mobile.pageContainer ).delay( delay ? delay : 2000 )
        .fadeOut( 400, function(){
                $(this).remove();
        });
}

dfu.dfuList = (function() {
    var list = [];
    var api = {
        containsId: function(id){
            var i = list.length;
            while(i--){
                if(list[i].id == id)
                    return true;
            }
            return false;
        },
        removeId: function(id){
            var i = list.length;
            while(i--){
                if(list[i].id == id){
                    var ret = list[i];
                    var rest = list.slice(i+1 || list.length);
                    list.length = i;
                    list.push.apply(list, rest);
                    return ret;
                }
            }
            return null;
        },
        getDfu: function(id){
            var i = list.length;
            while(i--){
                if(list[i].id == id)
                    return list[i];
            }
            return null;
        },
        list: list
    };
    return api;
}());

dfu.liveSensor = (function(){
    var shouldStop = true,
        id;
    var refresh = function () {
        if (shouldStop) {
            return;
        }
        socket.emit('dfu_request', new dfu.Request('query', 'live_sensor', id));
        setTimeout(function () {
            refresh();
        }, 1000);
    };
    var api = {
        start: function (dfuId) {
            if (!shouldStop) {
                return;
            }
            shouldStop = false;
            id = dfuId;
            refresh();
        },
        stop: function () {
            shouldStop = true;
        }
    };
    return api;
}());

gui.iconPath = '../images/senior/';
gui.maxUploadFileSize = 1024 * 1024 * 4; // 4M

dfu.onScreenSensorList = [];

dfu.getSensor = function(dfuId, sensorid) {
    var d = dfu.dfuList.getDfu(dfuId);
    if(!d) return null;
    for(var i=0, groupLen=d.config.Medias.StreamGroup.length; i<groupLen; i++) {
        if (Array.isArray(d.config.Medias.StreamGroup[i].Stream)) {
            for(var j=0, streamLen=d.config.Medias.StreamGroup[i].Stream.length; j<streamLen; j++) {
                if(d.config.Medias.StreamGroup[i].Stream[j].ID === sensorid)
                    return d.config.Medias.StreamGroup[i].Stream[j];
            }
        } else {
            if (d.config.Medias.StreamGroup[i].Stream.ID === sensorid)
                return d.config.Medias.StreamGroup[i].Stream;
        }
    }
    return null;
};

dfu.Request = function (action, operation, dfuId, sensorid, data, binary) {
    this.action = action;
    this.operation = operation;
    this.dfuId = dfuId;
    if (sensorid)
        this.sensorid = sensorid;
    if (data)
        this.data = data;
    if (binary) {
        this.binary = binary;
    }
}

dfu.data = function(id, name) {
    this.id = parseInt(id);
    this.name = name;
};


dfu.const = {
    SBT80: {
        DESC: ['Visual Light', 'Noise', 'Acceleration', 'Magnetic', 'BATTERY', 'STATUS'],
        ICON: 'sensor.png'
    },
    TELOSB: {
        DESC: ['Thermal', 'Humidity', 'BATTERY', 'STATUS'],
        ICON: 'temperature.png'
    },
    WIEYE: {
        DESC: ['PIR', 'Light', 'Acoustic', 'BATTERY', 'STATUS'],
        ICON: 'motion.png'
    },
    VIDEO: {
        ICON: 'camera.png'
    },
    HELP_EVENT: {
        ICON: 'help.png',
        TITLE: 'SOS Alarm'
    },
    FALL_EVENT: {
        ICON: 'fall.png',
        TITLE: 'Fall Alarm'
    },
    WANDER_EVENT: {
        ICON: 'wander.png',
        TITLE: 'Wander Alarm'
    },
    ABNORMAL_EVENT: {
        ICON: 'abnormal.png',
        TITLE: 'Abnormal Alarm'
    }
}

dfu.getSensorConsts = function(sensor) {
    switch (sensor.Type) {
    case 'Video':
        return dfu.const.VIDEO;
    case 'Sensor':
        return dfu.const[sensor.Sensor];
    }
}

gui.OnScreenSensor = function(id, dfuId) {
    var sensor = dfu.getSensor(dfuId, id);
    if (!sensor) {
        console.error('OnScreenSensor sensor not found, id = ', id, ' sensorid = ', id);
        return;
    }
    this.id = id;
    this.dfuId = dfuId;
    this.sensor = sensor;
    this.consts = dfu.getSensorConsts(sensor);
    this.destroy = function () {};
};

gui.MotionSensor = function(id, dfuId) {
    var self = this;
    gui.OnScreenSensor.call(this, id, dfuId);
    var cachedDataReceived = false;
    gui.events.on('live_sensor', function(value) {
        if (!value.response || !value.response.Interaction || value.response.Interaction.OperationType == 'fail' || !value.response.Interaction|| value.response.Interaction.DfuId != self.dfuId || !value.response.Interaction.Sensors) {
            console.log('MotionSensor', value.response.Interaction.OperationType);
            return;
        }
        var data = [];
        if (value.response.Interaction.Sensors.Sensor instanceof Array) {
            data = value.response.Interaction.Sensors.Sensor;
        } else {
            data.push(value.response.Interaction.Sensors.Sensor);
        }
        for (var i = 0; i < data.length; i++) {
            var sensor = data[i];
            if (sensor.SensorId != self.id)
                continue;
            if (!sensor.Channel)
                continue;

            var motionData = [];
            if (sensor.Channel instanceof Array) {
                for (var i=0; i<sensor.Channel.length; i++) {
                    motionData.push(sensor.Channel[i].Value);
                }
                cachedDataReceived = true;
            } else {
                if (!cachedDataReceived) {
                    return;
                }
                motionData.push(sensor.Channel.Value);
            }
            gui.updateMotion(motionData);
        }
 
    });
    setTimeout(function() {
        socket.emit('dfu_request', new dfu.Request('command', 'get_cache', dfu.currentDfuId));
        gui.events.on('get_cache', function(value) {
            console.log('get_cache', value);
            if (!value || !value.response || !value.response.Interaction || value.response.Interaction.OperationType !== 'ok') {
                return;
            }
            dfu.liveSensor.start(dfu.currentDfuId);
        });
    }, 0);
};
gui.isTouchDevice = 'ontouchstart' in document.documentElement;

gui.init1 = function () {
/*    
    $(document).on('popupafteropen', '[data-role="popup"]' ,function( event, ui ) {
        $('body').css('overflow','hidden');
    }).on('popupafterclose', '[data-role="popup"]' ,function( event, ui ) {
        $('body').css('overflow','auto');
    });*/
    // 'Please login' dialog
    $("#plsLogin").on({
        popupbeforeposition: function () {
            $('.ui-popup-screen').off();
        }
    });
    /*
    var reportDateRangeInitialized = false;
    $('#reportDateRange').on('popupafteropen', function(event, ui) {
        if (reportDateRangeInitialized) return;
        var currentDate = new Date(0),
            d = new Date(),
            resultDate = null
        currentDate.setFullYear(d.getFullYear());
        currentDate.setMonth(d.getMonth());
        currentDate.setDate(d.getDate());
        delete d;
        $('#historyRangeSlider').on('change', function() {
            resultDate = new Date(currentDate.valueOf() + 24*3600*1000*($(this).val()));
            $('#historyRangeResult').text(resultDate);
        });
    });*/
    $('#reportDateRangeOk').on('vclick', function() {
        console.log($('#reportDateRangeStart').val());
    });
    $('#plsLoginButton').on('vclick', function(){
        window.location.href ='http://' + window.location.host
    });
};
gui.initSocket = function() {
    var token = window.location.search.substring(1);
    var parameters = '?sessionid=httpswipremocarenetdemosOne-to-Onehtml&'
                   + 'msgEvent=one-to-one-demo&'
                   + 'socketCustomEvent=RTCMultiConnection-Custom-Message&'
                   + 'autoCloseEntireSession=false&'
                   + 'maxParticipantsAllowed=2&extra={}'
                   + (token ? '&token=' + token : '');
    socket = io.connect(parameters, {'forceNew': true});
    socket.on('connect_failed', function() {
        console.log('Connection failed.');
    });
    socket.on('connect', function() {
        console.log('Connected.');
        gui.events.emit('socket_online');
    });
    socket.on('disconnect', function(evt) {
        console.log('Disconnected.', evt);
        gui.events.emit('socket_offline');
    });
    socket.on('error', function(evt) {
        console.log('socketio error', evt);
        switch(evt.type) {
        case 'UnauthorizedError':
            $('#plsLogin').popup('open');
            setTimeout(function () {
                window.location.href= 'http://' + window.location.host;
            }, 1000);
        }
    });
    socket.on('dfu_data', function(request, response, imageData) {
    	if (response.Interaction.$.OperationType == "reply_webrtc_room_id") {
    		console.log(request, response);
    	}
        if (request) {
            gui.events.emit(request.operation, [{request: request, response: response, imageData: imageData}]);
        } else {
            gui.events.emit(response.Interaction.$.OperationType, [{response: response, imageData: imageData}]);
        }
    });
    socket.on('dfu_error', function(details) {
        gui.events.emit('dfu_error');
        console.log('dfu_error', details);
        socket.disconnect();
    });

    var dfuPostMsgHandler = function(type) {
        return function(msg) {
            gui.events.emit(type, [msg]);
        }
    };
    socket.on('dfu_alarm', dfuPostMsgHandler('dfu_alarm'));
    socket.on('dfu_status', dfuPostMsgHandler('dfu_status'));
    socket.on('dfu_report', dfuPostMsgHandler('dfu_report'));

    socket.on('file_uploaded', function(evt) {
        gui.events.emit('file_uploaded', [evt]);
    });
    gui.events.on('file_uploaded', function(evt) {
        if (evt.dest !== 'comments') return;
        //console.log('file_uploaded', evt);
        gui.reportAttachments.push({filename: evt.savedName, mimetype: evt.type});
            $('#addReportFileNameList tr:last').after('<tr><td>' + evt.savedName + '</tr>');
    });
    var fileUploadHandler = function(e) {
        if (!e.target.files[0]) {
            return;
        }

        var file = e.target.files[0];
        if (file.size > gui.maxUploadFileSize) {
            gui.toast('File is too big: ' + file.size + '. Maximum file size: ' + gui.maxUploadFileSize, 3000);
            return;
        }

        $('#addReportFile').prop('disabled', true).addClass('ui-disabled');
        $('#addReportSave').prop('disabled', true).addClass('ui-disabled');
        $('#addRepotCancel').prop('disabled', true).addClass('ui-disabled');
        if (!gui.reportAttachments) {
            gui.reportAttachments = [];
        }
        var stream = ss.createStream();
        ss(socket).emit('file', stream, {size: file.size, name: file.name, type: file.type, dest: 'comments'});
        var blobStream = ss.createBlobReadStream(file);
        var size = 0;
        blobStream.on('data', function(chunk) {
            size += chunk.length;
            var percent = Math.floor(size/file.size * 100);
            $('#uploadProgress').width(percent + '%');
            //console.log(percent);
        });
        blobStream.on('end', function(evt) {
            $('#addReportFile').prop('disabled', false).removeClass('ui-disabled');
            $('#addReportSave').prop('disabled', false).removeClass('ui-disabled');
            $('#addRepotCancel').prop('disabled', false).removeClass('ui-disabled');
            //console.log('blobStream end', evt);
        });
        blobStream.pipe(stream);
    };
    $('#addReportUploadFile').change(fileUploadHandler);
    $('#addReportUploadAudio').change(fileUploadHandler);
    $('#addReportUploadImage').change(fileUploadHandler);
    $('#menuButton').addClass('menuButtonOnline');
};
gui.initChangePassword = function () {
    $('#changePasswordForm').submit(function(evt) {
        if ($('#changePasswordOld').val() === '') {
            gui.toast('Please enter old password.');
            evt.preventDefault();
            return;
        }

        if ($('#changePasswordNew').val() === '' || $('#changePasswordRepeat').val() === '') {
            gui.toast('Please enter new password and repeat.');
            evt.preventDefault();
            return;
        }
        if ($('#changePasswordNew').val() !== $('#changePasswordRepeat').val()) {
            gui.toast('New password and repeat must match');
            evt.preventDefault();
            return;
        }
        if ($('#changePasswordNew').val().length < 5) {
            gui.toast('New password must be at least 5 characters.');
            evt.preventDefault();
            return;
        }

        var opt = {
            oldPassword: $('#changePasswordOld').val(),
            newPassword: $('#changePasswordNew').val(),
            repeat: $('#changePasswordRepeat').val()
        };

        $.ajax(
        {
            url : '/api/v1/auth/changepassword',
            type: "POST",
            contentType: 'application/json',
            data : JSON.stringify(opt),
            success:function(data, textStatus, jqXHR) 
            {
                if (data.error) {
                    gui.toast('Change password failed.');
                } else {
                    gui.toast('Password has been changed successfully.');
                }
            },
            error: function(jqXHR, textStatus, errorThrown) 
            {
                gui.toast('Change password failed.');
            }
        });
        evt.preventDefault(); //STOP default action
        $("#changePassword").popup("close");
    });
};

gui.initAddReport = function() {
    // Init 'addReport' dialog
    // Radio button for upload file type
    $('input[name=addReportFileType]:radio').bind('change', function(event, ui){
        console.log($(this).val());
        var file = document.getElementById('addReportFile');
        switch ($(this).val()) {
        case 'image':
            file.accept = 'image/*';
            file.capture = 'camera';
            break;
        case 'audio':
            file.accept = 'audio/*';
            file.capture = 'microphone';
            break;
        case 'file':
            file.accept = '';
            file.capture = '';
            break;
        }
    });

    // cleanup on popup close
    $('#addReport').bind(
        {popupafterclose: function (event, ui) {
        $('#addReportContent').val('');
        $('#addReportName').val('');
        $('#addReportFileIdList').val('');
        $('#uploadProgress').width('1px');
        $('#addReportFileNameList').children().children('tr:not(:first)').remove();
        gui.reportAttachments = null;
    }});

   
    $('#addReportSave').on('vclick', function() {
        $('#addReportSubmit').submit();
    });
    $('#addReportCancel').on('vclick', function() {
        $('#addReport').popup('close');
    }); 
    // submit
    $('#addReportSubmit').submit(function(evt) {
        var msg = $('#addReportValidationMsg');
        if (!dfu.currentDfuId) {
            msg.text('Current dfu is unavailable, please try again later.').show().fadeOut(10000);
            evt.preventDefault();
            return;
        } else {
            $('#addReportDfuid').val(dfu.currentDfuId);
        }
        
        if ($('#addReportName').val() === '' || $('#addReportContent').val() === '') {
            msg.text('Please fill both fields.').show().fadeOut( 10000 );
            evt.preventDefault();
            return;
        }

        var postData = $(this).serializeArray();
        
        var opt = {
            dfuid: dfu.currentDfuId,
            caregiverName: $('#addReportName').val(),
            content: $('#addReportContent').val(),
            files: gui.reportAttachments
        };
        console.log(opt);
        $.ajax(
        {
            url : '/api/v1/reports',
            type: "POST",
            contentType: 'application/json',
            data : JSON.stringify(opt),
            success:function(data, textStatus, jqXHR) 
            {
                console.log('addReport submit success', data, textStatus);
                gui.events.emit('report_submitted');
                //gui.reportButton.refresh();
                gui.reportAttachments = null;
            },
            error: function(jqXHR, textStatus, errorThrown) 
            {
                console.log('addReport submit error', textStatus);
                gui.reportAttachments = null;
            }
        });
        evt.preventDefault(); //STOP default action
        //evt.unbind(); //unbind. to stop multiple form submit.
        $("#addReport").popup("close");
    });
 
};

gui.reportRenderer = function(container, data) {
    if (!data) return;
    var dateStr = new Date(data.date);
    dateStr = dateStr.toLocaleTimeString() + ' ' + dateStr.toLocaleDateString();
    container.append($('<p style="line-height: 0.2;"><b>' + data.caregiverName + '</b> (' + dateStr + ')</p>'));
    container.append($('<p>' + data.content + '</p>'));
    if (data.files) {
        data.files.forEach(function (file) {
            var icon = '';
            if (file.mimetype.indexOf('image') != -1) {
                icon = 'image.png';
                var p = $('<p></p>'),
                    a = $('<a class="attachment" href="#">' + file.filename + '</a>'),
                    img = $('<img src="' + gui.iconPath + icon + '" width=20px>'),
                    placeHolder = $('#popupPhotoLandscapeImg');
 
                a.bind('vclick', function() {
                    placeHolder.attr('src', '/api/v1/uploads/' + file.filename);
                    placeHolder.on('load', function() {
                        $('#popupPhotoLandscape').popup('open');
                    });
                });
                p.append(img);
                p.append(a);
                container.append(p);
            } else if (file.mimetype.indexOf('audio') != -1 || file.mimetype.indexOf('video') != -1) {
                icon = 'audio.png';
                container.append($('<p><a class="attachment" href="/api/v1/uploads/' + encodeURI(file.filename) + '" data-ajax="false"><img src="' + gui.iconPath + icon + '" width=20px>&nbsp;' + file.filename + '</a></p>'));
            } else {
                icon = 'file.png';
                container.append($('<p><a class="attachment" href="/api/v1/uploads/d/' + encodeURI(file.filename) + '" data-ajax="false"><img src="' + gui.iconPath + icon + '" width=20px>&nbsp;' + file.filename + '</a></p>'));
            }
        });
    }
    container.append($('<hr style="width: 100%; border-color:#007EBE">'));
};
gui.getReportData = function(container, num) {
    $.ajax(
    {
        url : '/api/v1/reports',
        type: "GET",
        data: {dfuid: dfu.currentDfuId},
        success:function(data, textStatus, jqXHR) 
        {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            if (!Array.isArray(data)) {
                return;
            }
            num = num ? num : data.length;
            for (var i=0; i<num; i++) {
                gui.reportRenderer(container, data[i]);
            }
        },
        error: function(jqXHR, textStatus, errorThrown) 
        {
            console.log(textStatus);
        }
    });
};

