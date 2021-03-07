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

gui.videoRefreshTimeout = 1000;
gui.videoTimeoutInterval = 30000;
gui.buttonsInitialised = false;
gui.MAX_ICON_SIZE_MOBILE = 130;
gui.MAX_ICON_SIZE_DESK = 200;
gui.FUNC_BUTTON_SIZE_RATIO = 0.85;
dfu.motionTotalPoints = 100;
dfu.consts = {};
dfu.consts.VIDEO = {'Type': 'Video'};
dfu.consts.AUDIO = {'Type': 'Audio'};
dfu.consts.MOTION = {'Type': 'Sensor', 'Sensor': 'MOTION_SENSOR'};
dfu.consts.SOS = {'Type': 'Sensor', 'Sensor': 'HELP_EVENT'};
dfu.consts.FALL = {'Type': 'Sensor', 'Sensor': 'FALL_EVENT'};
dfu.consts.WANDER = {'Type': 'Sensor', 'Sensor': 'WANDER_EVENT'};
dfu.consts.ABNORMAL = {'Type': 'Sensor', 'Sensor': 'ABNORMAL_EVENT'};
dfu.findSensor = function(type) {
    for (var i=0; i<dfu.currentDfu.config.Medias[0].StreamGroup.length; i++) {
        var stream = dfu.currentDfu.config.Medias[0].StreamGroup[i].Stream;
        if (stream instanceof Array) {
            for (var j=0; j<stream.length; j++) {
                var found = true;
                for (var k in type) {
                    found &= stream[j].$[k] === type[k];
                }
                if (found) return stream[j].$;
            }
        } else {
            var found = true;
            for (var k in type) {
                found &= stream[k] === type[k];
            }
            if (found) return stream;
        }
    }
    return undefined;
};

