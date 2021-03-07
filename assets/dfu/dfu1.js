gui.OnScreenDataSensor = function(id, dfuId) {
    gui.OnScreenSensor.call(this, id, dfuId);
    var self = this;
    this.toolbarButton = new gui.ToolBarButton(this.sensor.Label, this.consts.ICON, $('#toolbar'));
    this.toolbarButton.setVClickHandler(function (evt) {
        var detailInfo = $('#detailInfo');
        detailInfo.empty();
        detailInfo.append(self.table);
        dfu.liveSensor.start(dfu.currentDfuId);
    });
    var caption1 = $('<caption class="sensorData">' + this.sensor.Label + '</caption>').css('font-size', '12pt');
    var caption2 = $('<caption class="sensorData">' + this.sensor.Desc + '</caption>').css('font-size', '9pt');

    this.table = $('<table class="sensorData"></table>').css('width', '100%');
    caption1.appendTo(this.table);
    caption2.appendTo(this.table);
    var tbody = $('<tbody></tbody>');
    
    for (var i=0; this.consts.DESC && i<this.consts.DESC.length; i++) {
        var tr = $('<tr id="' + id + '-' + i + '"><td class="sensorDataDesc sensorData">' + this.consts.DESC[i] + '</td><td class="sensorDataValue sensorData"></td></tr>');
        tr.appendTo(tbody);
    }
    tbody.appendTo(this.table);
    this.dataHandler = function(value) {
        if (!value.response || !value.response.Interaction.Data || value.response.Interaction.DfuId != self.dfuId || !value.response.Interaction.Data.Sensors.Sensor)
            return;
        for (var i = 0; i < value.response.Interaction.Data.Sensors.Sensor.length; i++) {
            var sensor = value.response.Interaction.Data.Sensors.Sensor[i];
            if (sensor.SensorId != self.id)
                continue;
            if (!sensor.Channel)
                continue;
            var content = '';
            if (sensor.ChannelNumber == 1) {
                $('#' + self.id + '-0' + ' td.sensorDataValue').html(sensor.Channel.Value);
                continue;
            }
            for (var j = 0; j < sensor.ChannelNumber; j++) {
                $('#' + self.id + '-' + j + ' td.sensorDataValue').html(sensor.Channel[j].Value);
            }
        }
    };
    gui.events.on('live_sensor', this.dataHandler);
    this.destroy = function () {
        gui.events.un('live_sensor', self.dataHandler);
        self.table.remove();
        self.toolbarButton.destroy();
        delete self.toolbarButton;
    };
};

gui.OnScreenVideoSensor = function(id, dfuId) {
    VideoSensor.call(this, id, dfuId);
    var self = this;
    this.toolbarButton = new ToolBarButton(this.sensor.Label, this.consts.ICON, $('#toolbar'));
    this.toolbarButton.setVClickHandler(function(evt) {
        var detailInfo = $('#detailInfo');
        detailInfo.empty();
        detailInfo.append(self.descDiv);
        detailInfo.append(self.videoDiv);
        self.stopRefresh = false;
        self.play();
    });
    var caption1 = $('<caption class="sensorData">' + this.sensor.Label + '</caption>').css('font-size', '12pt');
    var caption2 = $('<caption class="sensorData">' + this.sensor.Desc + '</caption>').css('font-size', '9pt');
    this.descDiv = $('<div/>', {
        class: 'videoDescDiv'
    });
    this.descDiv.html('<span style="font-size:12pt">' + this.sensor.Label + '</span><br><span style="font-size:9pt">' + this.sensor.Desc + '</span>');

    this.toolbarButtonPressedHandler = function () {
        self.stopRefresh = true;
    };
    this.toolbarButton.setButtonPressedHandler(this.toolbarButtonPressedHandler);

    // TODO: remove this hack.
    var oldDestroy = this.destroy;
    this.destroy = function () {
        oldDestroy();
        self.descDiv.remove();
        self.toolbarButton.destroy();
        delete self.toolbarButton;
    };
};

gui.OnScreenVideoDiv = function(id, dfuId) {
    gui.VideoSensor.call(this, id, dfuId);
    var self = this;
    this.videoDiv.appendTo($('#videoDivContainer'));
    var videoDenied = $('<div/>', {
        class: 'videoDenied',
        text: 'Live video is denied.'
    });
    var playButton = $('<div/>', {
        class: 'videoButton playButton',
        id: 'p1'
    });
    var pauseButton = $('<div/>', {
        class: 'videoButton pauseButton'
    });
    playButton.on('vclick', function() {
        self.play();
        playButton.addClass('hidden');
        pauseButton.removeClass('hidden');
    });
    pauseButton.on('vclick', function() {
        self.stop();
        pauseButton.addClass('hidden');
        playButton.removeClass('hidden');
    });
    var videoNavHandler = function (value) {
        if (value.divId === 'video' + id) {
            //self.stopRefresh = false;
            self.getFirstFrame(function() {
                playButton.appendTo(self.videoDiv);
                pauseButton.appendTo(self.videoDiv);
                pauseButton.addClass('hidden');
            });
            self.videoDiv.removeClass('hidden');
        } else {
            pauseButton.trigger('vclick');
            self.videoDiv.addClass('hidden');
        }
    };
    gui.events.on('videoNavChanged', videoNavHandler);
    gui.events.on('live_video_denied', function(value) {
        if (value.dfuId === self.dfuId && value.id === self.id) {
            videoDenied.appendTo(self.videoDiv);
            playButton.addClass('hidden');
            pauseButton.addClass('hidden');
            self.videoImgPlaceHolder.attr('src', '');
            $('label[for="v' + id + '"]').addClass('deleted');
        }
    });
    gui.events.on('first_video_frame_arrived', function(value) {
        if (value.dfuId === self.dfuId && value.id === self.id) {
            videoDenied.addClass('hidden');
            playButton.removeClass('hidden');
            pauseButton.addClass('hidden');
            $('label[for="v' + id + '"]').removeClass('deleted');
        }
    });
    // TODO: remove this hack.
    var oldDestroy = this.destroy;
    this.destroy = function () {
        oldDestroy();
        gui.events.un('videoNavChanged', videoNavHandler);
        $('#v' + id).remove();
        $('label[for="v' + id + '"]').remove();
    };
    gui.initFlashlightAndBeepButtons(this.videoDiv);
};

