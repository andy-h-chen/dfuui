Date.prototype.addDays = function(days) {
    this.setDate(this.getDate() + parseInt(days));
    return this;
};

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

(function ($) {
    var _oldShow = $.fn.show;

    $.fn.show = function (/*speed, easing, callback*/) {
        var argsArray = Array.prototype.slice.call(arguments),
            duration = argsArray[0],
            easing,
            callback,
            callbackArgIndex;

        // jQuery recursively calls show sometimes; we shouldn't
        //  handle such situations. Pass it to original show method.
        if (!this.selector) {
            _oldShow.apply(this, argsArray);
            return this;
        }

        if (argsArray.length === 2) {
            if ($.isFunction(argsArray[1])) {
                callback = argsArray[1];
                callbackArgIndex = 1;
            } else {
                easing = argsArray[1];
            }
        } else if (argsArray.length === 3) {
            easing = argsArray[1];
            callback = argsArray[2];
            callbackArgIndex = 2;
        }

        return $(this).each(function () {
            var obj = $(this),
                oldCallback = callback,
                newCallback = function () {
                    if ($.isFunction(oldCallback)) {
                        oldCallback.apply(obj);
                    }

                    obj.trigger('afterShow');
                };

            if (callback) {
                argsArray[callbackArgIndex] = newCallback;
            } else {
                argsArray.push(newCallback);
            }

            obj.trigger('beforeShow');

            _oldShow.apply(obj, argsArray);
        });
    };
})(jQuery);

var gui = {},
    dfu = {},
	socket;
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

//Vapid public key.
gui.applicationServerPublicKey = 'BB5kRGuOUAf2tE_AzQHPjhtZwr22ts78UCILOKdAm-RtfLVcJadLeC3PBYf6mGK-Pz3tosOi7LXW0CVVwUJDg0M';
gui.serviceWorkerName = '/web_push/sw.js';
gui.isSubscribed = false;
gui.iconPath = '/images/bruyere/id_photos/';
gui.imagePath = '/images/bruyere/';
gui.maxUploadFileSize = 1024 * 1024 * 4; // 4M
gui.MAX_ICON_SIZE_MOBILE = 200;
gui.videoRefreshTimeout = 1000;
gui.videoTimeoutInterval = 30000;
dfu.motionTotalPoints = 100;
gui.getAlarmIcon = function(type) {
	switch(type) {
		case 'HELP_ALARM':
			return gui.imagePath + 'Icons_SOS.png';
		case 'FALL_ALARM':
			return gui.imagePath + 'Icons_Fall.png';
		case 'WANDER_ALARM':
			return gui.imagePath + 'Icons_Wander.png';
		}
};
gui.Button = function(text1, text2, icon) {
    var self = this;
    this.button = $('<div/>', {
        class: 'button'
    });
    this.icon = $('<div></div>');
    this.img = $('<img src="' + icon + '" class="buttonIcon">');
    this.icon.append(this.img);
    this.icon.appendTo(this.button);
    this.title1 = text1;
	this.title2 = text2;
    this.textDiv1 = $('<div></div>');
    this.text1 = $('<span>' + text1 + '</span>');
    this.text1.appendTo(this.textDiv1);
    this.textDiv1.appendTo(this.button);
	
    this.textDiv2 = $('<div></div>');
    this.text2 = $('<span>' + text2 + '</span>');
    this.text2.appendTo(this.textDiv2);
    this.textDiv2.appendTo(this.button);
    this.button.bind('click', function(evt) {
        if (self.vclickHandler) {
            self.vclickHandler();
        }
    });
    this.vclickHandler;
    this.setVClickHandler = function (handler) {
        self.vclickHandler = handler;
    };
    this.destroy = function () {
        self.button.unbind('click');
        self.button.remove();
    };
};
gui.MainFunctionButton = function(text1, text2, icon, container) {
    gui.Button.call(this, text1, text2, icon);
    var self = this;
    this.button.addClass('mainFunctionButton');
    //this.icon.addClass('mainFunctionButtonIcon');
    this.textDiv1.addClass('mainFunctionButtonTextDiv1');
	this.textDiv2.addClass('mainFunctionButtonTextDiv2');
    this.text1.addClass('mainFunctionButtonText');
	this.text2.addClass('mainFunctionButtonText');
	
	this.setText1 = function(txt) {
		$(self.text1).prop('innerText', txt);
	}
	this.setText2 = function(txt) {
		$(self.text2).prop('innerText', txt);
	}
    this.setHeight = function(height) {
        self.button.css({'height': height});
        self.icon.css({'height': height-20});
        self.textDiv1.css({'height': 20});
		self.textDiv2.css({'height': 20});
    };
	this.setIcon = function(url) {
		self.img.prop('src', url);
	};
    this.button.appendTo(container);
    this.setAlarm = function(alarm) {
        if (alarm) {
            //self.textDiv1.addClass('alarmAnimation');
			//self.textDiv2.addClass('alarmAnimation');
			self.img.addClass('alarmAnimation');
        } else {
			//self.textDiv1.removeClass('alarmAnimation');
			//self.textDiv2.removeClass('alarmAnimation');
			self.img.removeClass('alarmAnimation');
		}
    };
	this.hasAlarm = function() {
		return self.img.hasClass('alarmAnimation');
	};
    this.streamId = -1;
    this.setStreamId = function(id) {
        self.streamId = id;
    };
    this.setDataType = function(type) {
        self.dataType = type;
    };
};

if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/sw.js');
}

gui.MainFunctionButton.prototype = Object.create(gui.Button);
gui.MainFunctionButton.prototype.constructor = gui.MainFunctionButton;
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

dfu.Request = function (action, operation, dfuId, sensorId, data) {
    this.action = action;
    this.operation = operation;
    this.dfuId = dfuId;
    this.sensorId = sensorId;
    this.data = data;
}

gui.firstLoad = true;
$(document).on('pagebeforechange', function(e, data) {
    if (!gui.firstLoad) return;

    if (data.toPage[0].id !== 'mainPage' && typeof data.options.fromPage === 'undefined') {
		gui.firstLoad = false;
        $.mobile.pageContainer.pagecontainer('change', '#mainPage');
        e.preventDefault();
    }
    gui.firstLoad = false;
	gui.initSocket();
});

gui.initSocket = function() {
   var token = window.location.search.substring(1);
    socket = io.connect(token ? '?token=' + token : '', {'forceNew': true});
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
    socket.on('dfu_data', function(request, response, imageData) {
        gui.events.emit(request.operation, [{request: request, response: response, imageData: imageData}]);
    });
    var dfuPostMsgHandler = function(type) {
        return function(msg) {
            gui.events.emit(type, [msg]);
        }
    };
    socket.on('dfu_alarm', dfuPostMsgHandler('dfu_alarm'));
	socket.on('dfu_alarm_update', dfuPostMsgHandler('dfu_alarm_update'));
	socket.on('alarm_viewed', dfuPostMsgHandler('alarm_viewed'));
};

gui.initDfuList = function() {
    if (!socket) {
        return;
    }
    $.mobile.loading('show');
    socket.emit('dfu_request', new dfu.Request('query', 'list'));
    gui.events.once('list', function(value) {
        var siteList = [];
        if (!value.response.Interaction || !value.response.Interaction.Data || value.response.Interaction.Data.length== 0 || !value.response.Interaction.Data[0].Site || !value.response.Interaction.Data[0].Site.length) {
            console.error('Failed on getting dfu list.');
            return false;
        } else {
            siteList = value.response.Interaction.Data[0].Site;
        }

        var siteListStr = '';
        for (var i=0; i<siteList.length; i++) {
			siteListStr += siteList[i].$.DfuId + ',';
        }
		if (siteListStr !== '') {
			// request resident list
			var opt = {
				dfu_ids: siteListStr
			};
			$.ajax(
			{
				url : '/api/v1/bruyere/residents',
				type: "POST",
				contentType: 'application/json',
				data : JSON.stringify(opt),
				success:function(data, textStatus, jqXHR) 
				{
					$.mobile.loading('hide');
					if (data.error) {
						gui.toast('Loading resident list error, please try again later.');
					} else {
						gui.events.emit('resident_list_ready', [{data: data}]);
					}
				},
				error: function(jqXHR, textStatus, errorThrown) 
				{
					$.mobile.loading('hide');
					gui.toast('Loading resident list error, please try again later.');
				}
			});
		}
    });  
};