gui.convertDataURIToBinary = function(dataURI) {
  var BASE64_MARKER = 'base64,';
  var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
  var base64 = dataURI.substring(base64Index);
  var raw = window.atob(base64);
  var rawLength = raw.length;
  var array = new Uint8Array(new ArrayBuffer(rawLength));

  for(i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
};

gui.iconPath = '/images/mobile/';
gui.Button = function(text, icon) {
    var self = this;
    this.button = $('<div/>', {
        class: 'button'
    });
    this.icon = $('<div></div>');
    this.img = $('<img src="' + gui.iconPath + icon + '" class="buttonIcon">');
    this.icon.append(this.img);
    this.icon.appendTo(this.button);
    this.title = text;
    this.textDiv = $('<div></div>');
    this.text = $('<span>' + text + '</span>');
    this.text.appendTo(this.textDiv);
    this.textDiv.appendTo(this.button);
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
gui.FootBarButton = function(text, icon, container) {
    gui.Button.call(this, text, icon);
    var self = this;
    this.id = text;
    this.button.addClass('footBarButton');
    this.icon.addClass('footBarButtonIcon');
    this.textDiv.addClass('footBarButtonText');
    this.button.appendTo(container);
};

gui.MainFunctionButton = function(text, icon, container) {
    gui.Button.call(this, text, icon);
    var self = this;
    //this.button.addClass('mainFunctionButton');
    //this.icon.addClass('mainFunctionButtonIcon');
    this.textDiv.addClass('mainFunctionButtonTextDiv');
    this.text.addClass('mainFunctionButtonText');

    this.setHeight = function(height) {
        self.button.css({'height': height});
        self.icon.css({'height': height-20});
        self.textDiv.css({'height': 20});
    };
    this.button.appendTo(container);
    this.setAlarm = function(alarm) {
        if (alarm)
            self.img.addClass('alarmAnimation');
        else
            self.img.removeClass('alarmAnimation');
    };
    this.streamId = -1;
    this.setStreamId = function(id) {
        self.streamId = id;
    };
    this.setDataType = function(type) {
        self.dataType = type;
    };
};

gui.FootBarButton.prototype = Object.create(gui.Button);
gui.FootBarButton.prototype.constructor = gui.FootBarButton;
gui.MainFunctionButton.prototype = Object.create(gui.Button);
gui.MainFunctionButton.prototype.constructor = gui.MainFunctionButton;

gui.firstLoad = true;
gui.audioCaptureInit = false;

if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/sw.js');
}

$(document).on('mobileinit', function() {
    $.mobile.ignoreContentEnabled = true;
});

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


$(document).ready(function() {
    $.mobile.orientationChangeEnabled = false;
    //gui.initSocket();
    gui.events.on('socket_online', function() {
        if (!dfu.currentDfu) {
            gui.initDfuList();
        } else {
            dfu.liveSensor.start(dfu.currentDfu.id);
        }
    });
    gui.events.on('socket_offline', function() {
        dfu.liveSensor.stop();
        //$('#menuButton').removeClass('menuButtonOnline');
    });
    gui.events.on('dfu_config_ready', function(value) {
        if (value.dfuId !== dfu.currentDfu.id) {
            return;
        }
        var siteName = $('#mainPageSiteName'),
            siteListButton = $('#mainPageSiteListButton');
        siteName.width('');
        $('#mainPageSiteName').html(dfu.currentDfu.name);

        if (siteName.width() <= siteListButton.width()) {
            siteName.width('100%');
        }
        if (!gui.buttonsInitialised) {
            gui.initMainUI();
            gui.initSettingsUI();
            gui.initAddReport();
            gui.initCommentsUI();
            gui.initReportsUI();
            gui.initChangePassword();
        } else {
            gui.events.emit('gui_buttons_initialised');
        }
        $.mobile.loading('hide');
        dfu.liveSensor.start(dfu.currentDfu.id);
        socket.emit('dfu_saved_alarm', {dfuId: dfu.currentDfu.id});
    });
    $('#refreshPage').bind('click', function() {
        location.reload();
    });
    $('#mainPageSiteListButton').bind('click', function() {
        $('#siteListPanel').panel('open');
        //window.location.reload();
    });
    $('#siteListClose').bind('click', function() {
        if (!gui.buttonsInitialised) return;

        $('#siteListPanel').panel('close');
    });
    if (screen.width <= 350) {
        $('#mainPageLogo').css({'padding-left': 0, 'padding-right': 0});
        $('#mainPageSiteListIcon').css({'width': screen.width-$('#mainPageLogo').width()});
    }

    var logoutHandler = function() {
        setTimeout(function() {
            document.location.replace(window.location.protocol + '//' + window.location.host + '/api/v1/auth/logout');
        }, 300);
    };
    $('#siteListPanelLogout').on('click', logoutHandler);
 
});

gui.initDfuList = function() {
    if (!socket) {
        return;
    }

    $('#mainPage').height('100%');
    $.mobile.loading('show');
    socket.emit('dfu_request', new dfu.Request('query', 'list'));
    gui.events.on('list', function(value) {
        var dfulistCompare = function(a, b) {
            if (a.$.Name < b.$.Name) return -1;
            if (a.$.Name > b.$.Name) return 1;
            return 0;
        };
        var siteList = [];
        if (!value.response.Interaction || !value.response.Interaction.Data || value.response.Interaction.Data.length== 0 || !value.response.Interaction.Data[0].Site || !value.response.Interaction.Data[0].Site.length) {
            console.error('Failed on getting dfu list.');
            $.mobile.loading('hide');
            $('#plsRefresh').popup('open');
            return false;
        } else {
            siteList = value.response.Interaction.Data[0].Site;
            siteList.sort(dfulistCompare);
        }

        var siteListPanel = $('#siteListPanel'),
            siteListDiv = $('#siteListDiv');
        for (var i=0; i<siteList.length; i++) {
            var site = $('<div class="siteListItem" id="">' + siteList[i].$.Name + '</div>');
            site[0].dfuId = siteList[i].$.DfuId;
            site[0].dfuName = siteList[i].$.Name;
            site.on('click', function(evt) {
                siteListPanel.panel('close');
                if (this.dfuId === dfu.currentDfuId) return;
                dfu.initCurrentDfu(this.dfuId, this.dfuName);
                siteListDiv.children().each(function() {
                    $(this).removeClass('siteListItemSelected');
                });
                $(this).addClass('siteListItemSelected');
            });
            siteListDiv.append(site);
        }
            siteListPanel.panel('open');
            $.mobile.loading('hide');
    });  
};

dfu.initCurrentDfu = function(dfuId, name) {
    $.mobile.loading('show');

    dfu.currentDfu = {};
    dfu.currentDfuId = dfuId;
    dfu.currentDfu.id = dfuId;
    dfu.currentDfu.name = name;
    // get system
    socket.emit('dfu_request', new dfu.Request('query', 'system', dfuId));
    var systemHandler = function(value) {
        if (!value.response || value.response.Interaction.$.OperationType === 'fail' || value.response.Interaction.$.DfuId != dfuId) {
            gui.toast('Failed to get site system information, Please refresh later.', 5000);
            return;
        }
        dfu.currentDfu.system = value.response.Interaction.Data[0].System[0];
        gui.events.un('system', systemHandler);
    };
    gui.events.on('system', systemHandler);
    socket.emit('dfu_request', new dfu.Request('query', 'config', dfuId));
    var configHandler = function(value) {
console.log(value);
        if (!value.response || value.response.Interaction.$.OperationType === 'fail' || value.response.Interaction.$.DfuId != dfuId) {
            return;
        }
        dfu.currentDfu.config = value.response.Interaction.Data[0];
        gui.events.un('config', configHandler);
        gui.events.emit('dfu_config_ready', [{dfuId: dfuId}]);
    };
    gui.events.on('config', configHandler);
    socket.emit('dfu_bg', {dfuId: dfu.currentDfu.id});
    socket.on('dfu_bg_response', function(res) {
        gui.setBackground(res.fileName);
        socket.off('dfu_bg_response');
    });
 };

gui.initMainUI = function() {
    if (gui.buttonsInitialised) return;

    var footButtonContainer = $('#footButtonContainer');
    var settings = new gui.FootBarButton(i18next.t('mainPage.button.Settings'), 'settings-normal.png', footButtonContainer);
        comments = new gui.FootBarButton(i18next.t('mainPage.button.Comments'), 'comments-normal.png', footButtonContainer);
        help = new gui.FootBarButton(i18next.t('mainPage.button.Help'), 'help-normal.png', footButtonContainer);
        logout = new gui.FootBarButton(i18next.t('mainPage.button.Logout'), 'logout-normal.png', footButtonContainer);

    var mainButtonContainer = $('#mainButtonContainer');
    //var status = new gui.MainFunctionButton(i18next.t('mainPage.button.Status'), 'Status-96.png', mainButtonContainer);
    var sos = new gui.MainFunctionButton(i18next.t('mainPage.button.SOS'), 'sos-normal.png', alarmButtonContainer);
        fall = new gui.MainFunctionButton(i18next.t('mainPage.button.Fall'), 'fall-normal.png', alarmButtonContainer);
        wander = new gui.MainFunctionButton(i18next.t('mainPage.button.Wander'), 'wander-normal.png', alarmButtonContainer);
        abnormal = new gui.MainFunctionButton(i18next.t('mainPage.button.Abnormal'), 'mobility-normal.png', alarmButtonContainer);
        motion = new gui.MainFunctionButton(i18next.t('mainPage.button.Motion'), 'motion-normal.png', functionButtonContainer);
        video = new gui.MainFunctionButton(i18next.t('mainPage.button.Video'), 'video-normal.png', functionButtonContainer);
        reports = new gui.MainFunctionButton(i18next.t('mainPage.button.History'), 'history-normal.png', functionButtonContainer);
    var funcButtons = [motion, video, reports];
    var alarmButtons = [sos, fall, wander, abnormal];
    var footerButtons = [settings, comments, help, logout];
    var setupButtons = function() {
        // video
        var videoSensor = dfu.findSensor(dfu.consts.VIDEO);
        video.setStreamId(videoSensor ? videoSensor.ID : null);
        video.stop = false;
        $('#videoImg').show();
        $('#videoImg').attr('src', '/images/mobile/video-normal.png');
        $('#videoDivBeep').show();
        $('#videoDivFlash').show();
        $('#videoDenied').hide();
        //$('#videoDlg').css('background-color', '');
        $('#videoDivPlay').hide();
        $('#videoDivPause').hide();
  
        // motion
        var motionSensor = dfu.findSensor(dfu.consts.MOTION);
        motion.setStreamId(motionSensor ? motionSensor.ID : null);
        motion.data = [];
        dfu.liveSensor.stop();
        socket.emit('dfu_request', new dfu.Request('command', 'get_cache', dfu.currentDfu.id));
 
        // alarm buttons
        var alarmTypes = ['HELP_ALARM', 'FALL_ALARM', 'WANDER_ALARM', 'ABNORMAL_ALARM'],
            sensors = [dfu.consts.SOS, dfu.consts.FALL, dfu.consts.WANDER, dfu.consts.ABNORMAL];

        for (var i=0; i<alarmButtons.length; i++) {
            var s = dfu.findSensor(sensors[i]);
            if (s) {
                alarmButtons[i].setStreamId(s.ID);
                alarmButtons[i].setDataType(alarmTypes[i]);
                alarmButtons[i].setAlarm(false);
                alarmButtons[i].log = '';
                alarmButtons[i].logCount = 1;
            } else {
                alarmButtons[i].setStreamId(null);
            }
        }

    };

    gui.events.on('gui_buttons_initialised', setupButtons);
    alarmButtons.forEach(function(button) {
        //button.button.addClass('alarmButton');
        //button.icon.addClass('alarmButtonIcon');
    });
    funcButtons.forEach(function(button) {
        button.button.addClass('funcButton');
    });
    var layoutIcons = function() {
        if ($.mobile.activePage[0].id !== 'mainPage') return;
        var isMobile = ( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ); 
        var isPortrait = $(window).height() > $(window).width();
        if (isMobile) {
            var MAX_ICON_WIDTH = 130;
            var numIconPerRow = isPortrait ? 2 : 4;
            var minMargin =  $('#alarmButtonContainer').width() / numIconPerRow * 0.1 > 10 ?  $('#alarmButtonContainer').width() / numIconPerRow * 0.1 : 10;
            var w1 = $('#alarmButtonContainer').width() / numIconPerRow - minMargin*2;
            var w2 = (($('#mainPage').height() - $('#mainPageHeader').height() - $('#footer').height()) - 30) / 2;
            var iconWidth = Math.min(w1, w2, gui.MAX_ICON_SIZE_MOBILE);
             alarmButtons.forEach(function(icon) {
                icon.setHeight(iconWidth);
                icon.button.css({'margin-top': minMargin, 'margin-bottom': minMargin});
                if (isPortrait) {
                    icon.button.removeClass('alarmButton25');
                    icon.button.addClass('alarmButton50');
                } else {
                    icon.button.removeClass('alarmButton50');
                    icon.button.addClass('alarmButton25');
                }
            });
            funcButtons.forEach(function(btn) {
                btn.setHeight(iconWidth * gui.FUNC_BUTTON_SIZE_RATIO);
            }); 

            var containerMargin = ($('#mainPage').height() - $('#mainPageHeader').height() - $('#footer').height() - iconWidth*2) / 4;
            $('#alarmButtonContainer').css({'margin-bottom': containerMargin});
            $('#functionButtonContainer').css({'margin-top': containerMargin, 'margin-bottom': containerMargin});
         } else {
            var minMargin =  $('#alarmButtonContainer').width() / 4 * 0.1 > 10 ?  $('#alarmButtonContainer').width() / 4 * 0.1 : 10;
            var w1 = $('#alarmButtonContainer').width() / 4 - minMargin*2;
            var w2 = (($('#mainPage').height() - $('#mainPageHeader').height() - $('#footer').height()) - 30) / 2;
            var iconWidth = Math.min(w1, w2, gui.MAX_ICON_SIZE_DESK);
            alarmButtons.forEach(function(icon) {
                icon.button.removeClass('alarmButton50');
                icon.button.addClass('alarmButton25');
                icon.setHeight(iconWidth);
                //icon.button.css({'height': iconWidth});
            });
            funcButtons.forEach(function(btn) {
                btn.setHeight(iconWidth * gui.FUNC_BUTTON_SIZE_RATIO);
            });

            var containerMargin = ($('#mainPage').height() - $('#mainPageHeader').height() - $('#footer').height() - iconWidth*2) / 4;
            $('#alarmButtonContainer').css({'margin-top': containerMargin, 'margin-bottom': containerMargin});
            $('#functionButtonContainer').css({'margin-top': containerMargin, 'margin-bottom': containerMargin});
        }

    };
    layoutIcons();
    $(window).resize(layoutIcons);
    $(document).on('pageshow', '#mainPage', layoutIcons);

    settings.setVClickHandler(function() {
        $(':mobile-pagecontainer').pagecontainer('change', '#settingsPage', { transition: 'slide' });
        //$.mobile.changePage('#settingsPage', { transition: 'slide' });
    });
    comments.setVClickHandler(function() {
        $(':mobile-pagecontainer').pagecontainer('change', '#commentsPage', { transition: 'slide' });
    });
    var logoutHandler = function() {
        setTimeout(function() {
            document.location.replace(window.location.protocol + '//' + window.location.host + '/api/v1/auth/logout');
        }, 300);
    };
    logout.setVClickHandler(logoutHandler);
    reports.setVClickHandler(function() {
        $(':mobile-pagecontainer').pagecontainer('change', '#historyPage', { transition: 'slide' });
    });
         //wander.setAlarm(true);
    var alarmButtonVClickHandler = function() {
        //console.log(this.log);
        if (!this.log) {
            this.log = '';
            this.logCount = 1;
        }
        $('#alarmDetailsTitle').text(this.title);
        $('#alarmDetailsDesc').html(this.log === '' ? i18next.t('mainPage.noAlarm') : this.log);
        this.setAlarm(false);
        $('#alarmDetails').popup('open');
        this.log = '';
        this.logCount = 1;
        socket.emit('dfu_alarm_viewed', {dfuId: dfu.currentDfu.id, alarmType: this.dataType});
        socket.emit('dfu_request', new dfu.Request('command', 'set_alarm_reset', dfu.currentDfu.id, null, {alarmType: this.dataType}));
        /*
        setTimeout(function () {
            $('#alarmDetails').popup('close');
        }, 10000);
        */
    };
    var alarmButtonDataHandler = function(value) {
        if (!value || !value.streamId || value.streamId != this.streamId)
            return;

        this.setAlarm(true);
        if (!this.logCount) {
            this.logCount = 1;
        }
        if (!this.log) {
            this.log = '';
        }
        var alarmText = i18next.t('mainPage.alarmContent', {name: this.title, time: new Date(value.date)});
        if (this.logCount < 11)
            this.log += this.logCount + '. ' + alarmText + '<br>';
        this.logCount++;
        if (window.Notification) {
            Notification.requestPermission(function(result) {
                if (result === 'granted') {
                    navigator.serviceWorker.ready.then(function(registration) {
                        registration.showNotification(alarmText, {'tag': 'RemoCare'});
                    });
                }
            });
        }

    };
    alarmButtons.forEach(function(btn) {
        btn.setVClickHandler(alarmButtonVClickHandler);
        gui.events.on('dfu_alarm', alarmButtonDataHandler.bind(btn));
    });
   /*status.setVClickHandler(function() {
        if ($('#statusCanvas').children().length > 0) {
            if (this.needRepaint) {
                this.paint();
            }
            $('#statusDlg').popup('open');
            return;
        }
        this.paint = function() {
            if (this.needRepaint) {
                $('#statusCanvas canvas').remove();
            }
            var dataName = [ i18next.t('mainPage.statusDlg.activity'), i18next.t('mainPage.statusDlg.comfortable'), i18next.t('mainPage.statusDlg.medicine'), i18next.t('mainPage.statusDlg.normalLiving') ],
                barColor = ['blue', 'red', 'green', 'cyan'],
                dataValue = [ 80, 50, 65, 70 ];
            gui.drawBarChart(dataName, barColor, dataValue, 'statusCanvas');
            this.needRepaint = false;
        };
        this.needRepaint = false;
        var self = this;
        $(window).resize(function() {
            self.needRepaint = true;
            if ($('#statusDlg').parent().hasClass('ui-popup-active')) {
                self.paint();
            }
        });
        this.paint();
        $('#statusDlg').popup('open');
    });*/
    motion.updateMotion = function(value) {
        if (value !== undefined && value instanceof Array) {
            var str = '';
            for(var i=0;i<value.length;i++) str+=value[i]+' ';
            value = value.length > dfu.motionTotalPoints ? value.slice(value.length - totalPoints) : value;
            var totalNumOfData = this.data.length + value.length;
            if (value.length >= dfu.motionTotalPoints) {
                this.data = value;
            } else if (totalNumOfData <= dfu.motionTotalPoints) {
                this.data = this.data.concat(value);
            } else {
                this.data = this.data.slice(Math.abs(totalNumOfData - dfu.motionTotalPoints));
                this.data = this.data.concat(value);
            }
        }
        var res = [];
        for (var i=0; i<this.data.length; ++i) {
            res.push([i, this.data[i]]);
        }
        this.motionPlot.setData([res]);
        if ($('#motionDlg-popup').hasClass('ui-popup-active')) {
            this.motionPlot.draw();
        };
    };
    motion.motionPlot = $.plot('#motionCanvas', [[[]]], {
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
    motion.setVClickHandler(function() {
        $('#motionDlg').popup('open');
        this.motionPlot.resize();
        this.motionPlot.setupGrid();
        this.motionPlot.draw();
    });
    $(window).resize(function() {
        if ($('#motionDlg').parent().hasClass('ui-popup-active')) {
            motion.motionPlot.resize();
            motion.motionPlot.setupGrid();
            motion.motionPlot.draw();
        }
    });
    motion.cachedDataReceived = false;
    gui.events.on('get_cache', function(value) {
        gui.events.on('live_sensor', motionDataHandler.bind(motion));
        dfu.liveSensor.start(dfu.currentDfu.id);
        //console.log(value);
    });
    // get_catch is moved to setupButtons

    motion.data = [];
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
            if (sensor.$.SensorId != this.streamId)
                continue;
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
            this.updateMotion(motionData);
            break;
        }
    };

    // video
    var videoTimer;
    var videoTimerCallback = function() {
        video.stop = true;
        $('#videoDivPlay').show();
        $('#videoDivPause').hide();
    } 
    video.setVClickHandler(function() {
        $('#videoDlg').popup('open');
        video.stop = false;
        video.getVideoFrame();
        videoTimer = setTimeout(videoTimerCallback, gui.videoTimeoutInterval);
        audioCaptureInit();
        setTimeout(function() {
            gui.events.emit('start_audio_capture');
            gui.events.emit('start_dfu_audio');
        }, 1000);
    });
    $('#videoDlg').bind({
        popupafterclose: function(event, ui) {
            video.stop = true;
            clearTimeout(videoTimer);
            gui.events.emit('stop_audio_capture');
            gui.events.emit('stop_dfu_audio');
        }
    });
    $('#videoDivPlay').on('click', function(evt) {
        video.stop = false;
        videoTimer = setTimeout(videoTimerCallback, gui.videoTimeoutInterval);
        $('#videoDivPlay').hide();
        $('#videoDivPause').show();
        video.getVideoFrame();
    });
    $('#videoDivPause').on('click', function(evt) {
        clearTimeout(videoTimer);
        video.stop = true;
        $('#videoDivPlay').show();
        $('#videoDivPause').hide();
    });
    $('#videoDenied').hide();
    video.stop = true;
    video.getVideoFrame = function() {
        if (video.stop) return;

        socket.emit('dfu_request', new dfu.Request('query', 'live_video', dfu.currentDfu.id, video.streamId));
        video.getVideoFrameTimeoutId = window.setTimeout(video.getVideoFrame, gui.videoRefreshTimeout);
    };
    video.dataHandler = function(value) {
        if (video.stop) return;
        if (value.request.dfuId != dfu.currentDfu.id || value.request.sensorId != this.streamId || !value.response || value.response.Interaction.$.OperationType === 'fail') {
			if (value.response.Interaction.$.OperationType === 'fail') {
				console.log('video failed');
			}
            return;
        }
        if (value.response.Interaction.$.OperationType === 'denied') {
			console.log('video denied');
            window.clearTimeout(video.getVideoFrameTimeoutId);
            //gui.events.un('live_video', video.dataHandler);
            video.stop = true;
            //video.destroy();
            //delete video;
            $('#videoImg').hide();
            $('#videoDivBeep').hide();
            $('#videoDivFlash').hide();
            $('#videoDenied').show();
            clearTimeout(videoTimer);
            $('#videoDivPlay').hide();
            $('#videoDivPause').hide();
            //$('#videoDlg').css('background-color', 'white');
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
            $('#videoDlg').css('background-color', '');
        }
        $('#videoDivPlay').hide();
        $('#videoDivPause').show();
 
        $('#videoImg').attr('src', 'data:image/jpeg;' + value.imageData);
        $('#videoDlg').popup('reposition', {positionTo: 'window'});
    };
    gui.events.on('live_video', video.dataHandler);
    //socket.emit('dfu_request', new dfu.Request('query', 'live_video', dfu.currentDfu.id, video.streamId));


    //$('#footer').append($('<div id="mainButtonContainerSize" style="position:absolute;left:20;bottom:0;width:200px;"></div>'));
    //$('#mainButtonContainerSize').text($(document).width() + 'x' + $(document).height());

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
    $('#videoDivFlash').bind('click', videoDivButtonAction('set_flash'));
    $('#videoDivBeep').bind('click', videoDivButtonAction('set_beep'));
    
    // audio
    var mic = $('#microphone'),
        speaker = $('#speaker');
    mic[0].active = true;
    speaker[0].active = true;

    speaker.on('click', function() {
        if (this.active) {
            $(this).prop('src', '/images/mobile/speaker-off.png');
            socket.emit('dfu_request', new dfu.Request('command', 'stop_audio_stream', dfu.currentDfuId));
        } else {
            $(this).prop('src', '/images/mobile/speaker.png');
            socket.emit('dfu_request', new dfu.Request('command', 'start_audio_stream', dfu.currentDfuId));
        }
        this.active = !(this.active);
    });
    gui.events.on('start_dfu_audio', function() {
        if (speaker[0].active) {
            socket.emit('dfu_request', new dfu.Request('command', 'start_audio_stream', dfu.currentDfuId));
        }
    });
    gui.events.on('stop_dfu_audio', function() {
        socket.emit('dfu_request', new dfu.Request('command', 'stop_audio_stream', dfu.currentDfuId));
    });
    var liveAudioQueue = [];
    var audioPlayback = $('#audioPlaybackElm')[0];
    var audioPlaybackEndedListener = function() {
        if (liveAudioQueue.length > 0) {
            audioPlayback.src = 'data: audio/mpeg; ' + liveAudioQueue[0];
            liveAudioQueue.shift();
            audioPlayback.oncanplay = audioPlayback.play;
            audioPlayback.load();
        }
    };
    audioPlayback.onended = audioPlaybackEndedListener;
    gui.events.on('audio_frame_up', function(value) {
        if (!value.imageData) {
            console.log('null data');
            return;
        }
        console.log('audio_frame_up data.length = ', value.imageData ? value.imageData.length : 0);
        //console.log(value.imageData);
        liveAudioQueue.push(value.imageData);
        if (audioPlayback.paused)
            audioPlaybackEndedListener();
    });

    var visualize = function(stream, mediaElm, canvasId) {
        var context = new AudioContext();
        var src = stream ? context.createMediaStreamSource(stream)
                         : context.createMediaElementSource(mediaElm);
        var analyser = context.createAnalyser();

        var canvas = document.getElementById(canvasId);
        var canvasCtx = canvas.getContext("2d");

        src.connect(analyser);
        analyser.connect(context.destination);

        analyser.fftSize = 256;

        var bufferLength = analyser.frequencyBinCount;
        console.log(bufferLength);

        var dataArray = new Uint8Array(bufferLength);

        var WIDTH = canvas.width;
        var HEIGHT = canvas.height;
        var bar_width = 8,
            numOfBars = Math.floor(canvas.width / 10);
        function renderFrame() {
            requestAnimationFrame(renderFrame);
            if (!(stream && stream.activeState || mediaElm)) return;
            analyser.getByteFrequencyData(dataArray);
            canvasCtx.globalAlpha = 0.2;
            canvasCtx.fillStyle = '#B8BBBB';
            canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
            canvasCtx.fillStyle = '#FF6600';
            var bar_x = 0
            for (var i = 0; i < bufferLength; i+=Math.floor(bufferLength/numOfBars)) {
                bar_x += bar_width + 2;
                var bar_height = (dataArray[i] / 2);
                canvasCtx.fillRect(bar_x, canvas.height/2, bar_width, -bar_height);
                canvasCtx.fillRect(bar_x, canvas.height/2, bar_width, bar_height);
            }
        }
      renderFrame();
    };
    visualize(null, audioPlayback, 'audioPlaybackVis');
    var audioCaptureInit = function() {
        if (!navigator.mediaDevices.getUserMedia) {
            console.log('getUserMedia unsupported!');
            if (mic[0].active) 
                mic.click();
            return;
        }
        if (gui.audioCaptureInit) {
            return;
        }
        var constraints = { audio: true };
        var chunks = [];
        var onSuccess = function(stream) {
            stream.activeState = true;
            visualize(stream, null, 'audioCaptureVis');
            var options = {mimeType: 'audio/ogg; codecs=opus'};
            var mediaRecorder = new MediaRecorder(stream);
            var stopRecording = true;
            var getData = function() {
                setTimeout(function () {
                    if (mediaRecorder.state == 'recording') {
                        mediaRecorder.stop();
                        if (stopRecording) {
                            stream.getTracks()[0].enabled = false;
                            return;
                        }
                        startRec();
                    }
                }, 2000);
            };
            var startRec = function() {
				//console.log("stream.getTracks()[0].enabled = ", stream.getTracks()[0].enabled);
				if (!stream.getTracks()[0].enabled) {
					stream.getTracks()[0].enabled = true;
				}
                mediaRecorder.start();
                getData();
            };
            gui.events.on('start_audio_capture', function() {
				if (!stopRecording) return;

                if (mic[0].active) {
                    stopRecording = false;
                    startRec();
                }
            });
            gui.events.on('stop_audio_capture', function() {
                    stopRecording = true;
                    stream.getTracks()[0].enabled = false;
            });
            mic.on('click', function() {
                if (this.active) {
                    $(this).prop('src', '/images/mobile/microphone-off.png');
                    stopRecording = true;
                    stream.getTracks()[0].enabled = false;
                } else {
                    $(this).prop('src', '/images/mobile/microphone.png');
                    stopRecording = false;
                    startRec();
                }
                this.active = !(this.active);
                stream.activeState = this.active;
                
            });
            mediaRecorder.onstop = function(e) {
                var fileReader = new FileReader();
                fileReader.onload = function() {
                    console.log('array buffer length = ', this.result.byteLength);
                    socket.emit('dfu_request', new dfu.Request('streaming',
                                                               'audio_frame_down', 
                                                               dfu.currentDfuId, 
                                                               null, 
                                                               {Format: 'ogg', Length: this.result.byteLength}, 
                                                               this.result));
                                                               
                };
                var blob = new Blob(chunks, { 'type' : 'audio/ogg' });
                fileReader.readAsArrayBuffer(blob);
                chunks = [];
            };
            mediaRecorder.ondataavailable = function(e) {
                chunks.push(e.data);
            };
			gui.events.emit('start_audio_capture');

        };
        var onError = function(err) {
            console.log('The following error occured: ' + err);
        };
        navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
        gui.audioCaptureInit = true;
    }
    gui.buttonsInitialised = true;
    gui.events.emit('gui_buttons_initialised');
};

gui.initReportsUI = function() {
    $('#historyPageBackButton').on('click', function(evt) {
        $.mobile.back();
    });	
    $(document).ready(function() {
        $('#reportsLD').show();
        //$('#reportsLW').hide();
        $('#reportsLM').hide();
        //$('#reportsNW').hide();
    });
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
    var yearly = function(year, motionRate) {
        this.Year = year;
        this.YearlyMotionRate = motionRate;
        this.Monthly = [];
        },
        monthly = function(month, motionRate) {
        this.Month = month;
        this.MonthlyMotionRate = motionRate;
        this.Daily = [];
        },
        daily = function(day, motionRate) {
        this.Day = day;
        this.DailyMotionRate = motionRate;
        },
        hourly = function(hour, motionRate) {
        this.Hour = hour;
        this.HourlyMotionRate = motionRate;
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
                socket.emit('dfu_request', new  dfu.Request('command', 'get_history', dfu.currentDfu.id, null, {Year: year, Month: month, Day: day}));
            };
            requestHistory();
            var dataHandler = function(value) {
                if (value.request.data.Year === year
                    && value.request.data.Month === month
                    && value.request.data.Day === day) {
                    // TODO: fill zeros when 'not available'
                    if (value.response.Interaction.$.OperationType === 'fail' ) {
                        requestHistory();
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
    var plotTouchendHandler = function(evt, plot, relativeOffset) {
        console.log('relativeOffset', relativeOffset);
        var width = placeholder.width();
        if (Math.abs(relativeOffset.x) < width/2) {
            // only change data when swipe over half of graph width
            return;
        }
        var newDate = calculateNextDate(this.currentRequestType, this.currentRequestData, relativeOffset.x > 0);
        if (newDate) {
            this.currentRequestData = newDate;
            setTimeout(getData.bind(this)(renderData.bind(this)), 0);
        } else {
            // do nothing because invalid new date.
        }
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
/*
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
*/
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
    var mockData = {
        line: [],
        bar: []
    };
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
    },
    reportsLW = {
        title: 'History for last week',
        currentRequestType: 'week',
        currentRequestData: 'lastweek',
        data: mockData
    },
    reportsLM = {
        getDateStr: function() {
            return this.currentRequestData.getMonth() + 1 + '-' + this.currentRequestData.getFullYear();
        },
        getTitle: function() {
            return i18next.t('historyPage.historyOf', {date: this.getDateStr()});
        },
        titleId: 'reportsLMTitle',
        canvasId: 'reportsLMCanvas',
        currentRequestType: 'month',
        currentRequestData: new Date(),
        arrayFieldName: 'Daily',
        indexFieldName: 'Day',
        getIndexBound: function() { return {start: 1, end: new Date(this.currentRequestData.getFullYear(), this.currentRequestData.getMonth(), 0).getDate()}; },
        data: mockData,
        //dataFieldNames: ['MonthlyMotionRate', 'MonthlyWanderInNumber', 'MonthlyWanderOutNumber', 'MonthlySOSNumber', 'MonthlyFallNumber', 'MonthlyAbnormalNumber'],
        dataFieldNames: ['DailyMotionRate', 'DailyWanderInNumber', 'DailyWanderOutNumber', 'DailySOSNumber', 'DailyFallNumber', 'DailyAbnormalNumber'],
        dataFieldNamesI18n: ['historyPage.plot.motion', 'historyPage.plot.wanderin', 'historyPage.plot.wanderout', 'historyPage.plot.sos', 'historyPage.plot.fall', 'historyPage.plot.abnormal'],
        init: function() {
            this.currentRequestData.setHours(0, 0, 0, 0);
            this.currentRequestData.setDate(1);
            $('#reportsLMPrev').bind('click', clickHandler.bind(reportsLM)(false));
            $('#reportsLMNext').bind('click', clickHandler.bind(reportsLM)(true));
        }
    },
    reportsNW = {
        title: 'Prediction for next week',
        currentRequestType: 'week',
        currentRequestData: 'nextweek',
        data: mockData
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
    $(document).on('pagecontainershow', function(evt, ui) {
        var activePage = $.mobile.pageContainer.pagecontainer('getActivePage');
        if (activePage.attr('id') === 'historyPage') {
            initCanvas.bind(reportsLD)($('#reportsLDCanvas'));
            getData.bind(reportsLD)(renderData.bind(reportsLD));
         }
    });
    $(document).on('change', 'input[name*="reportsNavBar"]', function() {
        var id = $(this).attr('id');
        switch(id) {
            case 'reportsNavBarLD':
                $('#reportsLD').show(0);
                $('#reportsLM').hide();
                initCanvas.bind(reportsLD)();
                getData.bind(reportsLD)(renderData.bind(reportsLD));
                break;
/*
            case 'reportsNavBarLW':
                $('#reportsLD').hide();
                $('#reportsLW').show(0);
                $('#reportsLM').hide();
                $('#reportsNW').hide();
                initCanvas.bind(reportsLW)($('#reportsLWCanvas'));
                getData.bind(reportsLW)(renderData.bind(reportsLW));
                break;
*/
             case 'reportsNavBarLM':
                $('#reportsLD').hide();
                $('#reportsLM').show(0);
                initCanvas.bind(reportsLM)();
                getData.bind(reportsLM)(renderData.bind(reportsLM));
                break;
/*             case 'reportsNavBarNW':
                $('#reportsLD').hide();
                $('#reportsLW').hide();
                $('#reportsLM').hide();
                $('#reportsNW').show(0);
                initCanvas.bind(reportsNW)($('#reportsNWCanvas'));
                getData.bind(reportsNW)(renderData.bind(reportsNW));
                break;
*/
           default:
                break;
        }
    });
 
};

gui.setBackground = function(fileName) {
    if (!fileName) return;
    $('#mainPage').removeClass('mainPageBgImg').addClass('userBgImg').css('background-image', 'url(/api/v1/uploads/' + fileName + ')');
    var divs = $('.bgImg');
    if (divs.length === 0) divs = $('.userBgImg');
    divs.each(function(index, elm) {
        $(elm).removeClass('bgImg').addClass('userBgImg').css('background-image', 'url(/api/v1/uploads/' + fileName + ')');
    });
}

gui.initSettingsUI = function() {
    // Settings General Alarm Options
	//Bao Test swipe left and right to change page
    /*
	$(document).on('swipeleft', 'div[data-role*="swipePage"]', function(event) {

							
		if(event.handled !== true) // This will prevent event triggering more then once
			{    
				var nextpage = $.mobile.activePage.next('div[data-role="swipePage"]');
				// swipe using id of next page if exists
				if (nextpage.length > 0) {
					alert("left!!!!!!!!");
					$.mobile.changePage(nextpage, {transition: "slide", reverse: false}, true, true);
				}
				event.handled = true;
			}
		return false;				
	});

$(document).on('swiperight', 'div[data-role*="content"]', function(event) {
				//alert("right!!!!!!!!");     
		if(event.handled !== true) // This will prevent event triggering more then once
		{      
			var prevpage = $(this).prev('div[data-role="swipePage"]');
			if (prevpage.length > 0) {
				$.mobile.changePage(prevpage, {transition: "slide", reverse: true}, true, true);
			}
			event.handled = true;
		}
		return false;    
	});
	///////////End Bao'test-----------------------------
*/	
    $('#settingsPageBackButton').on('click', function(evt) {
        $.mobile.back();
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
            for(var i=1; i<5; i++) motionAvg.avg[i] = value.data[i].$.Value;
        }
    });
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
    $('#settingsGAO').bind('afterShow', function() {
        //initSettingsUIValue();
        paintSwipeChartView();
    });

    $(document).on('pagecontainershow', function(evt, ui) {
        var activePage = $.mobile.pageContainer.pagecontainer("getActivePage");
        if (activePage.prop('id') !== 'settingsPage') return;
        initUI();
        initDfu();
        
        paintSwipeChartView();
        requestBackground();
    });
    $('#settingsGAOAlarmPeriodDiv').on('change', '[type="radio"]', function(evt) {
        console.log(this);
        curAlarmPeriod = $(this);
        if ($(this).attr('id') === 'settingsGAOAlarmPeriod1') {
            preAlarmPeriod = curAlarmPeriod;
            paintSwipeChartView();
            return;
        }

        var alarmPeriodButtonId = $('input[name*=settingsGAOAlarmPeriod]:checked').attr('id'); 
        var periodOption = parseInt(alarmPeriodButtonId.substring(22));
        var title = i18next.t('settingsPage.chooseTime', {period: motionAvg.txt[periodOption]});
        $('#settingsTimepickerTitle').text(title);
        var h = motionSettings[motionAvg.options[periodOption].hour],
            m = motionSettings[motionAvg.options[periodOption].minute];
        $('#settingsTime').prop('value', (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m);
        $('#timepicker').popup('open');
        //paintSwipeChartView();
    });
    $('#settingsTimepickerCancel').bind('click', function() {
        if (preAlarmPeriod.attr('id') === curAlarmPeriod.attr('id')) return;

        preAlarmPeriod.prop('checked', true);
        preAlarmPeriod.checkboxradio('refresh');
        curAlarmPeriod.prop('checked', false);
        curAlarmPeriod.checkboxradio('refresh');
        curAlarmPeriod = preAlarmPeriod;
    });
    $('#settingsTimepickerOK').bind('click', function() {
        var alarmPeriodButtonId = $('input[name*=settingsGAOAlarmPeriod]:checked').attr('id');
        var periodOption = parseInt(alarmPeriodButtonId.substring(22));
        var timeStr = $('#settingsTime').prop('value');
        var hourStr = timeStr.substr(0, 2),
            minuteStr = timeStr.substr(3);
        motionSettings[motionAvg.options[periodOption].hour] = parseInt(hourStr, 10);
        motionSettings[motionAvg.options[periodOption].minute] = parseInt(minuteStr, 10);
        preAlarmPeriod = curAlarmPeriod;
        paintSwipeChartView();
    });

    // Ranger slider
    $('#settingsGAOMP').on('slidestop', function(e) {
        motionSettings.StartHour = $("#settingsGAOMPStart").val();
        motionSettings.StopHour = $("#settingsGAOMPEnd").val();
    });

    // assume dfu.currentDfu.system is available
    var initialized = false;
    var preAlarmPeriod, curAlarmPeriod;
    var initUI = function() {
        if (initialized) return;
        initialized = true;

        // init tab bar
        $('#settingsPage > div.ui-content > ul > li').each(function(index) {
            var tabDiv = $(this).attr('tab-div');
            $(this).on('click', function() {
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

        // init upload background button handler
        $('#settingsUploadBg').change(function(e) {
            var file = e.target.files[0];
            if (file.size > gui.maxUploadFileSize) {
                gui.toast('File is too big: ' + file.size + '. Maximum file size: ' + gui.maxUploadFileSize, 3000);
                return;
            }
            var stream = ss.createStream();
            ss(socket).emit('file', stream, {size: file.size, name: file.name, type: file.type, dest: 'bg'});
            var blobStream = ss.createBlobReadStream(file);
            var size = 0;
            blobStream.on('data', function(chunk) {
                size += chunk.length;
                var percent = Math.floor(size/file.size * 100);
                $('#settingsUploadBgProgress').width(percent + '%');
                //console.log(percent);
            });
            blobStream.on('end', function(evt) {
                //$('#addReportFile').prop('disabled', false).removeClass('ui-disabled');
                //console.log('blobStream end', evt);
            });
            blobStream.pipe(stream);
        });
        gui.events.on('file_uploaded', function(evt) {
            if (evt.dest !== 'bg' || !evt.savedName) return;
            console.log(evt);
            socket.emit('dfu_upload_bg', {dfuId: dfu.currentDfu.id, fileName: evt.savedName});
            gui.setBackground(evt.savedName);
       });

        // Make fall detection div height 100%
        $('#settingsFD').height($('#settingsWAS').height())
        $('#settingsCP').height($('#settingsWAS').height())
        //$('#settingsFD').height($('#settingsPage').height() - $('#settingsPage > .ui-header').outerHeight() - $('.settingsNav').outerHeight());
        //$('#settingsCP').height($('#settingsPage').height() - $('#settingsPage > .ui-header').outerHeight() - $('.settingsNav').outerHeight());
    }

    var initDfu = function () {

        if (dfu.currentDfu.system && dfu.currentDfu.system.Alarm) {
            for (var key in motionSettings) {
                motionSettings[key] = dfu.currentDfu.system.Alarm[0].$[key] ? dfu.currentDfu.system.Alarm[0].$[key] : motionSettings[key];
            }
            for (var key in fallSettings) {
                fallSettings[key] = dfu.currentDfu.system.Alarm[0].$[key];
            }
            for (var key in wanderSettings) {
                wanderSettings[key] = dfu.currentDfu.system.Alarm[0].$[key];
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
    //setTimeout(initSettingsUIValue, 0);
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
    gui.events.on('set_motion_config', setConfigResponse);
    gui.events.on('set_fall_config', setConfigResponse);
    gui.events.on('set_wander_config', setConfigResponse);
    $('#settingsGAOSave').bind('click', function() {
        // alarm period
        var alarmPeriodButtonId = $('input[name*=settingsGAOAlarmPeriod]:checked').attr('id');
        motionSettings.AlarmPeriod = alarmPeriodButtonId.substring(22);
        // alarm options
        motionSettings.AlarmOptionRed = $('#alarmOptionRed').prop('checked') ? 'ON' : 'OFF';
        motionSettings.AlarmOptionYellow = $('#alarmOptionYellow').prop('checked') ? 'ON' : 'OFF';
        motionSettings.AlarmOptionGreen = $('#alarmOptionGreen').prop('checked') ? 'ON' : 'OFF';
        motionSettings.SendAlarmEmail = $('#settingsGAOalarmEmail').prop('checked') ? 'ON' : 'OFF';
        socket.emit('dfu_request', new dfu.Request('command', 'set_motion_config', dfu.currentDfu.id, null /* sensorId */, motionSettings));
        console.log(motionSettings);
    });

    $('#settingsFDSave').bind('click', function() {
        var fdSettings = {};
        fdSettings.FallDetection = $('#settingsFDEn').prop('checked') ? 'ON' : 'OFF';
        fdSettings.SendFallAlarmEmail = $('#settingsFDalarmEmail').prop('checked') ? 'ON' : 'OFF';
        fdSettings.FallLearning = $('#settingsFDFAL').prop('checked') ? 'ON' : 'OFF';
        fdSettings.FallSensitivity = $('#settingsFDSensitivity').val();
        console.log(fdSettings);
        socket.emit('dfu_request', new dfu.Request('command', 'set_fall_config', dfu.currentDfu.id, null /* sensorId */, fdSettings));
    });
    // Will be called on settingsPage showing
    var requestBackground = function () {
        if ($('#doorFindingImg').length === 0) {
            socket.emit('dfu_request', new dfu.Request('query', 'background', dfu.currentDfu.id));
        }
    };
    // remove doorFindingImg when switching dfu
    gui.events.on('gui_buttons_initialised', function() {
        $('#doorFindingImg').remove();
        $('#settingsWASDf').empty();
    });
    $('#settingsWASSave').bind('click', function() {
        wanderSettings.WanderDetection = $('#settingsWASEn').prop('checked') ? 'ON' : 'OFF';
        wanderSettings.SendWanderAlarmEmail = $('#settingsWASalarmEmail').prop('checked') ? 'ON' : 'OFF';
        wanderSettings.DoorFinding = $('#settingsWASDfen').prop('checked') ? 'ON' : 'OFF';
        wanderSettings.WanderSensitivity = $('#settingsWASSensitivity').val();
        console.log('save wander', wanderSettings);
        socket.emit('dfu_request', new dfu.Request('command', 'set_wander_config', dfu.currentDfu.id, null /* sensorId */, wanderSettings));
 
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
            var doorRect = {};
            doorRect.x = wanderSettings.DoorX * doorFindingDivRatio;
            doorRect.y = wanderSettings.DoorY * doorFindingDivRatio;
            doorRect.width = wanderSettings.DoorWidth * doorFindingDivRatio;
            doorRect.height = wanderSettings.DoorHeight * doorFindingDivRatio;
            doorRect.width = doorRect.width > doorFindingDiv.width() ? doorFindingDiv.width() : doorRect.width;
            doorRect.x = doorRect.x + doorRect.width > doorFindingDiv.width() ? (doorFindingDiv.width() - doorRect.width) : doorRect.x;
            doorRect.height = doorRect.height > doorFindingDiv.height() ? doorFindingDiv.height() : doorRect.height;
            doorRect.y = doorRect.y + doorRect.height > doorFindingDiv.height() ? (doorFindingDiv.height() - doorRect.height) : doorRect.y;
            gui.drawRectOnImg('settingsWASDf', 'doorFindingImg', doorRect.x, doorRect.y, doorRect.width, doorRect.height);
        }, 500);
    };
    $('#settingsWAS').bind('afterShow', paintDoorFinding);

    gui.events.on('background', function(value) {
        if (!value.response || value.response.Interaction.$.OperationType === 'fail' || value.response.Interaction.$.DfuId != dfu.currentDfu.id || !value.imageData) {
            return;
        }
        var img = new Image();
        img.style = 'display: none';
        img.id = 'doorFindingImg';
        img.onload = function() {
            doorFindingImgRatio = img.height / img.width;
            paintDoorFinding();
        };
        img.src = 'data:image/jpeg;' + value.imageData;
        $('body').append(img);
        $(img).css('display', 'none');
		
    });

    gui.events.on('rect_on_image_updated', function(value) {
        wanderSettings.DoorX = value.rect.x / doorFindingDivRatio;
        wanderSettings.DoorY = value.rect.y / doorFindingDivRatio;
        wanderSettings.DoorWidth = value.rect.width / doorFindingDivRatio;
        wanderSettings.DoorHeight = value.rect.height / doorFindingDivRatio;
    });

    $('#settingsGAO').show();
    $('#settingsCP').hide();
    $('#settingsWAS').hide();
    $('#settingsFD').hide();

    $(window).resize(function() {
        paintSwipeChartView();
        paintDoorFinding();
    });
};

gui.initCommentsUI = function() {
    var refreshComments = function() {
        var contents = $('#commentsPageContents')
        contents.empty();
        gui.getReportData(contents);
    };
    $('#commentsPageBackButton').on('click', function(evt) {
        $.mobile.back();
    });
    $('#commentsPageAdd').on('click', function(evt) {
        $('#addReport').popup('open');
    });
    gui.events.on('report_submitted', refreshComments);
    $(document).on('pagecontainershow', function(evt, ui) {
        var activePage = $.mobile.pageContainer.pagecontainer('getActivePage');
        if (activePage.attr('id') === 'commentsPage') {
            var siteName = $('<textarea />').html(dfu.currentDfu.name).text();
            $('#commentsPageSiteName').html(i18next.t('commentsPage.title', {siteName: siteName}));
            refreshComments();
        }
    });
}
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