gui.VideoSensor = function(id, dfuId) {
    gui.OnScreenSensor.call(this, id, dfuId);
    var self = this;

    this.videoDiv = $('<div/>', {
        class: 'tabDiv',
        id: 'video' + id
    });
  //var videoDivHeight = $('#detailInfo').height() - 42 /*this.descDiv.height()*/;
    //this.videoDiv.height(videoDivHeight);
    this.videoImgPlaceHolder = $('<img>');
    this.videoImgPlaceHolder.css({
        //height: videoDivHeight <= 290 ? '100%' : '290px',
        width: '100%',
        height: '100%',
        display: 'block',
        margin: '0 auto'
    });
    this.videoImgPlaceHolder.appendTo(this.videoDiv);
    this.stopRefresh = true;
    this.getVideoFrame = function() {
        if (self.stopRefresh) {
            return;
        }
        getOneFrame();
        setTimeout(self.getVideoFrame, 300);
    }
    this.play = function() {
        self.stopRefresh = false;
        self.getVideoFrame();
    };
    this.stop = function () {
        self.stopRefresh = true;
    };
    var getOneFrame = function() {
        socket.emit('dfu_request', new dfu.Request('query', 'live_video', self.dfuId, self.id));
    };
    var getFirstFrameCallback = null,
        getFirstFrameTimeoutId;
    this.getFirstFrame = function(callback) {
        if (callback) getFirstFrameCallback = callback;
        if (self.videoImgPlaceHolder.attr('src')) {
            if (getFirstFrameCallback) getFirstFrameCallback();
            return;
        }
        getOneFrame();
        getFirstFrameTimeoutId = window.setTimeout(self.getFirstFrame, 500);
    };
    this.liveVideoEventHandler = function (value) {
        if (value.request.dfuId != self.dfuId || value.request.sensorid != self.id) {
            return;
        }
        if (!value.response) {
            return;
        }
        if (value.response.Interaction.OperationType === 'fail') {
            console.log('live_video operationtype fail');
        }
        if (value.response.Interaction.OperationType === 'denied') {
            if (getFirstFrameTimeoutId) {
                window.clearTimeout(getFirstFrameTimeoutId);
                getFirstFrameTimeoutId = null;
            }
            gui.events.emit('live_video_denied', [{dfuId: self.dfuId, id: self.id}]);
            return;
        }
        if (!value.imageData || !value.imageData.length) {
            return;
        }
        if (!self.videoImgPlaceHolder.attr('src')) {
            gui.events.emit('first_video_frame_arrived', [{dfuId: self.dfuId, id: self.id}]);
        }
        self.videoImgPlaceHolder.attr('src', value.imageData);
    };
    gui.events.on('live_video', self.liveVideoEventHandler);
    this.destroy = function () {
        self.stopRefresh = true;
        gui.events.un('live_video', self.liveVideoEventHandler);
        self.videoDiv.remove();
    };
};

gui.OnScreenAlarmSensor = function(id, dfuId) {
    gui.OnScreenSensor.call(this, id, dfuId);
    var self = this;
    this.button = new gui.AlarmBarButton(this.consts.TITLE, this.consts.ICON, $('#alarmbar'));

    this.button.setVClickHandler(function(evt) {
        $('#alarmDetailsTitle').text(self.consts.TITLE);
        $('#alarmDetailsDesc').html(self.log);
        self.log = '';
        self.logCount = 1;
        self.button.setAlarm(false);
        $('#alarmDetails').popup('open');
        setTimeout(function () {
            $('#alarmDetails').popup('close');
        }, 10000);
    });

    this.dataHandler = function(value) {
        if (!value || !value.streamId || value.dfuId != self.dfuId || value.streamId != self.id)
            return;

        self.button.setAlarm(true);
        if (self.logCount < 11)
            self.log += self.logCount + '. ' + self.consts.TITLE + ' detected at ' + value.date + '<br>';
        self.logCount++;
    };
    this.logCount = 1;
    this.log = '';
    gui.events.on('dfu_alarm', this.dataHandler);
    this.destroy = function () {
        $('#alarmDetailsTitle').text();
        $('#alarmDetailsDesc').html();
        gui.events.un('dfu_alarm', self.dataHandler);
        self.button.destroy();
        delete self.button;
    };
};

gui.Button = function(text, icon) {
    this.button = $('<div/>', {
        class: 'button'
    });
    this.icon = $('<div/>', {
        class: 'toolbarIcon'
    });
    this.icon.prepend('<img src="' + gui.iconPath + icon + '" class="toolbarButtonImage">');
    this.icon.appendTo(this.button);
    if (text) {
        this.button.addClass('toolbarButton');
        var text = $('<div/>', {
            class: 'toolbarText',
            text: text
        });
        text.appendTo(this.button);
    } else {
        this.button.addClass('alarmbarButton');
    }
};

gui.ToolBarButton = function(text, icon, container) {
    gui.Button.call(this, text, icon);
    var self = this;
    this.id = text;
    this.button.appendTo(container);
    this.button.bind('vclick', function (evt) {
        evt.preventDefault();
        self.button.addClass('toolbarButtonPressed');
        //if (self.vclickHandler)
        //    self.vclickHandler();

        /*$('.toolbarButton').trigger({
            type: 'toolbarButtonPressed',
            message: self.id,
            time: new Date()
        });*/
        gui.events.emit('toolbarButtonPressed', [{id: self.id}]);
        gui.currentPressedToolbarButton = self;
    });
    this.toolbarButtonPressedHandler = null;
    this.setButtonPressedHandler = function (handler) {
        self.toolbarButtonPressedHandler = handler;
    };
    //this.button.on('toolbarButtonPressed', function (evt) {
    gui.events.on('toolbarButtonPressed', function(evt) {
        if (evt.id !== self.id) {
            self.button.removeClass('toolbarButtonPressed');
        }
        if (self.toolbarButtonPressedHandler)
            self.toolbarButtonPressedHandler(evt.id);
    });
    this.vclickHandler;
    this.setVClickHandler = function (handler) {
        self.vclickHandler = handler;
    };
    this.destroy = function () {
        self.button.unbind('vclick');
        self.button.off('toolbarButtonPressed');
        self.button.remove();
    };
};

gui.AlarmBarButton = function(text, icon, container, extraStyle, iconOnTap) {
    gui.Button.call(this, null, icon);
    var self = this;
    this.title = text;
    if (extraStyle) {
        this.button.css(extraStyle);
    }
    this.button.appendTo(container);

    if (iconOnTap) {
        this.iconOnTap = gui.iconPath + iconOnTap;
        this.icon.bind('touchstart mousedown', function() {
            this.src = self.iconOnTap;
        });
    }
    this.icon.bind('touchend mouseup', function() {
        this.src = self.icon;
    });

    this.setAlarm = function(alarm) {
        if (alarm)
            self.icon.addClass('animation');
        else
            self.icon.removeClass('animation');
    };

    this.button.bind('vclick', function(evt) {
        evt.preventDefault();
        if (self.vclickHandler)
            self.vclickHandler();
    });

    this.vclickHandler = null;
    this.setVClickHandler = function(handler) {
        self.vclickHandler = handler;
    };
    this.destroy = function () {
        self.button.unbind('vclick');
        self.button.remove();
    };
};