gui.initNotification = function() {
	gui.swRegistration = null;
	var initialiseState = function(reg) {
		// Are Notifications supported in the service worker?
		if (!(reg.showNotification)) {
			console.log('Notifications aren\'t supported on service workers.');
			return;
		}

		// Check if push messaging is supported
		if (!('PushManager' in window)) {
			console.log('Push messaging isn\'t supported.');
			return;
		}

		// We need the service worker registration to check for a subscription
		navigator.serviceWorker.ready.then(function (reg) {
			// Do we already have a push message subscription?
			reg.pushManager.getSubscription()
				.then(function (subscription) {
					if (!subscription) {
						console.log('Not yet subscribed to Push');
						gui.isSubscribed = false;
						subscribe();
					} else {
						// initialize status, which includes setting UI elements for subscribed status
						// and updating Subscribers list via push
						gui.isSubscribed = true;
					}
				})
				.catch(function (err) {
					console.log('Error during getSubscription()', err);
				});
		});
	};
	var handleSWRegistration = function(reg) {
		if (reg.installing) {
			console.log('Service worker installing');
		} else if (reg.waiting) {
			console.log('Service worker installed');
		} else if (reg.active) {
			console.log('Service worker active');
		}
		
		gui.swRegistration = reg;
		initialiseState(reg);
	};
	var subscribe = function() {
		navigator.serviceWorker.ready.then(function (reg) {
			var subscribeParams = {userVisibleOnly: true};
			
			//Setting the public key of our VAPID key pair.
			var applicationServerKey = urlB64ToUint8Array(gui.applicationServerPublicKey);
			subscribeParams.applicationServerKey = applicationServerKey;

			reg.pushManager.subscribe(subscribeParams)
				.then(function (subscription) {

					// Update status to subscribe current user on server, and to let
					// other users know this user has subscribed
					var endpoint = subscription.endpoint;
					var key = subscription.getKey('p256dh');
					var auth = subscription.getKey('auth');
					var encodedKey = btoa(String.fromCharCode.apply(null, new Uint8Array(key)));
					var encodedAuth = btoa(String.fromCharCode.apply(null, new Uint8Array(auth)));
					socket.emit('user_subscribe', {publicKey: encodedKey, auth: encodedAuth, notificationEndPoint: endpoint});
					gui.isSubscribed = true;
				})
				.catch(function (e) {
					// A problem occurred with the subscription.
					console.log('Unable to subscribe to push.', e);
				});
		});
	};
    Notification.requestPermission().then(function (status) {
        if (status === 'denied') {
            console.log('[Notification.requestPermission] The user has blocked notifications.');
            disableAndSetBtnMessage('Notification permission denied');
        } else if (status === 'granted') {
            console.log('[Notification.requestPermission] Initializing service worker.');
			if ('serviceWorker' in navigator) {
				navigator.serviceWorker.register(gui.serviceWorkerName).then(handleSWRegistration);
			} else {
				console.log('Service workers aren\'t supported in this browser.');
			}
        }
    });
};
$(document).ready(function() {
	/*
	// main page menu items
	var toogleMenuItems = function() {
		if (gui.adminGranted) {
			$('#addNewResident').show();
			$('#signOut').show();
			$('#adminSignin').hide();
		} else {
			$('#addNewResident').hide();
			$('#signOut').hide();
		}
	}*/

    var logoutHandler = function() {
        setTimeout(function() {
            document.location.replace(window.location.protocol + '//' + window.location.host + '/api/v1/auth/logout');
        }, 300);
		var endpoint = null;
		navigator.serviceWorker.ready.then(function(reg) {
			reg.pushManager.getSubscription()
				.then(function(subscription) {
					if (subscription) {
						endpoint = subscription.endpoint;
						return subscription.unsubscribe();
					}
				})
				.catch(function(error) {
					console.log('Error unsubscribing', error);
				})
				.then(function() {
					socket.emit('user_unsubscribe', {notificationEndPoint: endpoint});
					console.log('User is unsubscribed.');
					gui.isSubscribed = false;
				});
		});
    };
    $('#signOut').on('click', logoutHandler);
    gui.events.once('socket_online', function() {
        gui.initDfuList();
		//gui.initNotification();
    });
	//toogleMenuItems();
	//gui.initSocket();

	// all back buttons
	var btns = $('.headerBackButton').toArray();
	btns.forEach(function(btn) {
		$(btn).on('click', function(evt) {
			$.mobile.back();
		});
	});
	// mainPageMenuButton
	$('#mainPageMenuButton').on('click', function() {
		$('#mainPageMenuPanel').panel('open');
	});
	/*
	$('#addNewResident').bind('click', function() {
		$(':mobile-pagecontainer').pagecontainer('change', '#newResidentPage', { transition: 'slide' });
		$('#newResidentUploadBar').width('0');
	});
	$('#adminSignin').bind('click', function() {
		$(':mobile-pagecontainer').pagecontainer('change', '#adminPasswordPage', { transition: 'slide' });
	});
	$('signOut').bind('click', function() {
		gui.adminGranted = false;
		gui.adminPassword = '';
		$('#addNewResident').hide();
		$('#signOut').hide();
		$('#adminSignin').show();
	});
	*/
	
	// profile edit
	gui.events.on('admin_granted', function() {
		console.log('admin_granted');
		//$('#adminButton').hide();
		$('#profileNameEdit').show();
		$('#profileRoomEdit').show();
		$('#profilePhotoEdit').show();
		//toogleMenuItems();
	});
	gui.events.on('admin_ungranted', function() {
		console.log('admin_ungranted');
		//$('#adminButton').hide();
		$('#profileNameEdit').hide();
		$('#profileRoomEdit').hide();
		$('#profilePhotoEdit').hide();
		//toogleMenuItems();
	});
	var profileNameEditHandler = function(button) {
		var handler = function() {
			console.log(this.dfuId, this.string, this.type);
			$('#nameEditHeaderTitle').prop('innerHTML', this.title);
			$('#nameEditInput').prop('value', this.string);
			$('#nameEditInput').prop('placeholder', this.placeholder);
			$('#nameEditId').prop('value', this.dfuId);
			$('#nameEditType').prop('value', this.type);
			$(':mobile-pagecontainer').pagecontainer('change', '#nameEditPage', { transition: 'slide' });
		}
		return handler.bind(this);
	};
	var videoPageInit = function(button) {
		$(':mobile-pagecontainer').pagecontainer('change', '#videoPage', { transition: 'slide' });
		this.streamId = 1002;
		var self = this;
		// video
		var videoTimer,
			getVideoFrameTimeoutId,
			videoStopped = false;
		var videoTimerCallback = function() {
			videoStopped = false;
			$('#videoDivPlay').show();
			$('#videoDivPause').hide();
		};
		var getVideoFrame = function() {
			if (videoStopped) return;

			socket.emit('dfu_request', new dfu.Request('query', 'live_video', self.dfuId, self.streamId));
			getVideoFrameTimeoutId = window.setTimeout(getVideoFrame, gui.videoRefreshTimeout);
		};
		getVideoFrame();
		$('#videoDivPlay').hide();
		$('#videoDivPause').show();
		videoTimer = setTimeout(videoTimerCallback, gui.videoTimeoutInterval);

		$(document).unbind('pagecontainershow');
		$(document).bind('pagecontainershow', function(e, ui) {
			if (ui.prevPage[0].id == 'videoPage') {
				videoStopped = true;
				clearTimeout(videoTimer);
				gui.events.clear('live_video');
				$('#videoDivPlay').unbind('click');
				$('#videoDivPause').unbind('click');
				$('#videoDivFlash').unbind('click');
				$('#videoDivBeep').unbind('click');
				$('#videoImg').attr('src', '');
			}
		});

		$('#videoDivPlay').unbind('click');
		$('#videoDivPlay').bind('click', function(evt) {
			videoStopped = false;
			videoTimer = setTimeout(videoTimerCallback, gui.videoTimeoutInterval);
			$('#videoDivPlay').hide();
			$('#videoDivPause').show();
			getVideoFrame();
		});
		$('#videoDivPause').unbind('click');
		$('#videoDivPause').bind('click', function(evt) {
			clearTimeout(videoTimer);
			videoStopped = true;
			$('#videoDivPlay').show();
			$('#videoDivPause').hide();
		});
		$('#videoDenied').hide();

		var dataHandler = function(value) {
			if (videoStopped) return;
			
			if (value.request.dfuId != self.dfuId || value.request.sensorId != self.streamId || !value.response || value.response.Interaction.$.OperationType === 'fail') {
				if (value.response.Interaction.$.OperationType === 'fail') {
					console.log('video failed', value, self);
				}
				if (button.lastImage) {
					$('#videoImg').attr('src', button.lastImage);
				}
				return;
			}
			if (value.response.Interaction.$.OperationType === 'denied') {
				console.log('video denied');
				window.clearTimeout(getVideoFrameTimeoutId);
				//gui.events.un('live_video', video.dataHandler);
				videoStopped = true;
				//video.destroy();
				//delete video;
				$('#videoImg').hide();
				$('#videoDivBeep').hide();
				$('#videoDivFlash').hide();
				$('#videoDivPlay').hide();
				$('#videoDivPause').hide();
				$('#videoContainer').css('background-color', 'white');
				$('#videoDenied').show();
				return;
			}
			if (!value.imageData || !value.imageData.length) {
				console.log('video imageData empty');
				return;
			}

			if ($('#videoDenied').is(':visible')) {
				$('#videoImg').show();
				$('#videoDivBeep').show();
				$('#videoDivFlash').show();
				$('#videoDenied').hide();
				$('#videoContainer').css('background-color', '');
			}
			$('#videoDivPlay').hide();
			$('#videoDivPause').show();
	 
			$('#videoImg').attr('src', value.imageData);
			button.lastImage = value.imageData;
		};
		gui.events.clear('live_video');
		gui.events.on('live_video', dataHandler);

		var videoDivButtonAction = function(action) {
			return function() {
				socket.emit('dfu_request', new dfu.Request('command', action, dfu.currentDfu.id));
				$(this).addClass('alarmAnimation');
				var that = $(this);
				setTimeout(function() {
					that.removeClass('alarmAnimation');
				}, 800);
			}
		};
		$('#videoDivFlash').unbind('click');
		$('#videoDivFlash').bind('click', videoDivButtonAction('set_flash'));
		$('#videoDivBeep').unbind('click');
		$('#videoDivBeep').bind('click', videoDivButtonAction('set_beep'));
	};
	var motionPageInit = function(button) {
		$(':mobile-pagecontainer').pagecontainer('change', '#motionPage', { transition: 'slide' });
		var self = this,
			getMotionDataTimeoutId;
		var getMotionData = function() {
			socket.emit('dfu_request', new dfu.Request('query', 'live_sensor', self.dfuId));
			getMotionDataTimeoutId = window.setTimeout(getMotionData, gui.videoRefreshTimeout);
		};
		$(document).unbind('pagecontainershow');
		$(document).bind('pagecontainershow', function(e, ui) {
			if (ui.prevPage[0].id == 'motionPage') {
				clearTimeout(getMotionDataTimeoutId);
				gui.events.clear('get_cache');
				gui.events.clear('live_sensor');
			}
		});
		var motionDataHandler = function(value) {
			if (this.streamId == -1) return;

			if (!value.response || !value.response.Interaction
								|| value.response.Interaction.$.OperationType == 'fail'
								|| !value.response.Interaction
								|| !value.response.Interaction.Data
								|| !value.response.Interaction.Data[0].Sensors
								|| !value.response.Interaction.Data[0].Sensors[0].Sensor) {
				console.log('MotionSensor', value.response.Interaction.$.OperationType);
				return;
			}
			var data = [];
			if (value.response.Interaction.Data[0].Sensors[0].Sensor instanceof Array) {
				data = value.response.Interaction.Data[0].Sensors[0].Sensor;
			} else {
				data.push(value.response.Interaction.Data[0].Sensors[0].Sensor);
			}
			for (var i = 0; i < data.length; i++) {
				var sensor = data[i];
				//if (sensor.$.SensorId != this.streamId)
				//	continue;
				if (!sensor.Channel && !sensor.Cache)
					continue;
				var motionData = [];
				if (sensor.Channel) {
					gui.events.emit('motion_updated', [{data: sensor.Channel}]);
					motionData.push(sensor.Channel[0].$.Value);
				} else if (sensor.Cache){
					for(var i=0; i<sensor.Cache.length; i++) {
						motionData.push(sensor.Cache[i].$.Value);
					}
					//console.log(sensor.Cache);
				}
				updateMotion(motionData);
				break;
			}
		};
		gui.events.clear('get_cache');
		gui.events.on('get_cache', function(value) {
			gui.events.on('live_sensor', motionDataHandler);
			getMotionData();
			//console.log(value);
		});
		socket.emit('dfu_request', new dfu.Request('command', 'get_cache', self.dfuId));
		var motionPlot = $.plot('#motionCanvas', [[[]]], {
					series: {
						shadowSize: 0
					},
					yaxis: {
						min: 0,
						max: 100,
						show: true
						//tickFormatter: function(v, yaxis) { return ''; }
					},
					xaxis: {
						show: false,
						min: 0,
						max: dfu.motionTotalPoints
					},
					grid: {
						show: true,
						borderWidth: { top: 0, left: 0, bottom: 0, right: 0 }
					}
		});
		var updateMotion = function(value) {
			if (value !== undefined && value instanceof Array) {
				var str = '';
				for(var i=0;i<value.length;i++) str+=value[i]+' ';
				value = value.length > dfu.motionTotalPoints ? value.slice(value.length - totalPoints) : value;
				var totalNumOfData = button.motionData.length + value.length;
				if (value.length >= dfu.motionTotalPoints) {
					button.motionData = value;
				} else if (totalNumOfData <= dfu.motionTotalPoints) {
					button.motionData = button.motionData.concat(value);
				} else {
					button.motionData = button.motionData.slice(Math.abs(totalNumOfData - dfu.motionTotalPoints));
					button.motionData = button.motionData.concat(value);
				}
			}
			var res = [];
			for (var i=0; i<button.motionData.length; ++i) {
				res.push([i, button.motionData[i]]);
			}
			motionPlot.setData([res]);
			if ( $.mobile.activePage.attr( "id" ) == 'motionPage') {
				motionPlot.draw();
			};
		};
	};
	var settingsPageInit = function(button) {
		$(':mobile-pagecontainer').pagecontainer('change', '#settingsPage', { transition: 'slide' });
		var self = this;
		$('#settingsGAO').show();
		$('#settingsCP').hide();
		$('#settingsWAS').hide();
		$('#settingsFD').hide();

		$(document).unbind('pagecontainershow');
		$(document).bind('pagecontainershow', function(evt, ui) {
			var activePage = $.mobile.pageContainer.pagecontainer("getActivePage");
			if (activePage.prop('id') !== 'settingsPage') return;
			initUI();
			initDfu();
			
			paintSwipeChartView();
			requestBackground();
		});
		var motionSettings = {
			AlarmOptionGreen: "ON",
			AlarmOptionRed: "ON",
			AlarmOptionYellow: "ON",
			AlarmPeriod: 2,
			DownThreshold: 40,
			UpperThreshold: 80,
			StartHour: 0,
			StopHour: 24,
			DailyReportHour: 12,
			DailyReportMinute: 0,
			WeeklyReportHour: 12,
			WeeklyReportMinute: 0,
			MonthlyReportHour: 12,
			MonthlyReportMinute: 0,
			SendAlarmEmail: "ON"
		},
			fallSettings = {
			SendFallAlarmEmail: 'OFF',
			FallDetection: 'ON',
			FallLearning: 'ON',
			FallSensitivity: 3
		},
			wanderSettings = {
			SendWanderAlarmEmail: 'OFF',
			WanderDetection: 'ON',
			DoorFinding: 'OFF',
			WanderSensitivity: 3,
			DoorX: 10,
			DoorY: 25,
			DoorWidth: 100,
			DoorHeight: 200
		};

		var motionAvg = {
			avg: [-1, -1, -1, -1, -1],
			txt: [
				'',
				i18next.t('settingsPage.motion.hour'),
				i18next.t('settingsPage.motion.day'),
				i18next.t('settingsPage.motion.week'),
				i18next.t('settingsPage.motion.month')
			],
			options: [
				null, null,
				{ hour: 'DailyReportHour', minute: 'DailyReportMinute'},
				{ hour: 'WeeklyReportHour', minute: 'WeeklyReportMinute'},
				{ hour: 'MonthlyReportHour', minute: 'MonthlyReportMinute'}
			]
		};
		gui.events.on('motion_updated', function(value) {
			if (value.data instanceof Array && value.data.length === 5) {
				for(var i=1; i<5; i++) motionAvg.avg[i] = value.data[i].Value;
			}
		});
		var initUI = function() {
			// init tab bar
			$('#settingsPage > div.ui-content > ul > li').each(function(index) {
				var tabDiv = $(this).attr('tab-div');
				$(this).unbind('click');
				$(this).bind('click', function() {
					$('.settingsDiv').each(function(i) {
						$(this).hide();
					});
					$('#' + tabDiv).show();
					$('#settingsPage > div.ui-content > ul > li').each(function() {
						$(this).css('background-color', 'grey');
					});
					$(this).css('background-color', '#007ebe');

				});
			});
			$('#settingsPage > div.ui-content > ul > li:nth-child(1)').click(); 
			$('#settingsPage > div.ui-content > ul > li:nth-child(1)').css('background-color', '#007ebe');

			// Make fall detection div height 100%
			//$('#settingsFD').height($('#settingsGAO').height())
			//$('#settingsCP').height($('#settingsGAO').height())
		}
		var initDfu = function () {

			if (button.resident.system && button.resident.system.Alarm) {
				for (var key in motionSettings) {
					motionSettings[key] = button.resident.system.Alarm[0].$[key] ? button.resident.system.Alarm[0].$[key] : motionSettings[key];
				}
				for (var key in fallSettings) {
					fallSettings[key] = button.resident.system.Alarm[0].$[key];
				}
				for (var key in wanderSettings) {
					wanderSettings[key] = button.resident.system.Alarm[0].$[key];
				}
			}
			var red = $('#alarmOptionRed');
			red.prop('checked', motionSettings.AlarmOptionRed === 'ON');
			//red.checkboxradio('refresh');
			var green = $('#alarmOptionGreen');
			green.prop('checked', motionSettings.AlarmOptionGreen === 'ON');
			//green.checkboxradio('refresh');
			var yellow = $('#alarmOptionYellow');
			yellow.prop('checked', motionSettings.AlarmOptionYellow === 'ON');
			//yellow.checkboxradio('refresh');
			var sendEmail = $('#settingsGAOalarmEmail');
			sendEmail.prop('checked', motionSettings.SendAlarmEmail === 'ON');
			//sendEmail.checkboxradio('refresh');
	 
			var periodButtons = $('input[name*=settingsGAOAlarmPeriod]:checked');
			for (var i=0; i<periodButtons; i++) {
				periodButtons[i].checked = false;
			}
			$('#settingsGAOAlarmPeriod' + motionSettings.AlarmPeriod).prop('checked', true);
			//$('#settingsGAOAlarmPeriod' + motionSettings.AlarmPeriod).checkboxradio('refresh');
			curAlarmPeriod = preAlarmPeriod = $('#settingsGAOAlarmPeriod' + motionSettings.AlarmPeriod);
			$('#settingsGAOMPStart').prop('value', motionSettings.StartHour);
			$('#settingsGAOMPEnd').prop('value', motionSettings.StopHour);
			$('#settingsGAOMP').rangeslider('refresh');

			$('#settingsFDalarmEmail').prop('checked', fallSettings.SendFallAlarmEmail === 'ON');
			//$('#settingsFDalarmEmail').checkboxradio('refresh');
			$('#settingsFDEn').prop('checked', fallSettings.FallDetection === 'ON');
			//$('#settingsFDEn').checkboxradio('refresh');
			$('#settingsFDFAL').prop('checked', fallSettings.FallLearning === 'ON');
			//$('#settingsFDFAL').checkboxradio('refresh');
			$('#settingsFDSensitivity').val(fallSettings.FallSensitivity).slider('refresh');

			$('#settingsWASalarmEmail').prop('checked', wanderSettings.SendWanderAlarmEmail === 'ON');
			//$('#settingsWASalarmEmail').checkboxradio('refresh');
			$('#settingsWASEn').prop('checked', wanderSettings.WanderDetection === 'ON');
			//$('#settingsWASEn').checkboxradio('refresh');
			$('#settingsWASDfen').prop('checked', wanderSettings.DoorFinding === 'ON');
			$('#settingsWASDfen').checkboxradio('disable');
			//$('#settingsWASDfen').checkboxradio('refresh');
			$('#settingsWASSensitivity').val(wanderSettings.WanderSensitivity).slider('refresh');
		};
		var paintSwipeChartView = function() {
			if (!($('#settingsGAO').is(':visible'))) return;
			setTimeout(function() {
				//console.log('swipe chart view');
				var alarmPeriodButtonId = $('input[name*=settingsGAOAlarmPeriod]:checked').attr('id');
				var periodOption = parseInt(alarmPeriodButtonId.substring(22));
				$('#settingsGAOChartSweepView canvas').remove();
				var txt = i18next.t('settingsPage.motion.average', {period: motionAvg.txt[periodOption], value: motionAvg.avg[periodOption]});
				gui.drawChartSweepView('settingsGAOChartSweepView', motionSettings.DownThreshold, motionSettings.UpperThreshold, motionAvg.avg[periodOption], txt);
			}, 500);
		};
		$('#settingsGAO').unbind('afterShow');
		$('#settingsGAO').bind('afterShow', function() {
			//initSettingsUIValue();
			paintSwipeChartView();
		});
		// Ranger slider
		$('#settingsGAOMP').unbind('slidestop');
		$('#settingsGAOMP').bind('slidestop', function(e) {
			motionSettings.StartHour = $("#settingsGAOMPStart").val();
			motionSettings.StopHour = $("#settingsGAOMPEnd").val();
		});
		gui.events.clear('chart_swipe_view_updated');
		gui.events.on('chart_swipe_view_updated', function(value) {
			if (value.canvasId === 'settingsGAOChartSweepView') {
				motionSettings.UpperThreshold = value.upperThreshold;
				motionSettings.DownThreshold = value.lowerThreshold;
			}
		});
		var setConfigResponse = function(value) {
			if (value.response.Interaction.$.OperationType === 'ok') {
				gui.toast('Settings Saved.');
			} else {
				gui.toast('Settings saving failed, Please try again later');
			}
		};
		// FIXME: update system or reload system
		gui.events.clear('set_motion_config');
		gui.events.on('set_motion_config', setConfigResponse);
		gui.events.clear('set_fall_config');
		gui.events.on('set_fall_config', setConfigResponse);
		gui.events.clear('set_wander_config');
		gui.events.on('set_wander_config', setConfigResponse);
		$('#settingsGAOSave').unbind('click');
		$('#settingsGAOSave').bind('click', function() {
			// alarm period
			var alarmPeriodButtonId = $('input[name*=settingsGAOAlarmPeriod]:checked').attr('id');
			motionSettings.AlarmPeriod = alarmPeriodButtonId.substring(22);
			// alarm options
			motionSettings.AlarmOptionRed = $('#alarmOptionRed').prop('checked') ? 'ON' : 'OFF';
			motionSettings.AlarmOptionYellow = $('#alarmOptionYellow').prop('checked') ? 'ON' : 'OFF';
			motionSettings.AlarmOptionGreen = $('#alarmOptionGreen').prop('checked') ? 'ON' : 'OFF';
			motionSettings.SendAlarmEmail = $('#settingsGAOalarmEmail').prop('checked') ? 'ON' : 'OFF';
			socket.emit('dfu_request', new dfu.Request('command', 'set_motion_config', self.dfuId, null /* sensorId */, motionSettings));
			console.log(motionSettings);
		});
		$('#settingsFDSave').unbind('click');
		$('#settingsFDSave').bind('click', function() {
			var fdSettings = {};
			fdSettings.FallDetection = $('#settingsFDEn').prop('checked') ? 'ON' : 'OFF';
			fdSettings.SendFallAlarmEmail = $('#settingsFDalarmEmail').prop('checked') ? 'ON' : 'OFF';
			fdSettings.FallLearning = $('#settingsFDFAL').prop('checked') ? 'ON' : 'OFF';
			fdSettings.FallSensitivity = $('#settingsFDSensitivity').val();
			console.log(fdSettings);
			socket.emit('dfu_request', new dfu.Request('command', 'set_fall_config', self.dfuId, null /* sensorId */, fdSettings));
		});
		// Will be called on settingsPage showing
		var requestBackground = function () {
			if ($('#doorFindingImg').length === 0) {
				socket.emit('dfu_request', new dfu.Request('query', 'background', self.dfuId));
			}
		};
		$('#settingsWASSave').unbind('click');
		$('#settingsWASSave').bind('click', function() {
			wanderSettings.WanderDetection = $('#settingsWASEn').prop('checked') ? 'ON' : 'OFF';
			wanderSettings.SendWanderAlarmEmail = $('#settingsWASalarmEmail').prop('checked') ? 'ON' : 'OFF';
			wanderSettings.DoorFinding = $('#settingsWASDfen').prop('checked') ? 'ON' : 'OFF';
			wanderSettings.WanderSensitivity = $('#settingsWASSensitivity').val();
			console.log('save wander', wanderSettings);
			socket.emit('dfu_request', new dfu.Request('command', 'set_wander_config', self.dfuId, null /* sensorId */, wanderSettings));
	 
		});
		
		var doorFindingImgRatio = 0,
			doorFindingDivRatio = 0;
		var paintDoorFinding = function() {
			if (!($('#settingsWAS').is(':visible')) || !document.getElementById('doorFindingImg')) return;
			setTimeout(function() {
				var doorFindingDiv = $('#settingsWASDf'),
					doorFindingImg = $('#doorFindingImg'),
					WAS = $('#settingsWAS');
				//console.log(doorFindingDiv.width(), doorFindingDiv.height(), doorFindingImg.width(), doorFindingImg.width());
				if (WAS.width() > doorFindingImg.width()) {
					doorFindingDiv.width(doorFindingImg.width());
				} else {
					doorFindingDiv.width(WAS.width() - 4);
				}
				doorFindingDiv.height(doorFindingDiv.width() * doorFindingImgRatio);
				doorFindingDivRatio = doorFindingDiv.width() / doorFindingImg.width();
				gui.drawRectOnImg('settingsWASDf', 'doorFindingImg', wanderSettings.DoorX * doorFindingDivRatio, wanderSettings.DoorY * doorFindingDivRatio, wanderSettings.DoorWidth * doorFindingDivRatio, wanderSettings.DoorHeight * doorFindingDivRatio);
			}, 500);
		};
		$('#settingsWAS').unbind('afterShow');
		$('#settingsWAS').bind('afterShow', paintDoorFinding);

		gui.events.clear('background');
		$('#doorFindingImg').remove();
		gui.events.on('background', function(value) {
			if (!value.response || value.response.Interaction.$.OperationType === 'fail' || value.response.Interaction.$.DfuId != self.dfuId || !value.imageData) {
				return;
			}
			var img = new Image();
			img.style = 'display: none';
			img.id = 'doorFindingImg';
			img.onload = function() {
				doorFindingImgRatio = img.height / img.width;
				paintDoorFinding();
			};
			img.src = value.imageData;
			$('body').append(img);
			$(img).css('display', 'none');
			
		});
		gui.events.clear('rect_on_image_updated');
		gui.events.on('rect_on_image_updated', function(value) {
			wanderSettings.DoorX = value.rect.x / doorFindingDivRatio;
			wanderSettings.DoorY = value.rect.y / doorFindingDivRatio;
			wanderSettings.DoorWidth = value.rect.width / doorFindingDivRatio;
			wanderSettings.DoorHeight = value.rect.height / doorFindingDivRatio;
		});
	};
	
	// history
	var historyPageInit = function(button) {
		$(':mobile-pagecontainer').pagecontainer('change', '#historyPage', { transition: 'slide' });
		var self = this,
		    mockData = {
				line: [],
				bar: []
			};
		$('#reportsLD').show();
		$('#reportsLM').hide();
		$('input[type=radio][name*="historyNav"]').unbind('change');
		$('input[type=radio][name*="historyNav"]').bind('change', function(evt) {
			var id = evt.target.id;
			switch(id) {
				case 'historyNavBarLD':
					$('#reportsLD').show(0);
					$('#reportsLM').hide();
					initCanvas.bind(reportsLD)();
					//getData.bind(reportsLD)(renderData.bind(reportsLD));
					break;
				 case 'historyNavBarLM':
					$('#reportsLD').hide();
					$('#reportsLM').show(0);
					//initCanvas.bind(reportsLM)();
					//getData.bind(reportsLM)(renderData.bind(reportsLM));
					break;
			   default:
					break;
			}
		});
		var clickHandler = function(next) {
			var handler = function() {
				var newDate = calculateNextDate(this.currentRequestType, this.currentRequestData, next);
				//console.log('880', newDate);
				if (newDate) {
					currentRequestData = newDate;
					getData.bind(this)(renderData.bind(this));
				}
			};
			return handler.bind(this);
		};
		var calculateNextDate = function(currentRequestType, currentRequestData, next) {
			var today = new Date();
			today.setHours(0, 0, 0, 0); 
			switch (currentRequestType) {
			case 'day':
				if (next) {
					if (currentRequestData.toString() === today.toString()) {
						return null;
					} else {
						return currentRequestData.addDays(1);
					}
				} else {
					return currentRequestData.addDays(-1);
				}
			case 'month':
				today.setDate(1);
				if (next) {
					if (currentRequestData.toString() === today.toString()) {
						return null;
					} else {
						return new Date(currentRequestData.setMonth(currentRequestData.getMonth() + 1));
					}
				} else {
					return new Date(currentRequestData.setMonth(currentRequestData.getMonth() - 1));
				}
			}

		};
		var historyData = [];
		var saveHistoryData = function(y, m, d, type, data) {
			var year;
			for (var i=0; i<historyData.length; i++) {
				if (historyData[i].Year === y) {
					if (type === 'year') {
						historyData[i] = data;
						return;
					}
					year = historyData[i];
					break;
				}
			}
			if (!year) {
				if (type === 'year') {
					historyData.push(data);
					return;
				}
				year = new yearly(y);
				historyData.push(year);
			}
			if (m === -1) return;
			var month;
			for (var i=0; i<year.Monthly.length; i++) {
				if (year.Monthly[i].Month === m) {
					if (type === 'month') {
						year.Monthly[i] = data;
						return;
					}
					month = year.Monthly[i];
					break;
				}
			}
			if (!month) {
				if (type === 'month') {
					year.Monthly.push(data);
					return;
				}
				month = new monthly(m);
				year.Monthly.push(month);
			}
			if (d === -1) return;
			for (var i=0; i<month.Daily.length; i++) {
				if (month.Daily[i] && month.Daily[i].Day === d) {
					if (type === 'day') {
						month.Daily[i] = data;
						return;
					}
				}
			}
			month.Daily.push(data);
		};
		// get data from cache
		var getHistoryData = function(y, m, d) {
			var year;
			for (var i=0; i<historyData.length; i++) {
				if (historyData[i].Year === y) {
					year = historyData[i];
					break;
				}
			}
			if (m === -1 || !year) return year;
			var month;
			for (var i=0; i<year.Monthly.length; i++) {
				if (year.Monthly[i].Month === m) {
					month = year.Monthly[i];
					break;
				}
			}
			if (!month) return month;
			// TODO do the same check for year
			if (d === -1) {
				var today = new Date();
				var numOfDay = (m === today.getMonth() + 1 && y === today.getFullYear()) ? today.getDate() : (new Date(y, m, 0).getDate());
				if (month.Daily.length < numOfDay) return null;
				return month;
			}
			for (var i=0; i<month.Daily.length; i++) {
				if (month.Daily[i] && month.Daily[i].Day === d) return month.Daily[i];
			}
			return null;
		};
		var reportsLD = {
			getDateStr: function() {
				return this.currentRequestData.getMonth() + 1 + '-' + this.currentRequestData.getDate() + '-' + this.currentRequestData.getFullYear();
			},
			getTitle: function() {
				return i18next.t('historyPage.historyOf', {date: this.getDateStr()});
			},
			titleId: 'reportsLDTitle',
			canvasId: 'reportsLDCanvas',
			currentRequestType: 'day',
			currentRequestData: new Date(),
			arrayFieldName: 'Hourly',
			indexFieldName: 'Hour',
			getIndexBound: function() { return {start: 0, end: 23}; },
			dataFieldNames: ['HourlyMotionRate', 'HourlyWanderInNumber', 'HourlyWanderOutNumber', 'HourlySOSNumber', 'HourlyFallNumber', 'HourlyAbnormalNumber'],
			dataFieldNamesI18n: ['historyPage.plot.motion', 'historyPage.plot.wanderin', 'historyPage.plot.wanderout', 'historyPage.plot.sos', 'historyPage.plot.fall', 'historyPage.plot.abnormal'],
			data: mockData,
			init: function() {
				this.currentRequestData.setHours(0, 0, 0, 0);
				$('#reportsLDPrev').bind('click', clickHandler.bind(reportsLD)(false));
				$('#reportsLDNext').bind('click', clickHandler.bind(reportsLD)(true));
			}
		};
		var initCanvas = function() {
			if (this.plot) return;
			this.init();
			var lineSeriesObj = {
				label: i18next.t(this.dataFieldNamesI18n[0]),
				data: null,
				lines: { show: true, fill: false }
			};
			this.chartObj = [];
			this.chartObj.push(lineSeriesObj);
			for (var i=1; i<this.dataFieldNames.length; i++) {
				this.chartObj.push(
					{
						label: i18next.t(this.dataFieldNamesI18n[i]),
						data: null,
						lines: { show: true, fill: false }
					});
			}
			this.plot = $.plot($('#' + this.canvasId), [this.chartObj], {
				xaxis: {
					position: 'bottom',
					tickDecimals: 0,
					//mode: 'time'
				},
				yaxis: {
					max: 100,
					min: 0
				},
				legend: {
					noColumns: 3,
					container: $('#reportsLegend')
				},
				touch: {
					pan: 'x',
					scale: ''
				},
				pan: {
					interactive: true
				}
			});
			//canvasDiv.bind('plottouchend', plotTouchendHandler.bind(this));
		};
		// fill zeros and sort
		var completeAndSort = function() {
			if (!this.data[this.arrayFieldName]) return;

			var self = this,
				indexBound = this.getIndexBound();
			for (var i=indexBound.start; i<indexBound.end; i++) {
				var result = $.grep(this.data[this.arrayFieldName], function(e) { return e[self.indexFieldName] === i;});
				if (result.length === 0) {
					var elm = {};
					elm[this.indexFieldName] = i;
					for (var j=0; j<this.dataFieldNames.length; j++) {
						elm[this.dataFieldNames[j]] = 0;
					}
					this.data[this.arrayFieldName].push(elm);
				}
			}
			var compare = function(a, b) {
				if (a[self.indexFieldName] < b[self.indexFieldName]) return -1;
				if (a[self.indexFieldName] > b[self.indexFieldName]) return 1;
				return 0;
			};
			this.data[this.arrayFieldName].sort(compare);
		};
		// get data from remote or cache
		var getData = function(callback) {
			var d,
				type = this.currentRequestType,
				year = this.currentRequestData.getFullYear(),
				month,
				day,
				remoteDataFieldName,
				self = this;
			switch (this.currentRequestType) {
			case 'day':
				day = this.currentRequestData.getDate();
				month = this.currentRequestData.getMonth() + 1;
				remoteDataFieldName = 'Daily';
				break;
			case 'month':
				day = -1;
				month = this.currentRequestData.getMonth() + 1;
				remoteDataFieldName = 'Monthly';
				break;
			case 'year':
				day = -1;
				month = -1;
				remoteDataFieldName = 'Yearly';
				break;
			}
			d = getHistoryData(year, month, day);
			if (d) {
				callback(d);
			} else {
				var requestHistory = function() {
					socket.emit('dfu_request', new  dfu.Request('command', 'get_history', self.dfuId, null, {Year: year, Month: month, Day: day}));
				};
				requestHistory();
				var dataHandler = function(value) {
					if (value.request.data.Year === year
						&& value.request.data.Month === month
						&& value.request.data.Day === day) {
						// TODO: fill zeros when 'not available'
						if (value.response.Interaction.$.OperationType === 'fail' ) {
							//requestHistory();
							console.log('requestHistory fail');
							return;
						}
						gui.events.un('get_history', dataHandler);
						if (value.response.Interaction.Query && value.response.Interaction.Query.Result === 'not available') {
							console.log('TODO requestHistory data not available, fill with zeros.');
							callback(null);
							return;
						}
						saveHistoryData(year, month, day, type, value.response.Interaction[remoteDataFieldName]);
						console.log(value.response.Interaction);
						callback(value.response.Interaction[remoteDataFieldName]);
					}
				};
				gui.events.on('get_history', dataHandler);
			}
		}; 
		var renderData = function(data) {
			$('#' + this.titleId).text(this.getTitle());
			for (var i=0; i<this.dataFieldNames.length; i++) {
				this.chartObj[i].data = [];
			}
			this.data = data[0];
			if (this.data && this.data[this.arrayFieldName]) {
				completeAndSort.bind(this)();
				var d = this.data[this.arrayFieldName];
				for (var i=0 && d; i<d.length; i++) {
					for (var j=0; j<this.dataFieldNames.length; j++) {
						this.chartObj[j].data.push([d[i][this.indexFieldName], d[i][this.dataFieldNames[j]] ? d[i][this.dataFieldNames[j]] : 0]);
					}
				}
			}
			this.plot.setData(this.chartObj);
			this.plot.setupGrid();
			if ($('#' + this.canvasId).is(':visible')) {
				this.plot.draw();
				if (this.chartObj[0].data.length === 0) {
					$('#reportsDataUnavailable').removeClass('hidden');
				} else {
					$('#reportsDataUnavailable').addClass('hidden');
				}
			}
		};
	};
/*
	// new resident
	$('#newResidentUploadPic').on('click', function() {
		document.getElementById('newResidentFile').click();
	});
	$('#newResidentFile').change(function(e) {
		var file = e.target.files[0];
		if (file.size > gui.maxUploadFileSize) {
			gui.toast('File is too big: ' + file.size + '. Maximum file size: ' + gui.maxUploadFileSize, 3000);
			return;
		}
		var stream = ss.createStream();
		ss(socket).emit('file', stream, {size: file.size, name: file.name, type: file.type, dest: 'id_photos'});
		var blobStream = ss.createBlobReadStream(file);
		var size = 0;
		blobStream.on('data', function(chunk) {
			size += chunk.length;
			var percent = Math.floor(size/file.size * 100);
			$('#newResidentUploadBar').width(percent + '%');
			console.log(percent);
		});
		blobStream.on('end', function(evt) {
			//$('#addReportFile').prop('disabled', false).removeClass('ui-disabled');
			console.log('blobStream end', evt);
		});
		
		var newResidentUploadHandler = function(evt) {
			$('#newResidentPhoto').prop('src', '/images/bruyere/id_photos/' + evt.savedName);
			$('#newResidentPhotoFile').prop('value', evt.savedName);
			console.log(evt);
			socket.removeListener('file_uploaded', newResidentUploadHandler);
		};
		socket.on('file_uploaded', newResidentUploadHandler);
		blobStream.pipe(stream);
	});
*/

	var residentEditHandler = function(opt) {
        $.ajax(
        {
            url : '/api/v1/bruyere/edittext',
            type: "POST",
            contentType: 'application/json',
            data : JSON.stringify(opt),
            success:function(data, textStatus, jqXHR) 
            {
                if (data.error) {
                    gui.toast('Text edit failed.');
                } else {
                    gui.toast('Text edit successful.');
					if ( $.mobile.activePage.attr( "id" ) == 'nameEditPage') {
						// TODO reload data, refresh ui
						$.mobile.back();
					}
					gui.events.emit('resident_update', [{dfuId: opt.dfuId, type: opt.type, value: opt.text}], false);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) 
            {
                gui.toast('Text edit failed.');
            }
        });
	};
	// name edit
    $('#nameEditForm').submit(function(evt) {
        if ($('#nameEditInput').val() === '') {
            gui.toast('Please enter text.');
            evt.preventDefault();
            return;
        }

        var opt = {
            text: $('#nameEditInput').val(),
			adminPassword: gui.adminPassword,
			type: $('#nameEditType').val(),
			dfuId: $('#nameEditId').val()
        };
		residentEditHandler(opt);
        evt.preventDefault(); //STOP default action
    });
	$('#nameEditCancel').bind('click', function(evt) {
		$.mobile.back();
	});
	// profile photo upload
	$('#profilePhotoUpload').change(function(e) {
		var file = e.target.files[0];
		if (file.size > gui.maxUploadFileSize) {
			gui.toast('File is too big: ' + file.size + '. Maximum file size: ' + gui.maxUploadFileSize, 3000);
			return;
		}
		var stream = ss.createStream();
		ss(socket).emit('file', stream, {size: file.size, name: file.name, type: file.type, dest: 'id_photos'});
		var blobStream = ss.createBlobReadStream(file);
		var size = 0;
		$.mobile.loading('show');
		blobStream.on('data', function(chunk) {
			size += chunk.length;
			var percent = Math.floor(size/file.size * 100);
			$('#profilePhotoUploadBar').width(percent + '%');
			console.log(percent);
		});

		blobStream.on('end', function(evt) {
			console.log('blobStream end', evt);
			$.mobile.loading('hide');
		});

		var profileUploadHandler = function(evt) {
			$('#profilePhoto').prop('src', gui.iconPath + evt.savedName);
			alarmButtons.forEach(function(btn) {
				if (btn.resident.dfuId == $('#profileId').val()) {
					btn.setIcon(gui.iconPath + evt.savedName);
					btn.resident.residentPic = evt.savedName;
				}
			});
			var opt = {
				dfuId: $('#profileId').val(),
				text: evt.savedName,
				type: 'residentPic',
				adminPassword: gui.adminPassword
			};
			residentEditHandler(opt);
			// TODO refresh ui
			console.log(evt);
			socket.removeListener('file_uploaded', profileUploadHandler);
		};
		socket.on('file_uploaded', profileUploadHandler);
		blobStream.pipe(stream);
	});
	gui.events.on('dfu_alarm', function(evt) {

		var audio = new Audio('/sms-alert-3-daniel_simon.wav');
		audio.play();
		console.log(evt);
		alarmButtons.forEach(function(btn) {
			if (btn.resident.dfuId == evt.dfuId) {
				btn.setAlarm(true);
				
				var txt = evt.alarmType + ' triggerred by ' + btn.resident.residentName;
				if (window.Notification && !gui.isMobile) {
					Notification.requestPermission(function(result) {
						if (result === 'granted') {
							navigator.serviceWorker.ready.then(function(registration) {
								registration.showNotification(txt , {tag: 'RemoCare', clickTarget:'https://wip.remocare.net'});
							});
						}
					});
				}
			}
		});
	});
	gui.events.on('alarm_viewed', function(evt) {
		console.log(evt);
		alarmButtons.forEach(function(btn) {
			if (btn.resident.dfuId == evt.dfuId) {
				btn.setAlarm(false);
			}
		});
	});
	// alarm info page
	$('#alarmInfoClose').bind('click', function(evt) {
		$.mobile.back();
	});
	var getAlarmSnapshot = function(dfuId, alarmId, callback) {
		// Remove the old alarm history
		var opt = {
					dfuId: dfuId,
					alarmId: alarmId
				  };
		$.ajax(
		{
			url : '/api/v1/bruyere/alarmsnapshot',
			type: "POST",
			contentType: 'application/json',
			data : JSON.stringify(opt),
			success: callback,
			error: function(jqXHR, textStatus, errorThrown) 
			{
				gui.toast('Getting alarm snapshot failed.');
			}
		});
	};
	var alarmInfoClickHandler = function() {
		var handler = function() {
			var text = 'A ' + this.type + ' alarm was received for ' + this.name + ' from ' + this.room + ' at ' + this.time + '.<br>Please see the following snapshot taken when the alarm happened.';
			$('#alarmInfoText').prop('innerHTML', text);
			//$('#alarmInfoImage').wrap('<a href="' + this.link + '" target="_blank"></a>');
			$('#alarmInfoImage').prop('src', '/images/bruyere/alarm_default.png');
			//console.log(this.id, this.name, this.type, this.room, this.time, this.link);
			getAlarmSnapshot(this.dfuId, this.alarmId, function(alarmData, textStatus, jqXHR) {
				if(alarmData.error) {
					gui.toast('Getting alarm snapshot failed.');
				} else if (alarmData[0].snapshot){
					$('#alarmInfoImage').prop('src', alarmData[0].snapshot);
				}
			});
			$(':mobile-pagecontainer').pagecontainer('change', '#alarmInfoPage', { transition: 'slide' });
		};
		return handler.bind(this);
	};
	
	var alarmButtons = [];
	var alarmButtonContainer = $('#alarmButtonContainer');
	gui.events.on('resident_list_ready', function(result) {
		result.data.forEach(function(data) {
			var iconPath = data.residentPic ? gui.iconPath + data.residentPic : '/images/bruyere/Icons_Photo.png';
			if (!data.residentName)
				data.residentName = 'Resident name';
			if (!data.residentRoom)
				data.residentRoom = data.deviceName;
			var button = new gui.MainFunctionButton(data.residentName,
													data.residentRoom,
													iconPath,
													alarmButtonContainer);
			button.resident = data;
			socket.emit('dfu_request', new dfu.Request('query', 'system', button.resident.dfuId));
			var systemHandler = function(value) {
				if (!value.response || value.response.Interaction.$.OperationType === 'fail') {
					console.log('Failed on getting system for dfu:', button.resident.dfuId);
					return;
				}
				if (value.response.Interaction.$.DfuId != button.resident.dfuId) {
					return;
				}
				button.resident.system = value.response.Interaction.Data[0].System[0];
				gui.events.un('system', systemHandler);
				console.log('got system for ' + button.resident.dfuId);
			};
			gui.events.on('system', systemHandler);
			// request saved alarms
			socket.emit('dfu_saved_alarm', {dfuId: button.resident.dfuId});
			button.motionData = [];
			var historyDiv = $('#alarmHistoryContent');
			var addAlarmItem = function(item, index) {
				item.date = (new Date(item.date)).toLocaleString();
				var alarmHistoryOutter = index % 2 == 0
										 ? $( "<div class='alarmHistoryOutter'></div>" )
										 : $( "<div class='alarmHistoryOutterAlt'></div>" ),
					alarmHistoryIconDiv = $( "<div class='alarmHistoryIconDiv'></div>"),
					alarmHistoryTextDiv = $("<div class='alarmHistoryTextDiv'></div>"),
					alarmHistoryPlayDiv = $("<div class='alarmHistoryPlayDiv'></div>"),
					alarmHistoryIcon = $("<img src='" + gui.getAlarmIcon(item.alarmType) + "' class='alarmHistoryIcon  hv-center'></div>");
				alarmHistoryTextDiv.prop('innerHTML', item.alarmType + ' alarm at ' + item.date)
				alarmHistoryIconDiv.append(alarmHistoryIcon)
				if (item.clipUrl) {
					var alarmHistoryPlayIcon = $("<a href='" + item.clipUrl + "' rel='external' target='_blank'><img src='" + gui.imagePath + "play-button.png' class='alarmHistoryIcon hv-center'></a>");
					alarmHistoryPlayDiv.append(alarmHistoryPlayIcon);
				}
				alarmHistoryOutter.append(alarmHistoryIconDiv);
				alarmHistoryOutter.append(alarmHistoryTextDiv);
				alarmHistoryOutter.append(alarmHistoryPlayDiv);
				historyDiv.append(alarmHistoryOutter);
				$(alarmHistoryTextDiv).bind('click', alarmInfoClickHandler.bind({
					dfuId: data.dfuId,
					alarmId: item.alarmId,
					name: data.residentName,
					room: data.residentRoom,
					type: item.alarmType,
					time: item.date,
					link: '#'
				})());
			};
			var refreshAlarmList = function() {
				// Remove the old alarm history
				var opt = {dfuId: data.dfuId};
				$.ajax(
				{
					url : '/api/v1/bruyere/listalarms',
					type: "POST",
					contentType: 'application/json',
					data : JSON.stringify(opt),
					success:function(alarmData, textStatus, jqXHR) 
					{
						historyDiv.html('');
						if (alarmData.error) {
							gui.toast('Getting alarm list failed.');
							return;
						}
						alarmData.forEach(addAlarmItem);
					},
					error: function(jqXHR, textStatus, errorThrown) 
					{
						gui.toast('Getting alarm list failed.');
					}
				});
			};
			//refreshAlarmList();
			gui.events.on('dfu_alarm', function(evt) {
				if (evt.dfuId == data.dfuId) {
					refreshAlarmList();
				}
			});
			gui.events.on('dfu_alarm_update', function(evt) {
				if (evt.dfuId == data.dfuId) {
					refreshAlarmList();
				}
			});
			button.setVClickHandler(function() {
				if (button.hasAlarm()) {
					button.setAlarm(false);
					socket.emit('dfu_alarm_viewed', {dfuId: button.resident.dfuId});
				}
				$('#profilePhotoUploadBar').width('0');
				var iconPath = button.resident.residentPic ? gui.iconPath + button.resident.residentPic : '/images/bruyere/Icons_Photo.png';
				$('#profilePhoto').prop('src', iconPath);
				$('#profileName span').prop('innerText', data.residentName);
				$('#profileRoom span').prop('innerText', data.residentRoom);
				$('#profileId').val(data.dfuId);

				$(':mobile-pagecontainer').pagecontainer('change', '#profilePage', { transition: 'slide' });
				var nameEdit = $('#profileNameEdit');
				nameEdit.unbind('click');
				nameEdit.bind('click', profileNameEditHandler.bind({
						dfuId: data.dfuId,
						string: button.resident.residentName,
						title: 'Resident Name',
						placeholder: 'Enter Resident Name',
						type: 'residentName'
					})());
				var roomEdit = $('#profileRoomEdit');
				roomEdit.unbind('click');
				roomEdit.bind('click', profileNameEditHandler.bind({
						dfuId: data.dfuId,
						string: button.resident.residentRoom,
						title: 'Resident Room',
						placeholder: 'Enter Resident Room',
						type: 'residentRoom'
					})());
				var photoEdit = $('#profilePhotoEdit');
				photoEdit.unbind('click');
				photoEdit.bind('click', function(evt) {
					document.getElementById('profilePhotoUpload').click();
					$('#profileId').prop('value', data.dfuId);
				});
				refreshAlarmList();
				// video button
				$('#profileVideo').unbind('click');
				$('#profileVideo').bind('click', function(evt) {
					videoPageInit.bind(data)(button);
				});
				$('#profileMotion').unbind('click');
				$('#profileMotion').bind('click', function(evt) {
					motionPageInit.bind(data)(button);
				});
				$('#profileHistory').unbind('click');
				$('#profileHistory').bind('click', function(evt) {
					//historyPageInit.bind(data)(button);
				});
				$('#profileSettings').unbind('click');
				$('#profileSettings').bind('click', function(evt) {
					settingsPageInit.bind(data)(button);
				});
			});

			
			alarmButtons.push(button);
		});
		layoutIcons();
	});

	gui.events.on('resident_update', function(result) {
		if ($('#profileId').val() == result.dfuId) {
			if (result.type == 'residentName') {
				$('#profileName span').prop('innerText', result.value);
			} else if (result.type == 'residentRoom') {
				$('#profileRoom span').prop('innerText', result.value);
			}
		}
		alarmButtons.forEach(function(btn) {
			if (result.dfuId == btn.resident.dfuId && btn.resident[result.type] != undefined) {
				btn.resident[result.type] = result.value;
				if (result.type == 'residentName') {
					btn.setText1(result.value);
				} else if (result.type == 'residentRoom') {
					btn.setText2(result.value);
				}
			}
		});
	});
	
    var layoutIcons = function() {
        if ($.mobile.activePage[0].id !== 'mainPage') return;
        gui.isMobile = ( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ); 
		var isMobile = $(window).width() < 800;
        var isPortrait = $(window).height() > $(window).width();
        if (isMobile) {
            var MAX_ICON_WIDTH = 130;
            var numIconPerRow = isPortrait ? 2 : 4;
            var minMargin =  $('#alarmButtonContainer').width() / numIconPerRow * 0.1 > 10 ?  $('#alarmButtonContainer').width() / numIconPerRow * 0.1 : 10;
            var w1 = $('#alarmButtonContainer').width() / numIconPerRow - minMargin*2;
            //var w2 = (($('#mainPage').height() - $('#mainPageHeader').height() - $('#footer').height()) - 30) / 2;
            var iconWidth = Math.min(w1, gui.MAX_ICON_SIZE_MOBILE);
			console.log(iconWidth, iconWidth/0.618);
            alarmButtons.forEach(function(icon) {
                //icon.setHeight(iconWidth);
                //icon.button.css({'margin-top': minMargin, 'margin-bottom': minMargin});

                if (isPortrait) {
					var h = ($(window).width() -32)/2/0.8;
					console.log(h);
                    icon.button.removeClass('alarmButton25');
                    icon.button.addClass('alarmButton50');
					icon.button.css({'height': h+64 + 'px'});
					icon.img.css({'height':h});
                } else {
                    icon.button.removeClass('alarmButton50');
                    icon.button.addClass('alarmButton25');
					icon.button.css({'height': h+64 + 'px'});
					icon.img.css({'height':h});
                }
            });

            var containerMargin = ($('#mainPage').height() - $('#mainPageHeader').height() - iconWidth*2) / 4;
            $('#alarmButtonContainer').css({'margin-bottom': containerMargin});
            $('#functionButtonContainer').css({'margin-top': containerMargin, 'margin-bottom': containerMargin});
         } else {
            var minMargin =  $('#alarmButtonContainer').width() / 4 * 0.1 > 10 ?  $('#alarmButtonContainer').width() / 4 * 0.1 : 10;
            var w1 = $('#alarmButtonContainer').width() / 4 - minMargin*2;
            //var w2 = (($('#mainPage').height() - $('#mainPageHeader').height() - $('#footer').height()) - 30) / 2;
            var iconWidth = Math.min(w1, gui.MAX_ICON_SIZE_DESK);
            alarmButtons.forEach(function(icon) {
                icon.button.removeClass('alarmButton50');
                icon.button.addClass('alarmButton25');
                //icon.setHeight(iconWidth);
                //icon.button.css({'height': iconWidth});
            });

            var containerMargin = ($('#mainPage').height() - $('#mainPageHeader').height() - iconWidth*2) / 4;
            $('#alarmButtonContainer').css({'margin-top': containerMargin, 'margin-bottom': containerMargin});
        }

    };
    //layoutIcons();
	/*
	var setContentHeight = function() {
		var screen = $.mobile.getScreenHeight(),
			header = $(".ui-header").hasClass("ui-header-fixed") ? $(".ui-header").outerHeight() - 1 : $(".ui-header").outerHeight(),
			contentCurrent = $(".ui-content").outerHeight() - $(".ui-content").height(),
			content = screen - header - contentCurrent;
		$(".ui-content").height(content);
	};
	setContentHeight();*/
    $(window).resize(function() {
		layoutIcons();
		//setContentHeight();
	});
	$('#adminButton').bind('click', function(evt) {
		//$(':mobile-pagecontainer').pagecontainer('change', '#adminPasswordPage', { transition: 'slide' });
		var admin = $('#adminButton span:nth-child(2)');
		if (admin.text() == 'Admin') {
			gui.events.emit('admin_granted');
			admin.text('Normal');
		} else {
			gui.events.emit('admin_ungranted');
			admin.text('Admin');
		}
    });
	/*
	// admin password

    $('#adminPasswordForm').submit(function(evt) {
        if ($('#adminPasswordInput').val() === '') {
            gui.toast('Please enter password.');
            evt.preventDefault();
            return;
        }

        var opt = {
            adminPassword: $('#adminPasswordInput').val(),
        };
		gui.adminPassword = $('#adminPasswordInput').val();

        $.ajax(
        {
            url : '/api/v1/bruyere/adminpassword',
            type: "POST",
            contentType: 'application/json',
            data : JSON.stringify(opt),
            success:function(data, textStatus, jqXHR) 
            {
                if (data.error) {
                    gui.toast('Incorrect password.');
                } else {
                    gui.toast('Login successful.');
					if ( $.mobile.activePage.attr( "id" ) == 'adminPasswordPage') {
						gui.adminGranted = true;
						gui.events.emit('admin_granted');
						$.mobile.back();
					}
                }
            },
            error: function(jqXHR, textStatus, errorThrown) 
            {
                gui.toast('Login failed.');
            }
        });
        evt.preventDefault(); //STOP default action
    });
	$('#adminPasswordCancel').bind('click', function(evt) {
		$.mobile.back();
	});
	// new resident
    $('#newResidentForm').submit(function(evt) {
		var errMsg = '';
        if ($('#newResidentName').val() === '') {
            errMsg += 'Please enter name.<br>';
        }
        if ($('#newResidentRoom').val() === '') {
            errMsg += 'Please enter room.<br>';
        }
        if ($('#newResidentDfu').val() === '') {
            errMsg += 'Please enter camera id.<br>';
        }
		if (errMsg != '') {
			$('#newResidentErr').prop('innerHTML', errMsg);
			evt.preventDefault();
			return;
		} else {
			$('#newResidentErr').prop('innerHTML', '');
		}
        var opt = {
            name: $('#newResidentName').val(),
			room: $('#newResidentRoom').val(),
			dfuId: $('#newResidentDfu').val(),
			pic: $('#newResidentPhotoFile').val(),
			adminPassword: gui.adminPassword
        };

        $.ajax(
        {
            url : '/api/v1/bruyere/newresident',
            type: "POST",
            contentType: 'application/json',
            data : JSON.stringify(opt),
            success:function(data, textStatus, jqXHR) 
            {
                if (data.error) {
                    gui.toast('Adding new resident failed.');
					$('#newResidentErr').innerHTML(data.error);
                } else {
                    gui.toast('Adding new resident successful.');
					if ( $.mobile.activePage.attr( "id" ) == 'newResidentPage') {
						// TODO reload data, refresh ui
						$.mobile.back();
					}
                }
            },
            error: function(jqXHR, textStatus, errorThrown) 
            {
                gui.toast('Adding new resident failed.');
            }
        });
        evt.preventDefault(); //STOP default action
    });*/

});

$(document).ready(function() {
      i18next
        .use(i18nextXHRBackend)
        .use(i18nextBrowserLanguageDetector)
        .init({
        debug: 'true',
        //lng: 'en', // evtl. use language-detector https://github.com/i18next/i18next-browser-languageDetector
        //ns: 'example',
        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json'
        },
        detection: {
            // order and from where user language should be detected
            order: ['querystring', 'cookie', 'localStorage', 'navigator'],

            // keys or params to lookup language from
            lookupQuerystring: 'lng',
            lookupCookie: 'i18next',
            lookupLocalStorage: 'i18nextLng',

            // cache user language on
            caches: ['localStorage', 'cookie']

            // optional expire and domain for set cookie
            //cookieMinutes: 10,
            //cookieDomain: 'myDomain'
        }
     }, function(err, t) {
        // for options see
        // https://github.com/i18next/jquery-i18next#initialize-the-plugin
        i18nextJquery.init(i18next, $);
        // start localizing, details:
        // https://github.com/i18next/jquery-i18next#usage-of-selector-function
        $('#mainPage').localize();
        $('#commentsPage').localize();
        $('#settingsPage').localize();
        $('#historyPage').localize();
     });
});