dfu.IndoorLocationSensor = function (id, dfuId) {
    console.log('IndoorLocationSensor', id, dfuId);
    var self = this;
    this.dfuId = dfuId;
    this.id = id;
    this.icon = $('<div/>', {
        class: 'indoorLocationIcon'
    });
    this.left = 0;
    this.top = 0;
    this.icon.css('display', 'block');
    this.ratio = dfu.dfuList.getDfu(dfuId).bgScrRatio;
    this.icon.appendTo($('#floorplan'));
    this.updateIcon = function(left, top, color) {
        if (left && top) {
            self.left = left;
            self.top = top;
            self.icon.css('display', 'block');
        } else {
            self.ratio = dfu.dfuList.getDfu(dfu.currentDfuId).bgScrRatio;
            left = self.left;
            top = self.top;
        }

        left = left * self.ratio;
        top = top * self.ratio;
        self.icon.css('left', left);
        self.icon.css('top', top);
        if (color === '0') {
            self.icon.css('background-color', 'red');
        } else if (color === '1')
            self.icon.css('background-color', 'cyan');
    };
    this.dataHandler = function(value) {
        if (!value || !value.response || !value.response.Interaction || !value.response.Interaction.Data.Sensors.Sensor)
            return;

        for (var i = 0; i < value.response.Interaction.Data.Sensors.Sensor.length; i++) {
            var sensor = value.response.Interaction.Data.Sensors.Sensor[i];
            if (sensor.SensorId != self.id)
                continue;
            if (!sensor.Channel)
                continue;

            self.updateIcon(sensor.Channel[0].Value, sensor.Channel[1].Value, sensor.Channel[3].Value);
            return;
        }
        self.icon.css('display', 'none');
    };
    gui.events.on('live_sensor', this.dataHandler);
    this.destroy = function () {
        gui.events.un('live_sensor', self.dataHandler);
        self.icon.remove();
    };
};

gui.IndoorLocationSensorCreator = function() {
    var self = this;
    this.sensors = [];
    this.hasSensor = function(id) {
        for (var j=0; j<self.sensors.length; j++) {
            if (self.sensors[j].id == id)
                return true;
        }
        return false;
    };
    this.dataHandler = function(value) {
        if (!value || !value.response || !value.response.Interaction || value.response.Interaction.OperationType === 'fail' || !value.response.Interaction.Sensors || !value.response.Interaction.Sensors.Sensor)
            return;

        for (var i=0; i<value.response.Interaction.Sensors.Sensor.length; i++) {
            var sensor = value.response.Interaction.Sensors.Sensor[i];
            if (sensor.SensorId < 7100 || sensor.SensorId >= 7200)
                continue;

            if (!self.hasSensor(sensor.SensorId)) {
                var newSensor = new dfu.IndoorLocationSensor(sensor.SensorId, dfu.currentDfuId);
                newSensor.updateIcon(sensor.Channel[0].Value, sensor.Channel[1].Value, sensor.Channel[3].Value);
                self.sensors.push(newSensor);
            }
        }
    };
    this.layout = function() {
        self.sensors.forEach(function(sensor) {
            sensor.updateIcon();
        });
    };
    gui.events.on('live_sensor', this.dataHandler);
    this.destroy = function () {
        gui.events.un('live_sensor', self.dataHandler);
        while (self.sensors.length) {
            var d = self.sensors.pop();
            if (d) {
                d.destroy();
                delete d;
            }
        }
    };
};

// initialization
$(document).ready(function (){
    gui.OnScreenDataSensor.prototype = Object.create(gui.OnScreenSensor);
    gui.OnScreenDataSensor.prototype.constructor = gui.OnScreenDataSensor;
    gui.VideoSensor.prototype = Object.create(gui.OnScreenSensor);
    gui.VideoSensor.prototype.constructor = gui.VideoSensor;
    gui.OnScreenVideoSensor.prototype = Object.create(gui.VideoSensor);
    gui.OnScreenVideoSensor.prototype.constructor = gui.OnScreenVideoSensor;
    gui.OnScreenAlarmSensor.prototype = Object.create(gui.OnScreenSensor);
    gui.OnScreenAlarmSensor.prototype.constructor = gui.OnScreenAlarmSensor;
    gui.ToolBarButton.prototype = Object.create(gui.Button);
    gui.ToolBarButton.prototype.constructor = gui.ToolBarButton;
    gui.AlarmBarButton.prototype = Object.create(gui.Button);
    gui.AlarmBarButton.prototype.constructor = gui.AlarmBarButton;

   gui.initSocket();
    gui.initChangePassword();
    gui.initAddReport();
    gui.initUI();
});

gui.initUI = function() {
    gui.events.on('socket_online', function() {
        if (!dfu.currentDfuId) {
            gui.initDfuList();
        } else {
            // TODO: There is no live sensor for now.
            //dfu.liveSensor.start();
        }

   }); 
   gui.events.on('socket_offline', function() {
        dfu.liveSensor.stop();
        $('#menuButton').removeClass('menuButtonOnline');
    });
 
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
            resultDate = null;
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

    gui.events.on('videoNavChanged', function(value) {
        if (value.divId !== 'floorplan') {
            $('#floorplan').addClass('hidden');
        } else {
            $('#floorplan').removeClass('hidden');
        }
    });
    
    gui.layout();

    $('#menu').on('click', function(evt) {
        $('#menu').popup('close');
    });
    $('#menuButton').on('click', function(evt) {
        var pos = $('#pageContainer').offset();
        $('#menu').popup('open', {x: pos.left + 105, y: pos.top});
    });

    var menuButtons = $('#menuButtons');
    var switchDfu = $('<li><a href="#switchDfu" data-rel="popup" data-position-to="#pageContainer">Switch Site</a></li>');
    switchDfu.on('click', $.mobile.switchPopup.bind(this, 'menu', 'switchDfu'));
    //switchDfu.buttonMarkup();
    menuButtons.append(switchDfu);
    if (gui.hasPermission('publish_comments')) {
        var addReport = $('<li><a href="#addReport" data-rel="popup" data-position-to="#pageContainer">Add Report</a></li>');
        //addReport.buttonMarkup();
        addReport.on('click', $.mobile.switchPopup.bind(this, 'menu', 'addReport'));
        menuButtons.append(addReport);
    }
    if (gui.hasPermission('access_admin')) {
        var admin = $('<li><a href="/admin/admin.html" target="_blank">Admin</a></li>');
        //admin.buttonMarkup();
        menuButtons.append(admin);
    }

    var changePassword = $('<li><a href="#changePassword" data-rel="popup" data-position-to="#pageContainer">Change Password</a></li>');
    changePassword.on('click', $.mobile.switchPopup.bind(this, 'menu', 'changePassword'));
    menuButtons.append(changePassword);

    var logout = $('<li><a href="#">Logout</a></li>');
    logout.on('vclick', function() {
        setTimeout(function() {
            window.location.replace('http://' + window.location.host + '/api/v1/auth/logout');
        }, 300);
            
    });
    menuButtons.append(logout);

    var hideMenu = $('<li><a href="#" data-rel="close">Hide Menu</a></li>');
    //hideMenu.buttonMarkup();
    menuButtons.append(hideMenu);
    setTimeout(function() {
        menuButtons.listview('refresh');
    }, 0);

    $(window).on('orientationchange', function() {
        setTimeout(function () {
            gui.layout();
            gui.events.emit('layout');
        }, 1000);
    });

    gui.events.on('switch_dfu', gui.initSummaryTab);
};

gui.initSummaryTab = function() {
    gui.updateMotion = function(value) {
        if (value !== undefined && value instanceof Array) {
            var str = '';
            for(var i=0;i<value.length;i++) str+=value[i]+' ';
            //console.log('value.length =', value.length, str);
        
            value = value.length > totalPoints ? value.slice(value.length - totalPoints) : value;
            var totalNumOfData = data.length + value.length;
            if (value.length >= totalPoints) {
                data = value;
            } else if (totalNumOfData <= totalPoints) {
                data = data.concat(value);
            } else {
                data = data.slice(Math.abs(totalNumOfData - totalPoints));
                data = data.concat(value);
            }
            //data.push(2*(value+Math.random()*10-3));
        }
        //console.log('gui.updateMotion', data[data.length-1], data.length);
        var res = [];
        for (var i=0; i<data.length; ++i) {
            res.push([i, data[i]]);
        }
        //console.log(res);
        gui.motionPlot.setData([res]);
        gui.motionPlot.draw();
    };
    var data = [],
        totalPoints = 100,
        updateInterval = 300,
        updateTimeoutId;
   var statusTicks = [[0, 'Overall Status']],
        statusDataSet = [{ label: "Overall Status", data: [[80, 0]], color: "#E8E800" }];
    var statusOptions = {
        legend: { show: false },
        series: { bars: { show: true } },
        bars: {
            align: 'center',
            barWidth: 0.5,
            horizontal: true,
            fillColor: {colors:[{opacity: 0.5}, {opacity: 1}]},
            lineWidth: 1
        },
        xaxis: {
            max: 100,
            min: 0,
            color: 'black'
        },
        yaxis: {
            show: false
        },
        grid: {
            backgroundColor: {colors: ["#171717", "#4F4F4F"]}
        }
    };
    var bringUpDetailInfo = function() {
        $('html, body').animate({
            scrollTop: $("#detailInfo").offset().top
        }, 1000);
    };
    var summaryDiv = $('<div/>', {
        class: 'tabDiv hidden',
        style: 'border: #bbb solid 1px;'
    });
    var motionDiv = $('<div/>', {
        class: 'summaryGrid',
        id: 'motion',
        style: 'border-bottom: #bbb solid 1px;'
    });
    motionDiv.on('vclick', function() {
        gui.historyButton.button.trigger('vclick');
        bringUpDetailInfo();
    });
    var statusDiv = $('<div/>', {
        class: 'summaryGrid',
        id: 'status'
    });
    statusDiv.on('vclick', function() {
        gui.statusButton.button.trigger('vclick');
        bringUpDetailInfo();
    });
    var commentDiv = $('<div/>', {
        class: 'summaryGrid',
        style: 'overflow: hidden; border-top: #bbb solid 1px;'
    });
    commentDiv.on('vclick', function() {
        gui.reportButton.button.trigger('vclick');
        bringUpDetailInfo();
    });
    gui.getReportData(commentDiv, 1);
    motionDiv.appendTo(summaryDiv);
    statusDiv.appendTo(summaryDiv);
    commentDiv.appendTo(summaryDiv);
    commentDiv.append($('<div class="summaryChartName">Last Comment</div>'));
    summaryDiv.appendTo('#videoDivContainer');
    var updateCanvas = function() {
        gui.motionPlot = $.plot('#motion', [[[]]], {
            series: {
                shadowSize: 0
            },
            yaxis: {
                min: 0,
                max: 100,
                tickFormatter: function(v, yaxis) { return ''; }
            },
            xaxis: {
                show: false,
                min: 0,
                max: totalPoints
            },
            grid: {
                show: true,
                borderWidth: { top: 0, left: 0, bottom: 0, right: 0 }
            }
        });
        gui.updateMotion();
        $.plot('#status', statusDataSet, statusOptions);
        motionDiv.append($('<div class="summaryChartName">Real Time Motion</div>'));
        statusDiv.append($('<div class="summaryChartName">Overall Status</div>'));
    };
    var videoNavHandler = function (value) {
        console.log(value);
        if (value.divId === 'summary') {
            summaryDiv.removeClass('hidden');
            updateCanvas();
        } else {
            summaryDiv.addClass('hidden');
            //stop();
        }
    };
    gui.events.on('videoNavChanged', videoNavHandler);
    gui.events.on('layout', updateCanvas);
};

gui.initFlashlightAndBeepButtons = function(container) {
    if (gui.FlashlightAndBeepButtonsInitialized) {
        return;
    }
    gui.FlashlightAndBeepButtonsInitialized = true;
    // Add flashlight button
    var extraStyle = {position: 'absolute', right: '5px', top: '5px', 'background-color': 'white', 'z-index': 10};
    var flashlightButton = new gui.AlarmBarButton('flashlight', 'flashlight-bright.png', container, extraStyle);
    flashlightButton.setVClickHandler(function () {
        socket.emit('dfu_request', new dfu.Request('command', 'set_flash', dfu.currentDfuId));
        this.setAlarm(true);
        setTimeout(function() {
            flashlightButton.setAlarm(false)
        }, 800);
    });

    // Add beep button
    extraStyle.right = '55px';
    var beepButton = new gui.AlarmBarButton('beep', 'beep.png', container, extraStyle);
    beepButton.setVClickHandler(function () {
        socket.emit('dfu_request', new dfu.Request('command', 'set_beep', dfu.currentDfuId));
        this.setAlarm(true);
        setTimeout(function() {
            beepButton.setAlarm(false)
        }, 800);
    });
};

gui.initDfuList = function() {
    if (!socket) {
        return;
    }

    socket.emit('dfu_request', new dfu.Request('query', 'list'));
    gui.events.on('list', function(value) {
        var siteList = [];
        if (!value.response.Interaction || !value.response.Interaction.Data || !value.response.Interaction.Data.Site || !value.response.Interaction.Data.Site.length) {
            if (!value.response.Interaction.Data.Site) {
                console.error('Failed on getting dfu list.');
                gui.toast('Failed on getting dfu list, please try again later.');
                return false;
            }
            siteList.push(value.response.Interaction.Data.Site);
        } else {
            siteList = value.response.Interaction.Data.Site;
        }
        var dfulist_ui = $('#dfulist');
        for (var i=0; i<siteList.length; i++) {
            var item = $('<li><a href="#">ID: ' + siteList[i].DfuId + ' Name: ' + siteList[i].Name + '</a></li>');
            item[0].dfuId = siteList[i].DfuId;
            item[0].dfuName = siteList[i].Name;
            item.on('tap', function(evt) {
                $("#switchDfu").popup("close");
                addOrUpdateDfuSite(this.dfuId, this.dfuName);
            });
            if (!gui.hasPermission('dfu' + siteList[i].DfuId)) {
                item.addClass('ui-state-disabled');
            }
            dfulist_ui.append(item);
        }
        dfulist_ui.listview('refresh');
        if (siteList.length == 1) {
            setTimeout(function () {
                addOrUpdateDfuSite(siteList[0].DfuId, siteList[0].Name);
            }, 0);
        } else {
            $("#switchDfu").popup("option", "dismissible", false);
            $("#switchDfu").popup("open");
        }
    });
};

function addOrUpdateDfuSite(id, name) {
    var newSite;
    console.log(id, name);
    if (!gui.hasPermission('dfu' + id)) {
        return;
    }

    if (!dfu.dfuList.containsId(id)) {
        var newSite = new dfu.data(id, name);
        dfu.dfuList.list.push(newSite);
    } else {
        //newSite = dfu.dfuList.getDfu(id);
        switchCurrentDfu(id);
        return;
    }

    $.mobile.loading('show');
    var hideLoading = function() {
        $.mobile.loading('hide');
    };
    gui.events.on('first_video_frame_arrived', hideLoading);
    gui.events.on('live_video_denied', hideLoading);
    gui.events.on('switch_dfu', hideLoading);
    //**************** getSystem **************
    socket.emit('dfu_request', new dfu.Request('query', 'system', id));
    gui.events.on('system', function(value) {
        if (!value.response || value.response.Interaction.OperationType === 'fail' || value.response.Interaction.DfuId != id) {
            gui.toast('Failed to get site system information, Please refresh later.', 5000);
            return;
        }
        var site = dfu.dfuList.getDfu(value.response.Interaction.DfuId);
        if (site) {
            site.system = value.response.Interaction.Data.System;
        }
    });

    //**************** getConfig **************
    setTimeout(function() {
        socket.emit('dfu_request', new dfu.Request('query', 'config', id));
    }, 3000);
    gui.events.on('config', function(value) {
        if (!value.response || value.response.Interaction.OperationType === 'fail' || value.response.Interaction.DfuId != id) {
            return;
        }
        var site = dfu.dfuList.getDfu(value.response.Interaction.DfuId);
        if (site) {
            site.config = value.response.Interaction.Data;
            switchCurrentDfu(id);
        }
    });
    //**************** getBackground **************
    socket.emit('dfu_request', new dfu.Request('query', 'background', id));
    gui.events.on('background', function(value) {
        if (!value.response || value.response.Interaction.OperationType === 'fail' || value.response.Interaction.DfuId != id) {
            return;
        }
        var site = dfu.dfuList.getDfu(value.response.Interaction.DfuId);
        site.backgroundImage = value.imageData;
        updateFloorplanBackground();
    });
}

function updateFloorplanBackground() {
    if (!dfu.currentDfuId)
        return;

    var site = dfu.dfuList.getDfu(dfu.currentDfuId);
    if (!site || !site.backgroundImage)
        return;

     $('#floorplan')[0].style.backgroundImage = 'url(' + site.backgroundImage + ')';
}

gui.initializeHistoryButton = function() {
    if (gui.historyButton || !gui.hasPermission('history')) {
        return;
    }

    gui.historyButton = new gui.ToolBarButton('History', 'history.png', $('#toolbar'));
    gui.historyButton.historyOptionsDiv = $('<div/>', {
    	id: 'historyOptionsDiv'
    });
    var title = $('<p class="toolBarDetailsTitle">View history</p>');
    title.appendTo(gui.historyButton.historyOptionsDiv);
    var generateData = function (num) {
        var obj = {};
        obj.bar = [];
        obj.line = [];
        for (var i = 0; i < num; i++) {
	        obj.line.push([i, Math.random() * 30]);
            obj.bar.push([i, Math.random() * 10]);
        }
        return obj;
    };
    var currentData = {},
        currentRequestType, // day, week, month
        currentRequestData; // date, week of the year, month

    var optionsListCreated = false;
    var getData = function(requestType, requestData, callback) {
        currentRequestType = requestType;
        currentRequestData = requestData;
        switch (requestType) {
        case 'day':
            callback(generateData(24));
            break;
        case 'week':
            callback(generateData(7));
            break;
        case 'month':
            callback(generateData(31));
            break;
        }
    };
    var createHistoryOptionsList = function() {
        gui.historyButton.historyOptionsDiv.append('<ul id="historyOptionsList" data-role="listview" data-inset="true"></ul>');
        $('#historyOptionsDiv').trigger('create');

        var historyOptionsList = $('#historyOptionsList');

        var historyOptionClickHandler = function(title, requestType, requestData) {
            //detailInfo.empty();
            //detailInfo.append(gui.historyButton.historyDiv);
            gui.historyButton.historyOptionsDiv.addClass('hidden');
            gui.historyButton.historyDiv.removeClass('hidden');
            //$('#historyDivTitle').text(title);
            getData(requestType, requestData, renderData);
        };
        var last24hr = $('<li><a href=#>Last 24 hours</a></li>');
        last24hr.on('click', historyOptionClickHandler.bind(this, 'History for last 24 hours', 'day', 'last24'));
        historyOptionsList.append(last24hr);

        var lastweek = $('<li><a href=#>Last week</a></li>');
        lastweek.on('click', historyOptionClickHandler.bind(this, 'History for last week', 'week', 'lastWeek'));
        historyOptionsList.append(lastweek);

        var lastmonth = $('<li><a href=#>Last month</a></li>');
        lastmonth.on('click', historyOptionClickHandler.bind(this, 'History for last month', 'month', 'lastMonth'));
        historyOptionsList.append(lastmonth);

        var nextweek = $('<li><a href=#>Next week</a></li>');
        nextweek.on('click', historyOptionClickHandler.bind(this, 'History for next week', 'week', 'nextWeek'));
        historyOptionsList.append(nextweek);

        historyOptionsList.listview('refresh');
        historyOptionsList.appendTo(gui.historyButton.historyOptionsDiv);
    };
    
    gui.historyButton.historyOptionsDiv.addClass('hidden');
    gui.historyButton.historyOptionsDiv.appendTo($('#detailInfo'));
    
    gui.historyButton.historyDiv = $('<div/>', {
	id: 'historyDiv',
        class: 'historyDiv hidden'
    });
    gui.historyButton.historyDiv.append($('<div/>', {
        id: 'historyDivTitle',
        style: 'height:50px; text-align:center; display:table-row; font-size:x-large'
    }));
    gui.historyButton.historyDiv.append($('<div id="historyDivContent" style="display:table-row"><div id="historyDivCanvas" style="display:table-cell"></div></div>'));
    gui.historyButton.historyDiv.appendTo($('#detailInfo'));
    var renderData = function(data) {
        currentData = data;
        // generate title
        $('#historyDivTitle').text('History for ' + currentRequestType + ' of ' + currentRequestData);
 
        initCanvas();
    };
    var calculateNextDate = function(next) {
        var today = new Date();
        today.setHours(0,0,0,0);
        console.log(today);
        switch (currentRequestType) {
        case 'day':
            currentRequestData = currentRequestData === 'last24' ? currentRequestData : new Date(currentRequestData);
            if (next) {
                if (currentRequestData === 'last24' || currentRequestData.toString() === today.toString()) {
                    return null;
                } else {
                    return currentRequestData.addDays(1);
                }
            } else {
                if (currentRequestData === 'last24') {
                    return today.addDays(-1);
                } else {
                    return currentRequestData.addDays(-1);
                }
            }
        case 'week':
            currentRequestData = currentRequestData === 'lastWeek' ? currentRequestData : new Date(currentRequestData);
            if (next) {
                if (currentRequestData === 'lastWeek' || currentRequestData.toString() === today.toString()) {
                    return null;
                } else {
                    return currentRequestData.addDays(7);
                }
            } else {
                if (currentRequestData === 'lastWeek') {
                    return today.addDays(-7);
                } else {
                    return currentRequestData.addDays(-7);
                }
            }
        case 'month':
            currentRequestData = currentRequestData === 'lastMonth' ? currentRequestData : new Date(currentRequestData);
            if (next) {
                if (currentRequestData === 'lastMonth' || currentRequestData.toString() === today.toString()) {
                    return null;
                } else {
                    return new Date(currentRequestData.setMonth(currentRequestData.getMonth() + 1));
                }
            } else {
                if (currentRequestData === 'lastMonth') {
                    return today.setMonth(today.getMonth() - 1);
                } else {
                    return new Date(currentRequestData.setMonth(currentRequestData.getMonth() - 1));
                }
            }
        }

    };

    var placeholder, plot, plotTouchendHandler;
    var initCanvas = function() {
        if (!plotTouchendHandler) {
        plotTouchendHandler = function(evt, plot, relativeOffset) {
            console.log('relativeOffset', relativeOffset);
            var width = placeholder.width();
            if (Math.abs(relativeOffset.x) < width/2) {
                // only change data when swipe over half of graph width
                return;
            }
            var newDate = calculateNextDate(relativeOffset.x > 0);
            if (newDate) {
                currentRequestData = newDate;
                setTimeout(getData(currentRequestType, currentRequestData, renderData), 0);
            } else {
                // do nothing because invalid new date.
            }
        };
        }
        // Chrome on android crashes without initCanvas when drawing new data
        if (placeholder && plot) {
            plot.shutdown();
            placeholder.unbind('plottouchend', plotTouchendHandler);
        }
        placeholder = $('#historyDivCanvas'),
        plot = $.plot(placeholder, [{
            label: 'Motion',
	        data: currentData.line,
            lines: { show: true, fill: false }
	    }, {
	        label: 'Enter/Exit',
            data: currentData.bar,
	        bars: { show: true }
            }],
        {
            xaxis: {
	            position: 'bottom',
	            tickDecimals: 0,
        },
            touch: {
                pan: 'x',
                bounceBack: true
            }
	    });
        placeholder.bind('plottouchend', plotTouchendHandler);
    };
    var draw = function() {
        initCanvas();
        plot.setData([{
            label: 'Motion',
	        data: currentData.line,
            lines: { show: true, fill: false }
        }, {
	        label: 'Enter/Exit',
            data: currentData.bar,
	        bars: { show: true }
        }]);
        plot.setupGrid();
        plot.draw();
    };
    gui.events.on('layout', function() {
        if (gui.historyButton.historyDiv.is(':visible')) {
            initCanvas();
        }
    });

    gui.historyButton.setButtonPressedHandler(function (message) {
        //var detailInfo = $('#detailInfo');
        //detailInfo.empty();
        //detailInfo.append(gui.historyButton.historyOptionsDiv);
        if (message !== gui.historyButton.id) {
            gui.historyButton.historyOptionsDiv.addClass('hidden');
            gui.historyButton.historyDiv.addClass('hidden');
            if (!optionsListCreated) {
                createHistoryOptionsList();
                optionsListCreated = true;
            }
        } else {
            gui.historyButton.historyOptionsDiv.removeClass('hidden');
            gui.historyButton.historyDiv.addClass('hidden');
        }
    });
};

gui.initializeReportButton = function() {
    if (gui.reportButton || !gui.hasPermission('reports')) {
        return;
    }

    gui.reportButton = new gui.ToolBarButton('Report', 'report.png', $('#toolbar'));
    gui.reportButton.reportDiv = $('<div/>', {
        class: 'reportDiv',
        id: 'reportDiv'
    });
    var title = $('<p class="toolBarDetailsTitle">Daily Reports</p>');
    title.appendTo(gui.reportButton.reportDiv);

    var extraStyle = {position: 'absolute', right: '2px', top: '5px'};
    var writeIcon = new gui.AlarmBarButton('writecomment', 'write_comment.png', gui.reportButton.reportDiv, extraStyle);
    writeIcon.setVClickHandler(function(evt) {
        $("#addReport").popup("open");
    });

    extraStyle = {position: 'absolute', right: '50px', top: '5px'};
    var getDateRange = new gui.AlarmBarButton('getDateRange', 'history.png', gui.reportButton.reportDiv, extraStyle);
    getDateRange.setVClickHandler(function(evt) {
        $("#reportDateRange").popup("open");
    });

    var newSite = dfu.dfuList.getDfu(dfu.currentDfuId);
    gui.reportButton.siteName = $('<h3>' + newSite.system.Site.Name + '</h3>').css('text-align', 'center');
    gui.reportButton.siteName.appendTo(gui.reportButton.reportDiv);
    gui.reportButton.updateName = function(name) {
        gui.reportButton.siteName.text(name);
    };
    var desc = $('<p>The information below is the data entered on a daily basis. It may seem technical at times.</p>');
    desc.appendTo(gui.reportButton.reportDiv);
    gui.reportButton.hr = $('<hr width="100%">');
    gui.reportButton.reportDiv.append(gui.reportButton.hr);
    gui.reportButton.reportContentDiv = $('<div/>', {
        class: 'reportDiv',
        id: 'reportContentDiv'
    });
    gui.reportButton.reportDiv.append(gui.reportButton.reportContentDiv);
    gui.reportButton.refresh = function() {
        gui.reportButton.reportContentDiv.empty();
        gui.getReportData(gui.reportButton.reportContentDiv);
    };
    gui.reportButton.reportDiv.addClass('hidden');
    gui.reportButton.reportDiv.appendTo($('#detailInfo'));
    gui.reportButton.setButtonPressedHandler(function (message) {
        //var detailInfo = $('#detailInfo');
        //detailInfo.empty();
        //detailInfo.append(gui.reportButton.reportDiv);
        if (message === gui.reportButton.id) {
            gui.reportButton.reportDiv.removeClass('hidden');
            gui.reportButton.reportContentDiv.empty();
            gui.getReportData(gui.reportButton.reportContentDiv);
        } else {
            gui.reportButton.reportDiv.addClass('hidden');
        }
    });
    gui.events.on('report_submitted', function() {
        gui.reportButton.refresh();
    });
};

gui.initializeStatusButton = function() {
    if (gui.statusButton || !gui.hasPermission('status')) {
        return;
    }
/*
    // statusButton
    gui.statusButton = new gui.ToolBarButton('Status', 'status.png', $('#toolbar'));
    gui.statusButton.canvasDiv = $('<div/>', { class: 'statusCanvasDiv', id: 'statusCanvas' });
    gui.statusButton.canvasDiv.addClass('hidden');
    gui.statusButton.canvasDiv.appendTo($('#detailInfo'));
    gui.statusButton.setButtonPressedHandler(function (message) {
        //var detailInfo = $('#detailInfo');
        //detailInfo.empty();
        //detailInfo.append(gui.statusButton.canvasDiv);
        if (message === gui.statusButton.id) {
            gui.statusButton.canvasDiv.removeClass('hidden');
            gui.statusButton.canvasDiv.empty();
            var dataName = [ "Activity", "Comfortable", "Medicine", "Normal Living" ];
            var barColor = ['blue', 'red', 'green', 'cyan'];
            var dataValue = [ 80, 50, 65, 70 ];
            gui.drawBarChart(dataName, barColor, dataValue, 'statusCanvas');
        } else {
            gui.statusButton.canvasDiv.addClass('hidden');
        }
    });
*/
    gui.statusButton = new gui.ToolBarButton('Config', 'config.png', $('#toolbar'));
    var optionsDiv = $('<div/>', {class: 'statusOptionsDiv', id: 'statusOptions'});
    optionsDiv.addClass('hidden');
    optionsDiv.appendTo($('#detailInfo'));
    optionsDiv.append($('<p class="toolBarDetailsTitle">Alarm Options</p>'));
    optionsDiv.append($('<div style="position:absolute;top:5px;right:5px;"><a href="#" data-role="button" data-mini="true" data-theme="c" data-inline="true" id="alarmOptionsSave">Apply</a></div>')).trigger('create');
    optionsDiv.append('<form action="" id="alarmOptionsForm"></form>');
    var form = $('#alarmOptionsForm');
    form.append($('<p><li>Choose Alarm Period:</li></p>'));
    var alarmPeriod = $('<div id="optionsDetail" style="width: 100%; margin:5px;"></div>');
    form.append(alarmPeriod);

    var html = '<fieldset id="alarmPeriodContainer" data-role="controlgroup" data-type="horizontal" data-mini="true" data-line="false">';
    html += '<input type="radio" name="alarmPeriod" id="alarmPeriodHour" checked><label class="textAlignCenter" for="alarmPeriodHour">Hour</label>';
    html += '<input type="radio" name="alarmPeriod" id="alarmPeriodDay"><label class="textAlignCenter" for="alarmPeriodDay">Day</label>';
    html += '<input type="radio" name="alarmPeriod" id="alarmPeriodWeek"><label class="textAlignCenter" for="alarmPeriodWeek">Week</label>';
    html += '<input type="radio" name="alarmPeriod" id="alarmPeriodMonth"><label class="textAlignCenter" for="alarmPeriodMonth">Month</label>';
    html += '</fieldset>';
    alarmPeriod.html(html);
    alarmPeriod.trigger('create');

    form.append('<p><li>Set alarm borders(drag handle on the right to change border):</li></p>');
    $('#alarmPeriodContainer .ui-controlgroup-controls').addClass('fullWidth');
    $('#alarmPeriodContainer .ui-radio').addClass('alarmPeriodOptionWidth');

    form.append($('<div id="chartSweepView" style="width: calc(100%-40px); height:200px; padding-left: 20px; padding-right: 20px"></div>'));
    setTimeout(function() {
        gui.drawChartSweepView('chartSweepView', 40, 80);
    }, 0);

    form.append($('<p><li>Set alarm options:</li></p>'));
    var alarmOptions = $('<div id="alarmOptions" style="100%; margin:5px;"></div>');
    form.append(alarmOptions);
    html = 'Send alarm when activies percentage falls into the area of ';
    html += '<fieldset id="alarmOptionsContainer" data-role="controlgroup" data-mini="true" data-line="false">';
    html += '<input type="checkbox" name="alarmOption" id="alarmOptionRed" checked><label class="textAlignCenter" for="alarmOptionRed">Red</label>';
    html += '<input type="checkbox" name="alarmOption" id="alarmOptionYellow"><label class="textAlignCenter" for="alarmOptionYellow">Yellow</label>';
    html += '<input type="checkbox" name="alarmOption" id="alarmOptionGreen"><label class="textAlignCenter" for="alarmOptionGreen">Green</label>';
    html += '</fieldset>';
    alarmOptions.html(html);
    alarmOptions.trigger('create');



    gui.statusButton.setButtonPressedHandler(function(message) {
        if (message === gui.statusButton.id) {
            optionsDiv.removeClass('hidden');
        } else {
            optionsDiv.addClass('hidden');
        }
    });
}

gui.layout = function() {
    console.log('document.documentElement.clientHeight', document.documentElement.clientHeight);
    if (!dfu.currentDfuId)
        return;

    var site = dfu.dfuList.getDfu(dfu.currentDfuId);
    if (!site)
        return;

    var floorplan = $('#floorplan'),
        videoDiv = $('#videoDivContainer');
    var backgroundImageHeight = site.system.Site.SiteHeight,
        backgroundImageWidth = site.system.Site.SiteWidth;
    if (site.backgroundImageHeight >= backgroundImageWidth) {
        floorplan.height(floorplan.width());
        videoDiv.height(videoDiv.width());
        var bgWidth = floorplan.height() * backgroundImageWidth / backgroundImageHeight;
        floorplan[0].style.backgroundSize = bgWidth + 'px';
    } else {
        var h = Math.max(floorplan.width(), videoDiv.width()) * (backgroundImageHeight / backgroundImageWidth);
        floorplan.height(h);
        videoDiv.height(h);
        floorplan[0].style.backgroundSize = '100%';
    }
    site.bgScrRatio = floorplan.height() / backgroundImageHeight;

    floorplan[0].style.backgroundRepeat = 'no-repeat';

    var detailInfo = $('#detailInfo');
    detailInfo.height(detailInfo.width());
    /*
    if (screen.width > screen.height) {
        detailInfo.height(detailInfo.width());
    } else {
        var availableHeight = document.documentElement.clientHeight - $('#toolbar').height() - floorplan.height() - detailInfo.height() - $('#title-bar').height() - 10;
        if (availableHeight > detailInfo.width() / 2)
            detailInfo.height(availableHeight);
        else
            detailInfo.height(detailInfo.width());
    }
    */
    detailInfo.css('border', '1px solid');

    // TODO: gui.indoor should listen to 'layout' event
    if (gui.indoor) {
        gui.indoor.layout();
    }
    // TODO: status canvas should listen to 'layout' event and redraw
    if (gui.currentPressedToolbarButton && gui.currentPressedToolbarButton == gui.statusButton) {
        gui.statusButton.button.click();
    }
};

function switchCurrentDfu(id) {
    var oldDfuId = dfu.currentDfuId;
    if (!id)
        id = dfu.currentDfuId;
    else
        dfu.currentDfuId = id;

    var newSite = dfu.dfuList.getDfu(id);
    if (!newSite)
        return;

    // Cleanup
    if (oldDfuId) {
        dfu.liveSensor.stop();
        gui.indoor.destroy();
        delete gui.indoor;
        gui.indoor = null;
        while (dfu.onScreenSensorList.length) {
            var d = dfu.onScreenSensorList.pop();
            if (d) {
                d.destroy();
                delete d;
            }
        }
    }

    gui.layout();

    if (!newSite.config || !newSite.config.Medias || !newSite.config.Medias.StreamGroup  || !(newSite.config.Medias.StreamGroup instanceof Array))
        return;

    gui.initializeReportButton();
    gui.initializeStatusButton();
    gui.initializeHistoryButton();

    for (var i=0; i<newSite.config.Medias.StreamGroup.length; i++) {
        var stream = newSite.config.Medias.StreamGroup[i].Stream;
        if (stream instanceof Array) {
            for (var j=0; j<stream.length; j++) {
                createSensor(stream[j]);
            }
        } else {
            createSensor(stream);
        }
    }

    // Init 'videoNav' tab bar
    $('input[name=videoNav]:radio').bind('change', function(event, ui) {
        console.log($(this).val());
        var currentDivId = $(this).val();
        gui.events.emit('videoNavChanged', [{divId: currentDivId}]);
    });
    gui.events.on('switch_dfu', function() {
        // Highlight the 1st tab
        var t1 = $('#videoNavGroup input[type=radio]')[0];
        $(t1).prop('checked', true).checkboxradio('refresh');
        $('#videoNavGroup').enhanceWithin().controlgroup('refresh');
        gui.events.emit('videoNavChanged', [{divId: $(t1).val()}]);
    });
    
    gui.currentPressedToolbarButton = null;
    if (gui.statusButton) {
        $(gui.statusButton.button).click();
    }

    if (gui.hasPermission('indoor')) {
        gui.indoor = new gui.IndoorLocationSensorCreator();
    }

    //dfu.liveSensor.start(dfu.currentDfuId);

    // Single quotation mark would render correctly in this way
    $('#dfuName').html('Site: ' + newSite.name);
    gui.reportButton.updateName(newSite.name);

    // get saved alarms
    socket.emit('dfu_saved_alarm', {dfuId: dfu.currentDfuId});
    gui.events.emit('switch_dfu');
}

function createSensor(stream) {
    if (stream.ID >= 7200 && stream.ID < 7300) {
        dfu.onScreenSensorList.push(new gui.OnScreenAlarmSensor(stream.ID, dfu.currentDfuId));
    } else if (stream.ID == 7099) {
        dfu.onScreenSensorList.push(new gui.MotionSensor(stream.ID, dfu.currentDfuId));
    } else if (stream.Type == 'Video') {
        if (gui.hasPermission('videos')) {
            $('#videoNavGroup')
                .controlgroup('container')
                .append('<input type="radio" id="v' + stream.ID + '" name="videoNav" value="video' + stream.ID + '"/><label for="v' + stream.ID + '">' + stream.Label + '</label>');
            $('#videoNavGroup').enhanceWithin().controlgroup('refresh');
            dfu.onScreenSensorList.push(new gui.OnScreenVideoDiv(stream.ID, dfu.currentDfuId));
        }
    } else {
        /* We don't add any unknown sensor for now, need consts for new ones.
        if (gui.hasPermission('sensors')) {
            dfu.onScreenSensorList.push(new gui.OnScreenDataSensor(stream.ID, dfu.currentDfuId));
        }
        */
    }
}
